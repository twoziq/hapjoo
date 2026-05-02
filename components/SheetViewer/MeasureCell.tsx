'use client';

import { memo, useRef, type RefObject } from 'react';

interface Props {
  cellKey: string;
  cellRefs: RefObject<Map<string, HTMLElement>>;
  isCurrent: boolean;
  cursorActive: boolean;
  isRest: boolean;
  chords: string[];
  lyric: string;
  note?: string;
  showNotes: boolean;
  onChordClick: (c: string) => void;
  onLongPress: () => void;
  onTap: () => void;
  roundedClass?: string;
}

const LONG_PRESS_MS = 500;

function MeasureCellImpl({
  cellKey,
  cellRefs,
  isCurrent,
  cursorActive,
  isRest,
  chords,
  lyric,
  note,
  showNotes,
  onChordClick,
  onLongPress,
  onTap,
  roundedClass,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (isRest) return;
    e.preventDefault();
    wasLongPress.current = false;
    timerRef.current = setTimeout(() => {
      wasLongPress.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    clearTimer();
    if (!wasLongPress.current) onTap();
  }

  function handlePointerCancel() {
    clearTimer();
    wasLongPress.current = false;
  }

  const setRef = (el: HTMLElement | null) => {
    const map = cellRefs.current;
    if (!map) return;
    if (el) map.set(cellKey, el);
    else map.delete(cellKey);
  };

  const cursorClass = isCurrent
    ? cursorActive
      ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400'
      : 'bg-amber-50 ring-2 ring-inset ring-amber-300'
    : isRest
      ? 'bg-gray-50'
      : 'bg-white';

  const rawChord = chords.length > 0 ? chords[0] : '';
  const subParts = rawChord.includes('.') ? rawChord.split('.') : null;

  return (
    <div
      ref={setRef}
      className={`px-2 pb-2 transition-colors relative touch-none select-none min-w-0 overflow-hidden
        ${cursorClass}
        ${isRest ? 'pointer-events-none' : 'cursor-pointer'}
        ${roundedClass ?? ''}
      `}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {note ? (
        <div className="flex flex-col items-center mb-0.5 pt-1">
          {showNotes ? (
            <>
              <div className="bg-slate-600 text-white text-[9px] leading-tight rounded px-1.5 py-0.5 w-full text-center break-words whitespace-pre-wrap max-h-12 overflow-hidden">
                {note}
              </div>
              <div className="w-0 h-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-slate-600" />
            </>
          ) : (
            <div className="pt-1 pb-0.5">
              <div className="w-0 h-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-slate-400 mx-auto" />
            </div>
          )}
        </div>
      ) : (
        <div className="pt-1.5" />
      )}

      {isRest ? (
        <div className="flex items-center justify-center min-h-[2.5rem] text-gray-300 text-base select-none">
          /
        </div>
      ) : (
        <>
          {subParts ? (
            <div
              className="grid grid-cols-2 gap-x-0.5 gap-y-0 mb-0.5"
              style={{ minHeight: '1.5rem' }}
            >
              {[...subParts, '', '', '', ''].slice(0, 4).map((p, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    if (p) {
                      e.stopPropagation();
                      onChordClick(p);
                    }
                  }}
                  className={`text-[13px] leading-none text-left truncate ${
                    p
                      ? 'text-indigo-600 font-bold hover:underline active:opacity-60'
                      : 'pointer-events-none'
                  }`}
                >
                  {p || ' '}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
              {chords.map((chord, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChordClick(chord);
                  }}
                  className="text-indigo-600 font-bold text-[13px] leading-none hover:underline active:opacity-60"
                >
                  {chord}
                </button>
              ))}
            </div>
          )}
          <p className="text-[13px] text-gray-800 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
            {lyric || ' '}
          </p>
        </>
      )}
    </div>
  );
}

export const MeasureCell = memo(MeasureCellImpl);
