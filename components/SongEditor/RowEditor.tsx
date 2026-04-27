'use client';

import { memo } from 'react';
import type { Measure, Row } from '@/types/sheet';
import { parseSmartChord } from '@/lib/sheet/editor';
import { MeasureCell } from './MeasureCell';

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

interface Props {
  row: Row;
  totalRows: number;
  onRemove: () => void;
  onChange: (mi: number, patch: Partial<Measure>) => void;
  onChordBatch: (chords: string[]) => void;
  dragHandleProps: DragHandleProps;
}

function RowEditorImpl({
  row,
  totalRows,
  onRemove,
  onChange,
  onChordBatch,
  dragHandleProps,
}: Props) {
  function handleChord0Blur(raw: string) {
    const parsed = parseSmartChord(raw);
    if (parsed) onChordBatch(parsed);
  }

  return (
    <div className="flex items-start gap-1 px-2 py-2 group">
      <div
        className="mt-1.5 cursor-grab active:cursor-grabbing touch-none select-none text-gray-300 text-base w-5 text-center shrink-0"
        aria-label="줄 이동 핸들"
        {...dragHandleProps}
      >
        ⠿
      </div>

      <div
        className="flex-1 grid gap-px"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto auto' }}
      >
        {row.measures.map((m, mi) => (
          <MeasureCell
            key={mi}
            measure={m}
            index={mi}
            onChange={(patch) => onChange(mi, patch)}
            onChordBlur={mi === 0 ? handleChord0Blur : undefined}
          />
        ))}
      </div>

      {totalRows > 1 && (
        <button
          onClick={onRemove}
          aria-label="줄 삭제"
          className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-[10px] text-gray-300 hover:text-red-400 shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export const RowEditor = memo(RowEditorImpl);
