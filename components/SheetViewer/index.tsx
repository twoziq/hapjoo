'use client';

import { useState } from 'react';
import { transposeChord } from '@/lib/transpose';
import ChordDiagram from '@/components/ChordDiagram';
import chordDB from '@/data/chords.json';
import type { SheetSection } from '@/lib/chordParser';

interface Props {
  sections: SheetSection[];
  semitones: number;
}

export default function SheetViewer({ sections, semitones }: Props) {
  const [activeChord, setActiveChord] = useState<string | null>(null);

  function tr(chord: string) {
    return transposeChord(chord, semitones);
  }

  return (
    <div className="pb-4">
      {sections.map((section, si) => {
        const chords = section.chords.map(tr);
        const measures = section.measures?.length ? section.measures : [section.lyrics ?? ''];

        // Section label (간주, 아웃트로, etc.)
        if (chords.length === 0) {
          return (
            <p key={si} className="text-[11px] font-bold text-gray-400 tracking-widest mt-5 mb-1 px-0.5">
              {section.lyrics?.toUpperCase()}
            </p>
          );
        }

        const count = measures.length;
        const oneToOne = chords.length === count;

        return (
          <div
            key={si}
            className="grid grid-cols-4 gap-px bg-gray-200 rounded-xl overflow-hidden mb-2 border border-gray-200"
          >
            {measures.map((lyric, mi) => {
              let barChords: string[];
              if (oneToOne) {
                barChords = chords[mi] ? [chords[mi]] : [];
              } else {
                const start = Math.floor((mi / count) * chords.length);
                const end = Math.floor(((mi + 1) / count) * chords.length);
                barChords = chords.slice(start, end);
              }
              return (
                <div key={mi} className="bg-white px-2 pt-1.5 pb-2">
                  <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
                    {barChords.map((chord, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveChord(chord)}
                        className="text-indigo-600 font-bold text-[13px] leading-none hover:underline active:opacity-60"
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                  <p className="text-[13px] text-gray-800 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
                    {lyric || ' '}
                  </p>
                </div>
              );
            })}
          </div>
        );
      })}

      {activeChord && (
        <ChordDiagram
          chordName={activeChord}
          chordData={(chordDB as Record<string, any>)[activeChord]}
          onClose={() => setActiveChord(null)}
        />
      )}
    </div>
  );
}
