'use client';

import { useRef, useState } from 'react';
import DiagramSVG from '@/components/ChordDiagram/DiagramSVG';

const STRINGS = 6;
const FRETS_SHOWN = 5;
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const LONG_PRESS_MS = 500;

export interface AltEntry {
  frets: string;
  fingers: string;
  startFret: number;
  label: string;
}

function parseSlots(frets: string): string[] {
  return (frets || 'xxxxxx').padEnd(6, 'x').slice(0, 6).split('');
}

function parseFingerArr(fingers: string): number[] {
  return (fingers || '').padEnd(6, '0').slice(0, 6).split('').map((n) => parseInt(n) || 0);
}

function slotsToFrets(slots: string[]): string {
  return slots.join('');
}

function fingersToStr(arr: number[]): string {
  return arr.join('');
}

interface GridProps {
  slots: string[];
  fingers: number[];
  startFret: number;
  onUpdate: (slots: string[], fingers: number[]) => void;
}

function DiagramGrid({ slots, fingers, startFret, onUpdate }: GridProps) {
  const pointerOrigin = useRef<{ row: number; str: number } | null>(null);
  const isDragging = useRef(false);
  const currentStr = useRef(-1);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const getFret = (row: number) => (startFret === 0 ? row + 1 : startFret + row);
  const showNut = startFret === 0;

  function clearLong() {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
  }

  function getStrFromPointer(e: React.PointerEvent, row: number): number {
    const el = rowRefs.current[row];
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const cellW = rect.width / STRINGS;
    return Math.max(0, Math.min(STRINGS - 1, Math.floor((e.clientX - rect.left) / cellW)));
  }

  function onRowPointerDown(row: number, e: React.PointerEvent) {
    e.preventDefault();
    const str = getStrFromPointer(e, row);
    if (str < 0) return;
    pointerOrigin.current = { row, str };
    isDragging.current = false;
    currentStr.current = str;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    longTimer.current = setTimeout(() => {
      const newSlots = [...slots];
      const newFingers = [...fingers];
      newSlots[str] = 'x';
      newFingers[str] = 0;
      onUpdate(newSlots, newFingers);
      pointerOrigin.current = null;
    }, LONG_PRESS_MS);
  }

  function onRowPointerMove(row: number, e: React.PointerEvent) {
    if (!pointerOrigin.current || pointerOrigin.current.row !== row) return;
    const str = getStrFromPointer(e, row);
    if (str !== currentStr.current && str >= 0) {
      isDragging.current = true;
      currentStr.current = str;
      clearLong();
    }
  }

  function onRowPointerUp(row: number) {
    clearLong();
    if (!pointerOrigin.current) return;
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    const fret = getFret(row);
    const newSlots = [...slots];
    const newFingers = [...fingers];

    if (isDragging.current && origin.row === row) {
      const minS = Math.min(origin.str, currentStr.current);
      const maxS = Math.max(origin.str, currentStr.current);
      for (let s = minS; s <= maxS; s++) {
        newSlots[s] = String(fret);
        newFingers[s] = 1;
      }
      // Remove barre finger from strings previously part of barre at this fret if now overridden
    } else {
      const str = origin.str;
      if (newSlots[str] === String(fret)) {
        newSlots[str] = 'x';
        newFingers[str] = 0;
      } else {
        newSlots[str] = String(fret);
        newFingers[str] = 0;
      }
    }

    isDragging.current = false;
    onUpdate(newSlots, newFingers);
  }

  function onHeaderClick(str: number) {
    const newSlots = [...slots];
    const newFingers = [...fingers];
    if (newSlots[str] === 'x') {
      newSlots[str] = '0';
    } else if (newSlots[str] === '0') {
      newSlots[str] = 'x';
    } else {
      newSlots[str] = 'x';
      newFingers[str] = 0;
    }
    onUpdate(newSlots, newFingers);
  }

  function onCellContextMenu(str: number, e: React.MouseEvent) {
    e.preventDefault();
    const newSlots = [...slots];
    const newFingers = [...fingers];
    newSlots[str] = 'x';
    newFingers[str] = 0;
    onUpdate(newSlots, newFingers);
  }

  return (
    <div className="select-none touch-none w-full">
      {/* String headers */}
      <div className="flex ml-6">
        {Array.from({ length: STRINGS }).map((_, str) => (
          <button
            key={str}
            type="button"
            className="flex-1 flex flex-col items-center py-1 gap-0.5"
            onClick={() => onHeaderClick(str)}
          >
            <span className="text-[9px] text-gray-300">{STRING_LABELS[str]}</span>
            <span
              className={`text-xs font-bold leading-none ${
                slots[str] === 'x'
                  ? 'text-red-500'
                  : slots[str] === '0'
                    ? 'text-gray-600'
                    : 'text-transparent'
              }`}
            >
              {slots[str] === 'x' ? '×' : slots[str] === '0' ? '○' : '·'}
            </span>
          </button>
        ))}
      </div>

      {/* Nut */}
      {showNut && <div className="ml-6 h-[3px] bg-gray-700 rounded-full mb-px" />}

      {/* Fret rows */}
      {Array.from({ length: FRETS_SHOWN }).map((_, row) => {
        const fret = getFret(row);
        return (
          <div key={row} className="flex items-stretch" style={{ height: '2.25rem' }}>
            {/* Fret label */}
            <div className="w-6 flex items-center justify-end pr-1 shrink-0">
              {row === 0 && startFret > 0 && (
                <span className="text-[8px] text-gray-400 font-mono">{startFret}fr</span>
              )}
            </div>

            {/* Cells row */}
            <div
              ref={(el) => { rowRefs.current[row] = el; }}
              className="flex flex-1 border-b border-gray-200 relative"
              style={{ borderTop: row === 0 && !showNut ? '1px solid #e5e7eb' : undefined }}
              onPointerDown={(e) => onRowPointerDown(row, e)}
              onPointerMove={(e) => onRowPointerMove(row, e)}
              onPointerUp={() => onRowPointerUp(row)}
              onPointerCancel={() => { clearLong(); pointerOrigin.current = null; isDragging.current = false; }}
            >
              {Array.from({ length: STRINGS }).map((_, str) => {
                const isActive = slots[str] === String(fret);
                const isBarre = isActive && fingers[str] === 1;
                const prevBarre = isBarre && str > 0 && slots[str - 1] === String(fret) && fingers[str - 1] === 1;
                const nextBarre = isBarre && str < STRINGS - 1 && slots[str + 1] === String(fret) && fingers[str + 1] === 1;

                return (
                  <div
                    key={str}
                    className="flex-1 relative flex items-center justify-center"
                    style={{ borderRight: str < STRINGS - 1 ? '1px solid #f3f4f6' : undefined }}
                    onContextMenu={(e) => onCellContextMenu(str, e)}
                  >
                    {/* String line */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-[0.5px] w-px bg-gray-200" />

                    {isActive && !isBarre && (
                      <div className="relative z-10 w-[1.2rem] h-[1.2rem] rounded-full bg-gray-900" />
                    )}

                    {isBarre && (
                      <div
                        className="relative z-10 bg-gray-900"
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: '1.2rem',
                          left: prevBarre ? 0 : '25%',
                          right: nextBarre ? 0 : '25%',
                          borderRadius: !prevBarre && !nextBarre
                            ? '9999px'
                            : !prevBarre
                              ? '9999px 0 0 9999px'
                              : !nextBarre
                                ? '0 9999px 9999px 0'
                                : '0',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AltEditorProps {
  entry: AltEntry;
  index: number;
  onChange: (entry: AltEntry) => void;
  onDelete: () => void;
}

function AltEditor({ entry, index, onChange, onDelete }: AltEditorProps) {
  const slots = parseSlots(entry.frets);
  const fingerArr = parseFingerArr(entry.fingers);

  return (
    <div className="border border-gray-200 rounded-2xl p-3 relative">
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 text-red-500 text-xs font-bold flex items-center justify-center"
        aria-label="대체코드 삭제"
      >
        ×
      </button>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
        대체코드 {index + 1}
      </p>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[10px] text-gray-400 shrink-0">레이블</label>
        <input
          value={entry.label}
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
          placeholder="예: 재즈, 간단"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400"
        />
        <label className="text-[10px] text-gray-400 shrink-0">시작프렛</label>
        <input
          type="number"
          min={0}
          max={9}
          value={entry.startFret}
          onChange={(e) => onChange({ ...entry, startFret: Math.max(0, Math.min(9, parseInt(e.target.value) || 0)) })}
          className="w-10 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-indigo-400 text-center"
        />
      </div>
      <DiagramGrid
        slots={slots}
        fingers={fingerArr}
        startFret={entry.startFret}
        onUpdate={(s, f) => onChange({ ...entry, frets: slotsToFrets(s), fingers: fingersToStr(f) })}
      />
    </div>
  );
}

interface Props {
  chordName: string;
  initialFrets: string;
  initialFingers: string;
  initialStartFret?: number;
  initialAlternatives?: { frets: string; fingers?: string; label?: string }[];
  onSave: (frets: string, fingers: string, startFret: number, alternatives: AltEntry[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function ChordEditor({
  chordName,
  initialFrets,
  initialFingers,
  initialStartFret = 0,
  initialAlternatives = [],
  onSave,
  onCancel,
  saving,
}: Props) {
  const [slots, setSlots] = useState<string[]>(() => parseSlots(initialFrets));
  const [fingerArr, setFingerArr] = useState<number[]>(() => parseFingerArr(initialFingers));
  const [startFret, setStartFret] = useState(initialStartFret);
  const [alts, setAlts] = useState<AltEntry[]>(() =>
    initialAlternatives.map((a) => ({
      frets: a.frets ?? 'xxxxxx',
      fingers: a.fingers ?? '000000',
      startFret: 0,
      label: a.label ?? '',
    })),
  );

  function handleUpdate(newSlots: string[], newFingers: number[]) {
    setSlots(newSlots);
    setFingerArr(newFingers);
  }

  function addAlt() {
    setAlts((prev) => [...prev, { frets: 'xxxxxx', fingers: '000000', startFret: 0, label: '' }]);
  }

  function updateAlt(i: number, entry: AltEntry) {
    setAlts((prev) => prev.map((a, idx) => (idx === i ? entry : a)));
  }

  function removeAlt(i: number) {
    setAlts((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main chord */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-700">{chordName}</p>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-400 font-semibold">시작 프렛</label>
            <input
              type="number"
              min={0}
              max={9}
              value={startFret}
              onChange={(e) => setStartFret(Math.max(0, Math.min(9, parseInt(e.target.value) || 0)))}
              className="w-12 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono outline-none focus:border-indigo-400 text-center bg-white"
            />
          </div>
        </div>

        <DiagramGrid
          slots={slots}
          fingers={fingerArr}
          startFret={startFret}
          onUpdate={handleUpdate}
        />

        <div className="mt-3 flex justify-center">
          <DiagramSVG
            frets={slotsToFrets(slots)}
            fingers={fingersToStr(fingerArr)}
            baseFret={startFret || undefined}
            size={0.85}
          />
        </div>
      </div>

      {/* Alternatives */}
      {alts.map((alt, i) => (
        <AltEditor
          key={i}
          entry={alt}
          index={i}
          onChange={(e) => updateAlt(i, e)}
          onDelete={() => removeAlt(i)}
        />
      ))}

      <button
        type="button"
        onClick={addAlt}
        className="w-full py-2.5 rounded-xl border border-dashed border-indigo-300 text-indigo-500 text-sm font-semibold"
      >
        + 대체코드 추가
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold"
        >
          취소
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(slotsToFrets(slots), fingersToStr(fingerArr), startFret, alts)}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
