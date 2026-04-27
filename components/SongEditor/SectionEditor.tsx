'use client';

import { memo, useRef, useState } from 'react';
import type { Measure, Section } from '@/types/sheet';
import { RowEditor, type DragHandleProps } from './RowEditor';

interface Props {
  section: Section;
  sectionCount: number;
  onNameChange: (name: string) => void;
  onRemoveSection: () => void;
  onAddRow: () => void;
  onRemoveRow: (ri: number) => void;
  onMoveRow: (from: number, to: number) => void;
  onMeasureChange: (ri: number, mi: number, patch: Partial<Measure>) => void;
  onChordBatch: (ri: number, chords: string[]) => void;
  dragHandleProps: DragHandleProps;
}

function SectionEditorImpl({
  section,
  sectionCount,
  onNameChange,
  onRemoveSection,
  onAddRow,
  onRemoveRow,
  onMoveRow,
  onMeasureChange,
  onChordBatch,
  dragHandleProps,
}: Props) {
  const [rowDragFrom, setRowDragFrom] = useState<number | null>(null);
  const [rowDragOver, setRowDragOver] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleRowDragDown(e: React.PointerEvent, ri: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setRowDragFrom(ri);
    setRowDragOver(ri);
  }

  function handleRowDragMove(e: React.PointerEvent) {
    if (rowDragFrom === null) return;
    const y = e.clientY;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) {
        setRowDragOver(i);
        break;
      }
    }
  }

  function handleRowDragUp() {
    if (rowDragFrom !== null && rowDragOver !== null && rowDragFrom !== rowDragOver) {
      onMoveRow(rowDragFrom, rowDragOver);
    }
    setRowDragFrom(null);
    setRowDragOver(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <div
          className="cursor-grab active:cursor-grabbing touch-none select-none text-gray-300 text-base shrink-0"
          aria-label="구간 이동 핸들"
          {...dragHandleProps}
        >
          ⠿
        </div>
        <span className="text-[10px] text-gray-400 font-semibold">[</span>
        <input
          value={section.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="구간 이름 (예: Chorus, Verse)"
          className="flex-1 text-sm font-bold text-indigo-600 bg-transparent outline-none placeholder:text-gray-300"
        />
        <span className="text-[10px] text-gray-400 font-semibold">]</span>
        {sectionCount > 1 && (
          <button
            onClick={onRemoveSection}
            aria-label="구간 삭제"
            className="text-xs text-red-400 hover:text-red-600 ml-1 px-1"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-gray-100">
        {section.rows.map((row, ri) => (
          <div
            key={row.id}
            ref={(el) => {
              rowRefs.current[ri] = el;
            }}
            className={`${rowDragFrom === ri ? 'opacity-40' : ''} ${
              rowDragOver === ri && rowDragFrom !== ri ? 'ring-2 ring-inset ring-indigo-300' : ''
            }`}
          >
            <RowEditor
              row={row}
              totalRows={section.rows.length}
              onRemove={() => onRemoveRow(ri)}
              onChange={(mi, patch) => onMeasureChange(ri, mi, patch)}
              onChordBatch={(chords) => onChordBatch(ri, chords)}
              dragHandleProps={{
                onPointerDown: (e) => handleRowDragDown(e, ri),
                onPointerMove: handleRowDragMove,
                onPointerUp: handleRowDragUp,
                onPointerCancel: () => {
                  setRowDragFrom(null);
                  setRowDragOver(null);
                },
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onAddRow}
        className="w-full py-2 text-xs text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors font-semibold"
      >
        + 줄 추가
      </button>
    </div>
  );
}

export const SectionEditor = memo(SectionEditorImpl);
