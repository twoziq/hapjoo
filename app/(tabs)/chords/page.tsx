'use client';

import { useState, useRef } from 'react';
import chordDB from '@/data/chords.json';

const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const TYPES = [
  { suffix: '',     label: 'Major' },
  { suffix: 'm',    label: 'Minor' },
  { suffix: '7',    label: '7'     },
  { suffix: 'm7',   label: 'm7'    },
  { suffix: 'maj7', label: 'Maj7'  },
  { suffix: 'sus4', label: 'sus4'  },
  { suffix: 'dim',  label: 'dim'   },
  { suffix: 'aug',  label: 'aug'   },
];

const STRINGS = 6;
const FRETS_SHOW = 5;

function DiagramSVG({ frets, size = 1 }) {
  const cW = 28 * size, cH = 24 * size;
  const ox = 20 * size, oy = 28 * size;
  const W = ox + cW * (STRINGS - 1) + 20 * size;
  const H = oy + cH * FRETS_SHOW + 10 * size;

  const notes = (frets || 'xxxxxx').split('');
  const nums = notes.filter(f => f !== 'x' && f !== '0').map(Number);
  const minFret = nums.length ? Math.min(...nums) : 1;
  const hasOpen = notes.some(f => f === '0');
  const start = (hasOpen || minFret <= 1) ? 1 : minFret;
  const showNut = start === 1;

  return (
    <svg width={W} height={H} className="overflow-visible">
      {showNut
        ? <line x1={ox} y1={oy} x2={ox + cW * (STRINGS - 1)} y2={oy} stroke="#1f2937" strokeWidth={3 * size} strokeLinecap="round" />
        : <text x={ox - 4} y={oy + cH * 0.7} fontSize={9 * size} fill="#9ca3af" textAnchor="end">{start}fr</text>
      }
      {Array.from({ length: FRETS_SHOW + 1 }).map((_, i) => (
        <line key={i} x1={ox} y1={oy + cH * i} x2={ox + cW * (STRINGS - 1)} y2={oy + cH * i} stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {Array.from({ length: STRINGS }).map((_, i) => (
        <line key={i} x1={ox + cW * i} y1={oy} x2={ox + cW * i} y2={oy + cH * FRETS_SHOW} stroke="#d1d5db" strokeWidth={1} />
      ))}
      {notes.map((f, i) => {
        const x = ox + cW * i;
        if (f === 'x') return <text key={i} x={x} y={oy - 10 * size} textAnchor="middle" fontSize={13 * size} fill="#ef4444" fontWeight="bold">×</text>;
        if (f === '0') return <circle key={i} cx={x} cy={oy - 11 * size} r={5 * size} fill="none" stroke="#374151" strokeWidth={1.5} />;
        const rel = parseInt(f, 10) - start + 1;
        if (rel < 1 || rel > FRETS_SHOW) return null;
        return <circle key={i} cx={x} cy={oy + cH * (rel - 1) + cH / 2} r={9 * size} fill="#1f2937" />;
      })}
    </svg>
  );
}

export default function ChordsPage() {
  const [rootIdx, setRootIdx] = useState(4); // G
  const [typeIdx, setTypeIdx] = useState(0);

  const drag = useRef(null);

  const chordName = ROOTS[rootIdx] + TYPES[typeIdx].suffix;
  const chordData = chordDB[chordName];

  // Both-axis swipe: horizontal = type, vertical = root
  function onPointerDown(e) {
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx < 30 && ady < 30) return; // tap, ignore
    if (adx >= ady) {
      // Horizontal → type
      setTypeIdx(i => (i + (dx < 0 ? 1 : -1) + TYPES.length) % TYPES.length);
    } else {
      // Vertical → root (swipe up = next root, swipe down = prev root)
      setRootIdx(i => (i + (dy < 0 ? 1 : -1) + ROOTS.length) % ROOTS.length);
    }
  }
  function onPointerCancel() { drag.current = null; }

  return (
    <div className="flex h-full overflow-hidden select-none">

      {/* ── Left sidebar: root picker ── */}
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

      {/* ── Right: type tabs + diagram (swipeable) ── */}
      <div
        className="flex-1 flex flex-col min-w-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        {/* Type tab strip */}
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

        {/* Chord diagram */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-3">
          <div className="text-center">
            <h2 className="text-5xl font-black tracking-tight">{chordName}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{TYPES[typeIdx].label}</p>
          </div>

          {chordData ? (
            <>
              <DiagramSVG frets={chordData.frets} size={1.15} />
              <p className="font-mono text-xs text-gray-300 tracking-[0.25em]">{chordData.frets}</p>

              {chordData.alternatives?.length > 0 && (
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

          {/* Swipe hints */}
          <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
            <p className="text-[11px] text-gray-200">← 좌우: 코드 타입 &nbsp;·&nbsp; 위아래: 근음 →</p>
          </div>
        </div>
      </div>
    </div>
  );
}
