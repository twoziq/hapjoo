'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { EditorData } from '@/types/sheet';
import { GENDERS, MUSIC_KEYS, ROUTES } from '@/lib/constants';
import { generateContent, parseCodeToData, parseSheet } from '@/lib/sheet';
import { emptySection } from '@/lib/sheet/editor';
import { supabaseConfigured } from '@/lib/supabase/client';
import { useSession } from '@/lib/hooks/useSession';
import { signInWithGoogle } from '@/lib/auth';
import {
  createSongAction,
  requestSongCreateAction,
  requestSongEditAction,
  updateSongAction,
} from '@/app/(tabs)/songs/actions';
import { SectionEditor } from './SectionEditor';
import { useEditorState } from './hooks/useEditorState';

export type SongEditorMode =
  | 'create-direct'
  | 'create-request'
  | 'edit-direct'
  | 'edit-request'
  | 'none';

interface Props {
  initialData?: EditorData;
  editSongId?: string;
  mode?: SongEditorMode;
}

const DEFAULT_DATA: EditorData = {
  title: '',
  artist: '',
  key: 'G',
  gender: '',
  capo: 0,
  bpm: 80,
  sections: [emptySection('Verse')],
};

export default function SongEditorClient({ initialData, editSongId, mode = 'none' }: Props) {
  const router = useRouter();
  const isEdit = !!editSongId;
  const data = initialData ?? DEFAULT_DATA;
  const { isAuthenticated, loading: sessionLoading } = useSession();
  const isRequestMode = mode === 'create-request' || mode === 'edit-request';

  const [title, setTitle] = useState(data.title);
  const [artist, setArtist] = useState(data.artist);
  const [key, setKey] = useState(data.key);
  const [gender, setGender] = useState(data.gender);
  const [capo, setCapo] = useState(data.capo);
  const [bpm, setBpm] = useState(data.bpm);
  const editor = useEditorState(data.sections);
  const { sections, setSections } = editor;

  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function enterCode() {
    setCodeText(generateContent(title, artist, key, gender, capo, bpm, sections));
    setShowCode(true);
  }

  function exitCode() {
    const d = parseCodeToData(codeText);
    setTitle(d.title);
    setArtist(d.artist);
    setKey(d.key);
    setGender(d.gender);
    setCapo(d.capo);
    setBpm(d.bpm);
    setSections(d.sections);
    setShowCode(false);
  }

  // Section drag
  const [secDragFrom, setSecDragFrom] = useState<number | null>(null);
  const [secDragOver, setSecDragOver] = useState<number | null>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleSecDragDown(e: React.PointerEvent, si: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSecDragFrom(si);
    setSecDragOver(si);
  }

  function handleSecDragMove(e: React.PointerEvent) {
    if (secDragFrom === null) return;
    const y = e.clientY;
    for (let i = 0; i < sectionRefs.current.length; i++) {
      const el = sectionRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) {
        setSecDragOver(i);
        break;
      }
    }
  }

  function handleSecDragUp() {
    if (secDragFrom !== null && secDragOver !== null && secDragFrom !== secDragOver) {
      editor.moveSection(secDragFrom, secDragOver);
    }
    setSecDragFrom(null);
    setSecDragOver(null);
  }

  function save() {
    const rawContent = showCode
      ? codeText
      : generateContent(title, artist, key, gender, capo, bpm, sections);
    const meta = showCode ? parseSheet(codeText).meta : null;
    const saveTitle = meta ? String(meta.title ?? '') : title;
    const saveArtist = meta ? String(meta.artist ?? '') : artist;
    const saveKey = meta ? String(meta.key ?? 'G') : key;
    const saveCapo = meta ? Number(meta.capo ?? 0) : capo;
    const saveBpm = meta ? Number(meta.bpm ?? 80) : bpm;

    if (!saveTitle.trim()) {
      setResult({ ok: false, msg: '제목을 입력해주세요.' });
      return;
    }
    if (!isAuthenticated) {
      setResult({ ok: false, msg: '곡 추가/편집은 로그인이 필요합니다.' });
      return;
    }
    if (mode === 'none') {
      setResult({ ok: false, msg: '저장 권한이 없습니다.' });
      return;
    }
    setResult(null);
    const content = rawContent;
    const requestPatch = {
      title: saveTitle,
      artist: saveArtist,
      music_key: saveKey,
      capo: saveCapo,
      bpm: saveBpm,
      content,
    };

    startTransition(async () => {
      if (mode === 'edit-direct' && editSongId) {
        const r = await updateSongAction(editSongId, {
          title: saveTitle,
          artist: saveArtist,
          key: saveKey,
          capo: saveCapo,
          bpm: saveBpm,
          content,
        });
        if (r.ok) {
          setResult({ ok: true, msg: '수정 완료!' });
          setTimeout(() => router.push(ROUTES.viewer(editSongId)), 800);
        } else {
          setResult({ ok: false, msg: `저장 실패: ${r.error}` });
        }
        return;
      }

      if (mode === 'edit-request' && editSongId) {
        const r = await requestSongEditAction(editSongId, requestPatch);
        if (r.ok) {
          setResult({
            ok: true,
            msg: '수정 요청을 보냈습니다. 관리자 검토 후 반영됩니다.',
          });
          setTimeout(() => router.push(ROUTES.viewer(editSongId)), 1200);
        } else {
          setResult({ ok: false, msg: `요청 실패: ${r.error}` });
        }
        return;
      }

      if (mode === 'create-direct') {
        if (!supabaseConfigured) {
          try {
            await navigator.clipboard.writeText(content);
            setResult({
              ok: true,
              msg: '악보 텍스트가 클립보드에 복사됐습니다. data/songs/ 폴더에 .txt 파일로 붙여넣어 추가하세요.',
            });
          } catch {
            setResult({ ok: false, msg: '클립보드 복사 실패. 미리보기에서 직접 복사해주세요.' });
            setShowPreview(true);
          }
          return;
        }
        // id는 DB가 gen_random_uuid()로 발급. 클라에서 미리 만들어 보내 RLS insert 후 select 우회.
        const id = crypto.randomUUID();
        const r = await createSongAction({
          id,
          title: saveTitle,
          artist: saveArtist,
          key: saveKey,
          capo: saveCapo,
          bpm: saveBpm,
          content,
        });
        if (r.ok) {
          setResult({ ok: true, msg: '저장 완료!' });
          setTimeout(() => router.push(ROUTES.songs), 800);
        } else {
          setResult({ ok: false, msg: `저장 실패: ${r.error}` });
        }
        return;
      }

      if (mode === 'create-request') {
        const r = await requestSongCreateAction(requestPatch);
        if (r.ok) {
          setResult({
            ok: true,
            msg: '추가 요청을 보냈습니다. 관리자 검토 후 카탈로그에 반영됩니다.',
          });
          setTimeout(() => router.push(ROUTES.my), 1200);
        } else {
          setResult({ ok: false, msg: `요청 실패: ${r.error}` });
        }
        return;
      }
    });
  }

  const saveLabel = (() => {
    if (isPending) return mode === 'create-request' || mode === 'edit-request' ? '요청 중…' : '저장 중…';
    if (mode === 'create-request') return '추가 요청';
    if (mode === 'edit-request') return '수정 요청';
    return '저장';
  })();

  const content = generateContent(title, artist, key, gender, capo, bpm, sections);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() =>
              isEdit && editSongId ? router.push(ROUTES.viewer(editSongId)) : router.back()
            }
            aria-label="뒤로가기"
            className="text-gray-400 text-lg px-1"
          >
            ←
          </button>
          <h1 className="flex-1 text-base font-bold">
            {isEdit
              ? mode === 'edit-request'
                ? '악보 수정 요청'
                : '악보 편집'
              : mode === 'create-request'
                ? '악보 추가 요청'
                : '새 악보 작성'}
          </h1>
          {!showCode && (
            <button
              onClick={() => setShowPreview((p) => !p)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                showPreview ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              미리보기
            </button>
          )}
          <button
            onClick={showCode ? exitCode : enterCode}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
              showCode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'
            }`}
          >
            코드
          </button>
          <button
            onClick={save}
            disabled={isPending || mode === 'none'}
            className={`text-xs px-4 py-1.5 rounded-full font-bold text-white disabled:opacity-50 ${
              isRequestMode ? 'bg-amber-600' : 'bg-indigo-600'
            }`}
          >
            {saveLabel}
          </button>
        </div>
        {result && (
          <div
            className={`text-center text-xs py-1.5 px-4 ${
              result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {result.msg}
          </div>
        )}
      </div>

      {showCode && (
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-2 h-[calc(100vh-64px)]">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            코드 편집 — 수정 후 코드 버튼을 다시 눌러 반영
          </p>
          <textarea
            value={codeText}
            onChange={(e) => setCodeText(e.target.value)}
            spellCheck={false}
            className="flex-1 bg-gray-900 text-green-300 font-mono text-[13px] leading-relaxed rounded-2xl p-4 outline-none resize-none"
          />
        </div>
      )}

      {!showCode && (
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-5">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 flex flex-col gap-3">
            <MetaField label="제목" value={title} onChange={setTitle} placeholder="곡 제목" />
            <MetaField
              label="아티스트"
              value={artist}
              onChange={setArtist}
              placeholder="아티스트명"
            />
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  키
                </label>
                <select
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-400 bg-white"
                >
                  {MUSIC_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  성별
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white"
                >
                  <option value="">미지정</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  카포
                </label>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={capo}
                  onChange={(e) => setCapo(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  BPM
                </label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {!supabaseConfigured && !isEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
              <strong>Supabase 미연결:</strong> 저장 시 악보 텍스트를 클립보드에 복사합니다.
            </div>
          )}

          {supabaseConfigured && !sessionLoading && !isAuthenticated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed flex items-center justify-between gap-3">
              <span>
                <strong>로그인 필요:</strong> 곡 {isEdit ? '편집을' : '추가를'} 저장하려면 로그인하세요.
              </span>
              <button
                onClick={() => signInWithGoogle()}
                className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-600 text-white"
              >
                로그인
              </button>
            </div>
          )}

          {isAuthenticated && isRequestMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
              <strong>변경 요청:</strong> 카탈로그에 직접 반영되지 않고 관리자에게 요청이 전달됩니다.
              관리자가 승인해야 적용돼요.
            </div>
          )}

          {sections.map((sec, si) => (
            <div
              key={sec.id}
              ref={(el) => {
                sectionRefs.current[si] = el;
              }}
              className={`${secDragFrom === si ? 'opacity-40' : ''} ${
                secDragOver === si && secDragFrom !== si ? 'ring-2 ring-indigo-300 rounded-2xl' : ''
              }`}
            >
              <SectionEditor
                section={sec}
                sectionCount={sections.length}
                onNameChange={(name) => editor.updateSection(si, { name })}
                onRemoveSection={() => editor.removeSection(si)}
                onAddRow={() => editor.addRow(si)}
                onRemoveRow={(ri) => editor.removeRow(si, ri)}
                onMoveRow={(from, to) => editor.moveRow(si, from, to)}
                onMeasureChange={(ri, mi, patch) => editor.updateMeasure(si, ri, mi, patch)}
                onChordBatch={(ri, chords) => editor.batchUpdateChords(si, ri, chords)}
                dragHandleProps={{
                  onPointerDown: (e) => handleSecDragDown(e, si),
                  onPointerMove: handleSecDragMove,
                  onPointerUp: handleSecDragUp,
                  onPointerCancel: () => {
                    setSecDragFrom(null);
                    setSecDragOver(null);
                  },
                }}
              />
            </div>
          ))}

          <button
            onClick={editor.addSection}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 font-semibold hover:border-indigo-300 hover:text-indigo-500 transition-colors"
          >
            + 구간 추가
          </button>

          {showPreview && (
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">
                생성된 악보 텍스트
              </p>
              <pre className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
                {content}
              </pre>
            </div>
          )}

          <div className="h-10" />
        </div>
      )}
    </div>
  );
}

function MetaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
      />
    </div>
  );
}
