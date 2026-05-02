'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SheetSection } from '@/types/sheet';
import { transposeChord } from '@/lib/transpose';
import ChordDiagram from '@/components/ChordDiagram';
import chordDB from '@/data/chords.json';
import { MeasureCell } from './MeasureCell';
import NoteEditor from './NoteEditor';
import { useNotes } from './hooks/useNotes';
import { buildOSections, noteKey, toBlocks } from './utils';

interface Props {
  sections: SheetSection[];
  semitones: number;
  currentPos: { si: number; mi: number } | null;
  cursorActive: boolean;
  showNotes: boolean;
  songId: string;
  isPlaying: boolean;
  onCellTap: (si: number, mi: number) => void;
}

interface ChordEntry {
  frets: string;
  difficulty?: number;
  label?: string;
  alternatives?: ChordEntry[];
}

export default function SheetViewer({
  sections,
  semitones,
  currentPos,
  cursorActive,
  showNotes,
  songId,
  isPlaying,
  onCellTap,
}: Props) {
  const [activeChord, setActiveChord] = useState<string | null>(null);
  const [oSections] = useState(() => buildOSections(sections));
  const [activeNote, setActiveNote] = useState<{ origIdx: number; mi: number } | null>(null);

  const { notes, saveNote } = useNotes(songId);

  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prevBlockIdRef = useRef<string | null>(null);

  const blocks = useMemo(() => toBlocks(oSections), [oSections]);

  const siToBlockId = useMemo(() => {
    const map = new Map<number, string>();
    blocks.forEach((block) => {
      block.rows.forEach((os) => {
        map.set(os.originalIdx, block.id);
      });
    });
    return map;
  }, [blocks]);

  useEffect(() => {
    if (!isPlaying) {
      prevBlockIdRef.current = null;
      return;
    }
    if (!currentPos) return;
    const blockId = siToBlockId.get(currentPos.si);
    if (!blockId || prevBlockIdRef.current === blockId) return;
    prevBlockIdRef.current = blockId;
    blockRefs.current.get(blockId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPos, isPlaying, siToBlockId]);

  function tr(c: string) {
    return transposeChord(c, semitones);
  }

  const activeNoteKey = activeNote ? noteKey(activeNote.origIdx, activeNote.mi) : '';
  const chordTable = chordDB as Record<string, ChordEntry>;

  return (
    <div className="pb-4">
      {blocks.map((block) => (
        <div
          key={block.id}
          ref={(el) => {
            if (el) blockRefs.current.set(block.id, el);
            else blockRefs.current.delete(block.id);
          }}
        >
          <div className="mb-3">
            {block.label && (
              <div className="flex items-center gap-1 mt-4 mb-1 px-0.5 min-h-[1.5rem]">
                <span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase select-none">
                  {(block.label.section.lyrics ?? '').toUpperCase()}
                </span>
              </div>
            )}

            {block.rows.length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden flex flex-col gap-px bg-gray-200">
                {block.rows.map((os, osIdx) => {
                  const isFirstOsRow = osIdx === 0;
                  const isLastOsRow = osIdx === block.rows.length - 1;
                  const chords = os.section.chords.map(tr);
                  const measures = os.section.measures?.length
                    ? os.section.measures
                    : [os.section.lyrics ?? ''];
                  const count = measures.length;
                  const oneToOne = chords.length === count;
                  const cols = count <= 4 ? count : 4;

                  return (
                    <div key={os.uid} className="flex items-stretch gap-px bg-gray-200">
                      <div
                        className="flex-1 grid gap-px"
                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                      >
                        {measures.map((lyric, mi) => {
                          const barChords = oneToOne
                            ? chords[mi]
                              ? [chords[mi]]
                              : []
                            : chords.slice(
                                Math.floor((mi / count) * chords.length),
                                Math.floor(((mi + 1) / count) * chords.length),
                              );
                          const cellKey = `${os.uid}_${mi}`;
                          const nk = noteKey(os.originalIdx, mi);
                          const note = os.originalIdx >= 0 ? notes[nk] : undefined;
                          const isCur = currentPos?.si === os.originalIdx && currentPos?.mi === mi;
                          const roundedClass = [
                            isFirstOsRow && mi === 0 ? 'rounded-tl-xl' : '',
                            isFirstOsRow && (count <= 4 ? mi === count - 1 : mi === cols - 1) ? 'rounded-tr-xl' : '',
                            isLastOsRow && (count <= 4 ? mi === 0 : mi === Math.floor((count - 1) / cols) * cols) ? 'rounded-bl-xl' : '',
                            isLastOsRow && mi === count - 1 ? 'rounded-br-xl' : '',
                          ].filter(Boolean).join(' ');
                          return (
                            <MeasureCell
                              key={cellKey}
                              cellKey={cellKey}
                              cellRefs={cellRefs}
                              isCurrent={isCur}
                              cursorActive={cursorActive}
                              isRest={
                                os.section.restFrom !== undefined && mi >= os.section.restFrom
                              }
                              chords={barChords}
                              lyric={lyric}
                              note={note}
                              showNotes={showNotes}
                              onChordClick={setActiveChord}
                              onLongPress={() => setActiveNote({ origIdx: os.originalIdx, mi })}
                              onTap={() => onCellTap(os.originalIdx, mi)}
                              roundedClass={roundedClass}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      {activeNote && (
        <NoteEditor
          initial={notes[activeNoteKey] ?? ''}
          hasExisting={!!notes[activeNoteKey]}
          onSave={(text) => {
            saveNote(activeNoteKey, text);
            setActiveNote(null);
          }}
          onDelete={() => {
            saveNote(activeNoteKey, '');
            setActiveNote(null);
          }}
          onCancel={() => setActiveNote(null)}
        />
      )}

      {activeChord && (
        <ChordDiagram
          chordName={activeChord}
          chordData={chordTable[activeChord]}
          onClose={() => setActiveChord(null)}
        />
      )}
    </div>
  );
}
