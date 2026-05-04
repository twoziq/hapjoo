'use client';

import { useEffect, useRef, useState } from 'react';
import chordDB from '@/data/chords.json';
import DiagramSVG from '@/components/ChordDiagram/DiagramSVG';
import type { ChordEntry } from '@/components/ChordDiagram/types';
import { useSession } from '@/lib/hooks/useSession';
import { supabaseConfigured } from '@/lib/supabase/client';
import { deleteChord, fetchAllChords, upsertChord } from '@/lib/db/chords';

const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

const TYPES = [
  { suffix: '', label: 'Major' },
  { suffix: 'm', label: 'Minor' },
  { suffix: '7', label: '7' },
  { suffix: 'm7', label: 'm7' },
  { suffix: 'maj7', label: 'Maj7' },
  { suffix: 'sus4', label: 'sus4' },
  { suffix: 'dim', label: 'dim' },
  { suffix: 'aug', label: 'aug' },
] as const;

interface DragState { x: number; y: number; }
const SWIPE_THRESHOLD = 30;

const staticDB = chordDB as Record<string, ChordEntry>;

export default function ChordsPage() {
  const [rootIdx, setRootIdx] = useState(4); // G
  const [typeIdx, setTypeIdx] = useState(0);
  const [dbChords, setDbChords] = useState<Record<string, ChordEntry>>(staticDB);
  const { isAdmin, isManager } = useSession();

  const [editMode, setEditMode] = useState(false);
  const [frets, setFrets] = useState('');
  const [fingers, setFingers] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchAllChords().then((data) => {
      if (Object.keys(data).length > 0) setDbChords({ ...staticDB, ...data });
    });
  }, []);

  const chordName = ROOTS[rootIdx] + TYPES[typeIdx].suffix;
  const chordData = dbChords[chordName];

  useEffect(() => {
    setEditMode(false);
    setMsg(null);
  }, [chordName]);

  function enterEdit() {
    setFrets(chordData?.frets ?? '');
    setFingers(chordData?.fingers ?? '');
    setMsg(null);
    setEditMode(true);
  }

  async function handleSave() {
    if (!/^[x0-9]{6}$/.test(frets)) {
      setMsg({ ok: false, text: '프렛은 6자리 (x 또는 0-9)로 입력하세요.' });
      return;
    }
    setSaving(true);
    try {
      await upsertChord({ name: chordName, frets, fingers: fingers || undefined });
      setDbChords((prev) => ({
        ...prev,
        [chordName]: { ...prev[chordName], frets, fingers: fingers || undefined },
      }));
      setMsg({ ok: true, text: '저장 완료!' });
      setEditMode(false);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`${chordName} 코드를 삭제할까요?`)) return;
    setSaving(true);
    try {
      await deleteChord(chordName);
      setDbChords((prev) => {
        const next = { ...prev };
        delete next[chordName];
        return next;
      });
      setMsg({ ok: true, text: '삭제 완료!' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '삭제 실패' });
    } finally {
      setSaving(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < SWIPE_THRESHOLD && ady < SWIPE_THRESHOLD) return;
    if (adx >= ady) {
      setTypeIdx((i) => (i + (dx < 0 ? 1 : -1) + TYPES.length) % TYPES.length);
    } else {
      setRootIdx((i) => (i + (dy < 0 ? 1 : -1) + ROOTS.length) % ROOTS.length);
    }
  }

  function onPointerCancel() { drag.current = null; }

  return (
    <div className="flex h-full overflow-hidden select-none">
      <div className="flex flex-col shrink-0 w-11 border-r border-gray-200 bg-gray-50">
        {ROOTS.map((r, i) => (
          <button
            key={r}
            onClick={() => setRootIdx(i)}
            className={`flex-1 flex items-center justify-center font-bold text-sm transition-colors ${
              i === rootIdx
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-100 active:bg-gray-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div
        className="flex-1 flex flex-col min-w-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        <div className="flex overflow-x-auto shrink-0 border-b border-gray-200 bg-white scrollbar-none">
          {TYPES.map((t, i) => (
            <button
              key={t.suffix}
              onClick={() => setTypeIdx(i)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                i === typeIdx
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-3 overflow-y-auto">
          <div className="text-center">
            <h2 className="text-5xl font-black tracking-tight">{chordName}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{TYPES[typeIdx].label}</p>
          </div>

          {chordData ? (
            <>
              <DiagramSVG frets={chordData.frets} size={1.15} />
              <p className="font-mono text-xs text-gray-300 tracking-[0.25em]">{chordData.frets}</p>

              {chordData.alternatives && chordData.alternatives.length > 0 && (
                <div className="w-full mt-3 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center mb-3">대체 코드</p>
                  <div className="flex justify-center gap-8 flex-wrap">
                    {chordData.alternatives.map((v, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <DiagramSVG frets={v.frets} />
                        <p className="text-[11px] text-gray-400">{v.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-300 text-lg mt-8">{chordName} 코드 데이터 없음</p>
          )}

          {msg && (
            <p className={`text-xs font-semibold ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>
              {msg.text}
            </p>
          )}

          {isManager && supabaseConfigured && !editMode && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={enterEdit}
                className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold"
              >
                {chordData ? '편집' : '+ 등록'}
              </button>
              {isAdmin && chordData && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-full bg-red-50 text-red-400 text-xs font-semibold"
                >
                  삭제
                </button>
              )}
            </div>
          )}

          {editMode && (
            <div className="w-full max-w-xs flex flex-col gap-3 mt-2 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  프렛 (6자리, x=뮤트)
                </label>
                <input
                  value={frets}
                  onChange={(e) => setFrets(e.target.value.toLowerCase())}
                  placeholder="예: 320003"
                  maxLength={6}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  손가락 (선택, 6자리)
                </label>
                <input
                  value={fingers}
                  onChange={(e) => setFingers(e.target.value)}
                  placeholder="예: 210003"
                  maxLength={6}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditMode(false); setMsg(null); }}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
