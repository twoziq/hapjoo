'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { dbInsertSong, supabaseConfigured } from '@/lib/supabase';

interface Measure  { chord: string; lyric: string; }
interface Row      { id: string; measures: Measure[]; }
interface Section  { id: string; name: string; rows: Row[]; }

const KEYS    = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const GENDERS = ['남', '여'] as const;

const uid = () => Math.random().toString(36).slice(2, 8);
const emptyMeasure = (): Measure => ({ chord: '', lyric: '' });
const emptyRow     = (): Row => ({ id: uid(), measures: [emptyMeasure(), emptyMeasure(), emptyMeasure(), emptyMeasure()] });
const emptySection = (name = ''): Section => ({ id: uid(), name, rows: [emptyRow()] });

// ── Smart chord input ─────────────────────────────────────────────────────────
// "GDEmC"   → ['G','D','Em','C']
// "G..Em"   → ['G','','','Em']
// "G.Em."   → ['G','','Em','']
const CHORD_RX = /[A-G][b#]?(?:maj7?|m7?|7|9|11|13|sus[24]?|dim7?|aug|add[0-9]+)*(?:\/[A-G][b#]?)?/gi;

function parseSmartChord(raw: string): string[] | null {
  const val = raw.trim();
  if (!val) return null;

  if (val.includes('.')) {
    const result = ['', '', '', ''];
    let pos = 0; let i = 0;
    while (i < val.length && pos < 4) {
      if (val[i] === '.') { pos++; i++; continue; }
      const m = val.slice(i).match(new RegExp('^(' + CHORD_RX.source + ')', 'i'));
      if (m) { result[pos] = m[1].toUpperCase(); pos++; i += m[1].length; }
      else i++;
    }
    return result;
  }

  const matches = [...val.matchAll(CHORD_RX)].map(m => m[0]);
  if (matches.length < 2) return null; // single chord — no distribution needed

  const result = ['', '', '', ''];
  matches.slice(0, 4).forEach((c, i) => { result[i] = c; });
  return result;
}

function generateContent(title: string, artist: string, key: string, gender: string, capo: number, bpm: number, sections: Section[]): string {
  const front = [
    '---',
    `title: ${title}`,
    `artist: ${artist}`,
    `key: ${key}`,
    gender ? `gender: ${gender}` : '',
    `capo: ${capo}`,
    `bpm: ${bpm}`,
    '---',
  ].filter(Boolean).join('\n') + '\n';

  const body = sections.map(sec => {
    const header = `[${sec.name || '구간'}]`;
    const rows = sec.rows.map(row => {
      const parts = row.measures.map(m => m.chord ? `${m.chord} ${m.lyric}`.trim() : m.lyric);
      return parts.join(' / ') + ' //';
    });
    return [header, ...rows].join('\n');
  }).join('\n\n');

  return front + '\n' + body + '\n';
}

function slugify(text: string): string {
  return text.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w가-힣]/g, '')
    .slice(0, 40)
    || `song_${uid()}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewSongPage() {
  const router = useRouter();

  const [title,    setTitle]    = useState('');
  const [artist,   setArtist]   = useState('');
  const [key,      setKey]      = useState('G');
  const [gender,   setGender]   = useState('');
  const [capo,     setCapo]     = useState(0);
  const [bpm,      setBpm]      = useState(80);
  const [sections, setSections] = useState<Section[]>([emptySection('Verse')]);
  const [showPreview, setShowPreview] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  function updateSection(si: number, patch: Partial<Section>) {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, ...patch } : s));
  }
  function addSection() { setSections(prev => [...prev, emptySection()]); }
  function removeSection(si: number) { setSections(prev => prev.filter((_, i) => i !== si)); }

  function addRow(si: number) {
    setSections(prev => prev.map((s, i) => i === si ? { ...s, rows: [...s.rows, emptyRow()] } : s));
  }
  function removeRow(si: number, ri: number) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = s.rows.filter((_, j) => j !== ri);
      return { ...s, rows: rows.length ? rows : [emptyRow()] };
    }));
  }
  function moveRow(si: number, from: number, to: number) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = [...s.rows];
      const [removed] = rows.splice(from, 1);
      rows.splice(to, 0, removed);
      return { ...s, rows };
    }));
  }
  function updateMeasure(si: number, ri: number, mi: number, patch: Partial<Measure>) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = s.rows.map((r, j) => {
        if (j !== ri) return r;
        const measures = r.measures.map((m, k) => k === mi ? { ...m, ...patch } : m);
        return { ...r, measures };
      });
      return { ...s, rows };
    }));
  }
  function batchUpdateChords(si: number, ri: number, chords: string[]) {
    setSections(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const rows = s.rows.map((r, j) => {
        if (j !== ri) return r;
        const measures = r.measures.map((m, k) => ({ ...m, chord: chords[k] ?? '' }));
        return { ...r, measures };
      });
      return { ...s, rows };
    }));
  }

  async function save() {
    if (!title.trim()) { setResult({ ok: false, msg: '제목을 입력해주세요.' }); return; }
    setSaving(true); setResult(null);
    const content = generateContent(title, artist, key, gender, capo, bpm, sections);
    const id = slugify(title);

    if (supabaseConfigured) {
      const err = await dbInsertSong({ id, title, artist, key, capo, bpm, content });
      if (err) {
        setResult({ ok: false, msg: `저장 실패: ${err}` });
      } else {
        setResult({ ok: true, msg: '저장 완료!' });
        setTimeout(() => router.push('/songs'), 800);
      }
    } else {
      try {
        await navigator.clipboard.writeText(content);
        setResult({ ok: true, msg: '악보 텍스트가 클립보드에 복사됐습니다. data/songs/ 폴더에 .ts 파일로 붙여넣어 추가하세요.' });
      } catch {
        setResult({ ok: false, msg: '클립보드 복사 실패. 미리보기에서 직접 복사해주세요.' });
        setShowPreview(true);
      }
    }
    setSaving(false);
  }

  const content = generateContent(title, artist, key, gender, capo, bpm, sections);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 text-lg px-1">←</button>
          <h1 className="flex-1 text-base font-bold">새 악보 작성</h1>
          <button
            onClick={() => setShowPreview(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold ${showPreview ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}
          >미리보기</button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-4 py-1.5 rounded-full font-bold bg-indigo-600 text-white disabled:opacity-50"
          >{saving ? '저장 중…' : '저장'}</button>
        </div>
        {result && (
          <div className={`text-center text-xs py-1.5 px-4 ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {result.msg}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-5">

        {/* Meta */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex flex-col gap-3">
          <MetaField label="제목"      value={title}  onChange={setTitle}  placeholder="곡 제목" />
          <MetaField label="아티스트"  value={artist} onChange={setArtist} placeholder="아티스트명" />
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">키</label>
              <select value={key} onChange={e => setKey(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-400 bg-white">
                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">성별</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white">
                <option value="">미지정</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">카포</label>
              <input type="number" min={0} max={7} value={capo} onChange={e => setCapo(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">BPM</label>
              <input type="number" min={20} max={300} value={bpm} onChange={e => setBpm(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
        </div>

        {!supabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
            <strong>Supabase 미연결:</strong> 저장 시 악보 텍스트를 클립보드에 복사합니다.
          </div>
        )}

        {sections.map((sec, si) => (
          <SectionEditor
            key={sec.id}
            section={sec}
            sectionIdx={si}
            sectionCount={sections.length}
            onNameChange={name => updateSection(si, { name })}
            onRemoveSection={() => removeSection(si)}
            onAddRow={() => addRow(si)}
            onRemoveRow={ri => removeRow(si, ri)}
            onMoveRow={(from, to) => moveRow(si, from, to)}
            onMeasureChange={(ri, mi, patch) => updateMeasure(si, ri, mi, patch)}
            onChordBatch={(ri, chords) => batchUpdateChords(si, ri, chords)}
          />
        ))}

        <button onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 font-semibold hover:border-indigo-300 hover:text-indigo-500 transition-colors">
          + 구간 추가
        </button>

        {showPreview && (
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">생성된 악보 텍스트</p>
            <pre className="text-[11px] text-green-300 font-mono leading-relaxed whitespace-pre-wrap break-all">{content}</pre>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}

// ── MetaField ─────────────────────────────────────────────────────────────────
function MetaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
    </div>
  );
}

// ── SectionEditor ─────────────────────────────────────────────────────────────
function SectionEditor({ section, sectionIdx, sectionCount, onNameChange, onRemoveSection, onAddRow, onRemoveRow, onMoveRow, onMeasureChange, onChordBatch }: {
  section: Section;
  sectionIdx: number;
  sectionCount: number;
  onNameChange: (name: string) => void;
  onRemoveSection: () => void;
  onAddRow: () => void;
  onRemoveRow: (ri: number) => void;
  onMoveRow: (from: number, to: number) => void;
  onMeasureChange: (ri: number, mi: number, patch: Partial<Measure>) => void;
  onChordBatch: (ri: number, chords: string[]) => void;
}) {
  const [dragFromRi, setDragFromRi] = useState<number | null>(null);
  const [dragOverRi, setDragOverRi] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleRowDragDown(e: React.PointerEvent, ri: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragFromRi(ri);
    setDragOverRi(ri);
  }

  function handleRowDragMove(e: React.PointerEvent) {
    if (dragFromRi === null) return;
    const y = e.clientY;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) { setDragOverRi(i); break; }
    }
  }

  function handleRowDragUp() {
    if (dragFromRi !== null && dragOverRi !== null && dragFromRi !== dragOverRi) {
      onMoveRow(dragFromRi, dragOverRi);
    }
    setDragFromRi(null);
    setDragOverRi(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] text-gray-400 font-semibold uppercase">[</span>
        <input
          value={section.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="구간 이름 (예: Chorus, Verse)"
          className="flex-1 text-sm font-bold text-indigo-600 bg-transparent outline-none placeholder:text-gray-300"
        />
        <span className="text-[10px] text-gray-400 font-semibold uppercase">]</span>
        {sectionCount > 1 && (
          <button onClick={onRemoveSection} className="text-xs text-red-400 hover:text-red-600 ml-1 px-1">✕</button>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y divide-gray-100">
        {section.rows.map((row, ri) => (
          <div
            key={row.id}
            ref={el => { rowRefs.current[ri] = el; }}
            className={`${dragFromRi === ri ? 'opacity-40' : ''} ${dragOverRi === ri && dragFromRi !== ri ? 'ring-2 ring-inset ring-indigo-300' : ''}`}
          >
            <RowEditor
              row={row}
              rowIdx={ri}
              totalRows={section.rows.length}
              onRemove={() => onRemoveRow(ri)}
              onChange={(mi, patch) => onMeasureChange(ri, mi, patch)}
              onChordBatch={chords => onChordBatch(ri, chords)}
              dragHandleProps={{
                onPointerDown: e => handleRowDragDown(e, ri),
                onPointerMove: handleRowDragMove,
                onPointerUp:   handleRowDragUp,
                onPointerCancel: () => { setDragFromRi(null); setDragOverRi(null); },
              }}
            />
          </div>
        ))}
      </div>

      <button onClick={onAddRow}
        className="w-full py-2 text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors font-semibold">
        + 줄 추가
      </button>
    </div>
  );
}

// ── RowEditor ─────────────────────────────────────────────────────────────────
function RowEditor({ row, rowIdx, totalRows, onRemove, onChange, onChordBatch, dragHandleProps }: {
  row: Row;
  rowIdx: number;
  totalRows: number;
  onRemove: () => void;
  onChange: (mi: number, patch: Partial<Measure>) => void;
  onChordBatch: (chords: string[]) => void;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
}) {
  function handleChord0Blur(e: React.FocusEvent<HTMLInputElement>) {
    const parsed = parseSmartChord(e.target.value);
    if (parsed) onChordBatch(parsed);
  }

  return (
    <div className="flex items-start gap-1 px-2 py-2 group">
      {/* Drag handle */}
      <div
        className="mt-1.5 cursor-grab active:cursor-grabbing touch-none select-none text-gray-300 text-base w-5 text-center shrink-0"
        {...dragHandleProps}
      >⠿</div>

      {/* 4-column grid: row1 = chords, row2 = lyrics */}
      <div className="flex-1 grid gap-px"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto auto' }}
      >
        {/* Chord inputs */}
        {row.measures.map((m, mi) => (
          <input
            key={`c_${mi}`}
            type="text"
            value={m.chord}
            tabIndex={-1}
            onChange={e => onChange(mi, { chord: e.target.value.toUpperCase() })}
            onBlur={mi === 0 ? handleChord0Blur : undefined}
            onClick={e => (e.currentTarget as HTMLInputElement).focus()}
            placeholder={['G', 'D', 'Em', 'Am'][mi]}
            style={{ gridColumn: mi + 1, gridRow: 1 }}
            className="bg-indigo-50 text-indigo-700 font-bold text-sm rounded-t px-1 py-1.5 outline-none focus:bg-indigo-100 placeholder:text-indigo-200 placeholder:font-normal w-full"
          />
        ))}
        {/* Lyric inputs */}
        {row.measures.map((m, mi) => (
          <input
            key={`l_${mi}`}
            type="text"
            value={m.lyric}
            onChange={e => onChange(mi, { lyric: e.target.value })}
            placeholder="가사"
            style={{ gridColumn: mi + 1, gridRow: 2 }}
            className="bg-white text-gray-800 text-sm border-t border-gray-100 rounded-b px-1 py-1.5 outline-none focus:bg-gray-50 placeholder:text-gray-200 w-full"
          />
        ))}
      </div>

      {/* Remove button */}
      {totalRows > 1 && (
        <button
          onClick={onRemove}
          className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-[10px] text-gray-300 hover:text-red-400 shrink-0"
        >✕</button>
      )}
    </div>
  );
}
