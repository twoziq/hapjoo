'use client';

import DiagramSVG from './DiagramSVG';
import type { ChordEntry } from './types';

const STAR: Record<number, string> = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };

interface Props {
  chordName: string;
  chordData: ChordEntry | null | undefined;
  onClose: () => void;
}

export default function ChordDiagram({ chordName, chordData, onClose }: Props) {
  if (!chordData) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{chordName}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 text-2xl w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2">
          <div className="flex flex-col items-center shrink-0">
            <DiagramSVG frets={chordData.frets} />
            <p className="text-xs text-amber-500 mt-1">{STAR[chordData.difficulty ?? 1]}</p>
          </div>
          {chordData.alternatives?.map((v, i) => (
            <div key={i} className="flex flex-col items-center shrink-0">
              <DiagramSVG frets={v.frets} label={v.label} />
              <p className="text-xs text-amber-500 mt-1">{STAR[v.difficulty ?? 1]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
