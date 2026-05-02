'use client';

import { memo } from 'react';
import type { Measure } from '@/types/sheet';

interface Props {
  measure: Measure;
  index: number;
  onChange: (patch: Partial<Measure>) => void;
  onChordBlur?: (raw: string) => void;
}

const PLACEHOLDERS = ['G', 'D', 'Em', 'Am'];

function MeasureCellImpl({ measure, index, onChange, onChordBlur }: Props) {
  return (
    <>
      <input
        key={`c_${index}`}
        type="text"
        value={measure.chord}
        tabIndex={-1}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ chord: v ? v[0].toUpperCase() + v.slice(1) : '' });
        }}
        onBlur={onChordBlur ? (e) => onChordBlur(e.target.value) : undefined}
        onClick={(e) => (e.currentTarget as HTMLInputElement).focus()}
        placeholder={PLACEHOLDERS[index]}
        style={{ gridColumn: index + 1, gridRow: 1 }}
        className="bg-indigo-50 text-indigo-700 font-bold text-sm rounded-t px-1 py-1.5 outline-none focus:bg-indigo-100 placeholder:text-indigo-200 placeholder:font-normal w-full text-left"
      />
      <input
        key={`l_${index}`}
        type="text"
        value={measure.lyric}
        tabIndex={-1}
        onChange={(e) => onChange({ lyric: e.target.value })}
        onClick={(e) => (e.currentTarget as HTMLInputElement).focus()}
        placeholder="가사"
        style={{ gridColumn: index + 1, gridRow: 2 }}
        className="bg-white text-gray-800 text-sm border-t border-gray-100 rounded-b px-1 py-1.5 outline-none focus:bg-gray-50 placeholder:text-gray-200 w-full text-left"
      />
    </>
  );
}

export const MeasureCell = memo(MeasureCellImpl);
