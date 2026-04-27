'use client';

import { useRef, useState } from 'react';
import chordDB from '@/data/chords.json';
import DiagramSVG from '@/components/ChordDiagram/DiagramSVG';
import type { ChordEntry } from '@/components/ChordDiagram/types';

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

interface DragState {
  x: number;
  y: number;
}

const SWIPE_THRESHOLD = 30;

export default function ChordsPage() {
  const [rootIdx, setRootIdx] = useState(4); // G
  const [typeIdx, setTypeIdx] = useState(0);

  const drag = useRef<DragState | null>(null);

  const chordTable = chordDB as Record<string, ChordEntry>;
  const chordName = ROOTS[rootIdx] + TYPES[typeIdx].suffix;
  const chordData = chordTable[chordName];

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

  function onPointerCancel() {
    drag.current = null;
  }

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
        className="flex-1 flex flex-col min-w-0 touch-none select-none relative"
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

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-3">
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

          <div className="absolute bottom-20 left-0 right-0 flex items-center justify-between px-3 pointer-events-none">
            <div className="flex flex-col items-center gap-0.5 opacity-70">
              <span className="text-base font-black text-gray-700">↑</span>
              <span className="text-[10px] font-semibold text-gray-600">근음</span>
              <span className="text-base font-black text-gray-700">↓</span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              좌우: 코드 타입 &nbsp;·&nbsp; 위아래: 근음
            </p>
            <div className="flex items-center gap-1 opacity-70">
              <span className="text-base font-black text-gray-700">←</span>
              <span className="text-[10px] font-semibold text-gray-600">타입</span>
              <span className="text-base font-black text-gray-700">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
