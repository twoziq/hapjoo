'use client';

import { useEffect, useRef, useState } from 'react';
import chordDB from '@/data/chords.json';
import DiagramSVG from '@/components/ChordDiagram/DiagramSVG';
import type { ChordEntry } from '@/components/ChordDiagram/types';
import { useSession } from '@/lib/hooks/useSession';
import { supabaseConfigured } from '@/lib/supabase/client';
import { deleteChord, fetchAllChords, upsertChord } from '@/lib/db/chords';
import ChordEditor, { type AltEntry } from './ChordEditor';

const ROOTS_NATURAL = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const ROOTS_ALL = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

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
  const [flatMode, setFlatMode] = useState(false);
  const ROOTS = flatMode ? ROOTS_ALL : ROOTS_NATURAL;

  const [rootIdx, setRootIdx] = useState(4); // G (in natural mode)
  const [typeIdx, setTypeIdx] = useState(0);
  const [dbChords, setDbChords] = useState<Record<string, ChordEntry>>(staticDB);
  const { isAdmin, isManager } = useSession();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchAllChords().then((data) => {
      if (Object.keys(data).length > 0) setDbChords({ ...staticDB, ...data });
    });
  }, []);

  // Clamp rootIdx when switching modes
  function toggleFlatMode() {
    setFlatMode((prev) => {
      if (!prev) {
        // natural → full: remap index
        const curRoot = ROOTS_NATURAL[rootIdx];
        const newIdx = ROOTS_ALL.indexOf(curRoot as (typeof ROOTS_ALL)[number]);
        setRootIdx(newIdx >= 0 ? newIdx : 0);
      } else {
        // full → natural: snap to nearest natural
        const curRoot = ROOTS_ALL[rootIdx];
        const naturalIdx = ROOTS_NATURAL.indexOf(curRoot as (typeof ROOTS_NATURAL)[number]);
        setRootIdx(naturalIdx >= 0 ? naturalIdx : 0);
      }
      return !prev;
    });
    setEditMode(false);
  }

  const chordName = ROOTS[rootIdx] + TYPES[typeIdx].suffix;
  const chordData = dbChords[chordName];

  useEffect(() => {
    setEditMode(false);
    setMsg(null);
  }, [chordName]);

  async function handleSave(
    frets: string,
    fingers: string,
    startFret: number,
    alternatives: AltEntry[],
  ) {
    setSaving(true);
    try {
      const altPayload = alternatives.map((a) => ({
        frets: a.frets,
        fingers: a.fingers || undefined,
        label: a.label || undefined,
      }));
      await upsertChord({
        name: chordName,
        frets,
        fingers: fingers || undefined,
        alternatives: altPayload.length > 0 ? altPayload : undefined,
      });
      setDbChords((prev) => ({
        ...prev,
        [chordName]: {
          ...prev[chordName],
          frets,
          fingers: fingers || undefined,
          alternatives: altPayload,
        },
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
    if (editMode) return;
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
      {/* Root picker */}
      <div className="flex flex-col shrink-0 w-11 border-r border-gray-200 bg-gray-50 relative">
        {ROOTS.map((r, i) => (
          <button
            key={r}
            onClick={() => setRootIdx(i)}
            className={`flex-1 flex items-center justify-center font-bold text-xs transition-colors ${
              i === rootIdx
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-100 active:bg-gray-200'
            }`}
          >
            {r}
          </button>
        ))}
        {/* Flat/sharp toggle */}
        <button
          onClick={toggleFlatMode}
          className={`shrink-0 h-8 flex items-center justify-center text-[11px] font-bold border-t border-gray-200 transition-colors ${
            flatMode ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-100'
          }`}
          title={flatMode ? '7음 모드로' : '12음 모드로'}
        >
          ♭♯
        </button>
      </div>

      {/* Main area */}
      <div
        className="flex-1 flex flex-col min-w-0 touch-none select-none relative"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        {/* Type tabs */}
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {editMode ? (
            <ChordEditor
              chordName={chordName}
              initialFrets={chordData?.frets ?? 'xxxxxx'}
              initialFingers={chordData?.fingers ?? ''}
              initialStartFret={0}
              initialAlternatives={chordData?.alternatives ?? []}
              onSave={handleSave}
              onCancel={() => { setEditMode(false); setMsg(null); }}
              saving={saving}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <h2 className="text-5xl font-black tracking-tight">{chordName}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{TYPES[typeIdx].label}</p>
              </div>

              {chordData ? (
                <>
                  <DiagramSVG
                    frets={chordData.frets}
                    fingers={chordData.fingers}
                    size={1.15}
                  />
                  <p className="font-mono text-xs text-gray-300 tracking-[0.25em]">{chordData.frets}</p>

                  {chordData.alternatives && chordData.alternatives.length > 0 && (
                    <div className="w-full mt-3 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400 text-center mb-3">대체 코드</p>
                      <div className="flex flex-col gap-6">
                        {chordData.alternatives.map((v, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <DiagramSVG
                              frets={v.frets}
                              fingers={v.fingers}
                              size={1}
                            />
                            {v.label && (
                              <p className="text-[11px] text-gray-400">{v.label}</p>
                            )}
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
            </div>
          )}
        </div>

        {/* Manager edit controls (bottom-right) */}
        {isManager && supabaseConfigured && !editMode && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-10">
            {isAdmin && chordData && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 rounded-full bg-red-50 text-red-400 text-xs font-semibold shadow border border-red-100"
              >
                삭제
              </button>
            )}
            <button
              onClick={() => { setEditMode(true); setMsg(null); }}
              className="px-4 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold shadow"
            >
              {chordData ? '편집' : '+ 등록'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
