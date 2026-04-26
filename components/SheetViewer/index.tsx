'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { transposeChord } from '@/lib/transpose';
import ChordDiagram from '@/components/ChordDiagram';
import chordDB from '@/data/chords.json';
import type { SheetSection } from '@/lib/chordParser';
import { dbGetSongNotes, dbSaveSongNotes } from '@/lib/supabase';

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

interface OSection { uid: string; section: SheetSection; originalIdx: number }
interface Block    { id: string; label: OSection | null; rows: OSection[] }

let _uid = 0;
function makeOS(sections: SheetSection[]): OSection[] {
  return sections.map((s, i) => ({ uid: `s${_uid++}`, section: { ...s }, originalIdx: i }));
}

function toBlocks(list: OSection[]): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const os of list) {
    if (os.section.chords.length === 0) {
      if (cur) out.push(cur);
      cur = { id: os.uid, label: os, rows: [] };
    } else {
      if (!cur) cur = { id: `intro_${os.uid}`, label: null, rows: [] };
      cur.rows.push(os);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function noteKey(originalIdx: number, mi: number) { return `${originalIdx}_${mi}`; }

// ── Main component ─────────────────────────────────────────────────────────────
export default function SheetViewer({ sections, semitones, currentPos, cursorActive, showNotes, songId, isPlaying, onCellTap }: Props) {
  const [activeChord, setActiveChord] = useState<string | null>(null);
  const [oSections]                   = useState<OSection[]>(() => makeOS(sections));
  const [activeNote, setActiveNote]   = useState<{ origIdx: number; mi: number } | null>(null);
  const [noteDraft, setNoteDraft]     = useState('');

  // Notes: loaded from localStorage immediately, then synced from Supabase (shared)
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`hapjoo_notes_${songId}`) ?? '{}'); }
    catch { return {}; }
  });

  // Sync shared notes from Supabase on mount
  useEffect(() => {
    dbGetSongNotes(songId).then(shared => {
      if (shared && Object.keys(shared).length > 0) {
        setNotes(shared);
        try { localStorage.setItem(`hapjoo_notes_${songId}`, JSON.stringify(shared)); } catch {}
      }
    });
  }, [songId]);

  function persistNotes(next: Record<string, string>) {
    setNotes(next);
    try { localStorage.setItem(`hapjoo_notes_${songId}`, JSON.stringify(next)); } catch {}
    // Fire-and-forget to Supabase for team sharing
    dbSaveSongNotes(songId, next);
  }

  function saveNote(origIdx: number, mi: number, text: string) {
    const k = noteKey(origIdx, mi);
    const next = { ...notes };
    if (text.trim()) next[k] = text.trim(); else delete next[k];
    persistNotes(next);
  }

  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  useEffect(() => {
    if (!currentPos || !isPlaying) return;
    const os = oSections.find(s => s.originalIdx === currentPos.si);
    if (!os) return;
    cellRefs.current.get(`${os.uid}_${currentPos.mi}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentPos, isPlaying]);

  const blocks = toBlocks(oSections);

  function tr(c: string) { return transposeChord(c, semitones); }

  return (
    <div className="pb-4">
      {blocks.map((block) => (
        <div key={block.id}>
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
                {block.rows.map((os) => {
                  const chords   = os.section.chords.map(tr);
                  const measures = os.section.measures?.length ? os.section.measures : [os.section.lyrics ?? ''];
                  const count    = measures.length;
                  const oneToOne = chords.length === count;
                  const cols     = count <= 4 ? count : 4;

                  return (
                    <div key={os.uid} className="flex items-stretch gap-px bg-gray-200">
                      <div className="flex-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                        {measures.map((lyric, mi) => {
                          const barChords = oneToOne
                            ? (chords[mi] ? [chords[mi]] : [])
                            : chords.slice(Math.floor((mi / count) * chords.length), Math.floor(((mi + 1) / count) * chords.length));
                          const cellKey = `${os.uid}_${mi}`;
                          const nk      = noteKey(os.originalIdx, mi);
                          const note    = os.originalIdx >= 0 ? notes[nk] : undefined;
                          const isCur   = currentPos?.si === os.originalIdx && currentPos?.mi === mi;
                          return (
                            <MeasureCell
                              key={cellKey}
                              cellKey={cellKey}
                              cellRefs={cellRefs}
                              isCurrent={isCur}
                              cursorActive={cursorActive}
                              isRest={os.section.restFrom !== undefined && mi >= os.section.restFrom}
                              chords={barChords}
                              lyric={lyric}
                              note={note}
                              showNotes={showNotes}
                              onChordClick={setActiveChord}
                              onLongPress={() => {
                                setActiveNote({ origIdx: os.originalIdx, mi });
                                setNoteDraft(notes[nk] ?? '');
                              }}
                              onTap={() => onCellTap(os.originalIdx, mi)}
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

      {/* Note popover */}
      {activeNote && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
          onClick={() => setActiveNote(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3 text-gray-700">마디 메모</h3>
            <textarea autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              placeholder="이 마디에 대한 메모…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
              rows={3} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { saveNote(activeNote.origIdx, activeNote.mi, noteDraft); setActiveNote(null); }}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold">저장</button>
              {notes[noteKey(activeNote.origIdx, activeNote.mi)] && (
                <button
                  onClick={() => { saveNote(activeNote.origIdx, activeNote.mi, ''); setActiveNote(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-red-500 bg-red-50">삭제</button>
              )}
              <button onClick={() => setActiveNote(null)}
                className="px-4 py-2 rounded-xl text-sm text-gray-400">취소</button>
            </div>
          </div>
        </div>
      )}

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

// ── MeasureCell ────────────────────────────────────────────────────────────────
// 짧게 탭 → 재생 커서 이동 / 꾹 누르기(500ms) → 메모 입력
function MeasureCell({
  cellKey, cellRefs, isCurrent, cursorActive, isRest, chords, lyric, note, showNotes,
  onChordClick, onLongPress, onTap,
}: {
  cellKey: string;
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>;
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
}) {
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress  = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    if (isRest) return;
    e.preventDefault();
    wasLongPress.current = false;
    timerRef.current = setTimeout(() => {
      wasLongPress.current = true;
      onLongPress();
    }, 500);
  }

  function handlePointerUp() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!wasLongPress.current) onTap();
  }

  function handlePointerCancel() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    wasLongPress.current = false;
  }

  const setRef = useCallback((el: HTMLElement | null) => {
    if (el) cellRefs.current.set(cellKey, el);
    else    cellRefs.current.delete(cellKey);
  }, [cellKey]);

  const cursorClass = isCurrent
    ? cursorActive
      ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400'
      : 'bg-amber-50 ring-2 ring-inset ring-amber-300'
    : isRest
    ? 'bg-gray-50'
    : 'bg-white';

  return (
    <div
      ref={setRef as any}
      className={`px-2 pb-2 transition-colors relative touch-none select-none min-w-0 overflow-hidden
        ${cursorClass}
        ${isRest ? 'pointer-events-none' : 'cursor-pointer'}
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
          {(() => {
            const rawChord = chords.length > 0 ? chords[0] : '';
            const subParts = rawChord.includes('.') ? rawChord.split('.') : null;
            if (subParts) {
              const grid = [...subParts, '', '', '', ''].slice(0, 4);
              return (
                <div className="grid grid-cols-2 gap-x-0.5 gap-y-0 mb-0.5" style={{ minHeight: '1.5rem' }}>
                  {grid.map((p, i) => (
                    <button key={i}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { if (p) { e.stopPropagation(); onChordClick(p); } }}
                      className={`text-[10px] leading-tight text-left truncate ${p ? 'text-indigo-600 font-bold hover:underline active:opacity-60' : 'pointer-events-none'}`}>
                      {p || ' '}
                    </button>
                  ))}
                </div>
              );
            }
            return (
              <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
                {chords.map((chord, i) => (
                  <button key={i}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onChordClick(chord); }}
                    className="text-indigo-600 font-bold text-[13px] leading-none hover:underline active:opacity-60">
                    {chord}
                  </button>
                ))}
              </div>
            );
          })()}
          <p className="text-[13px] text-gray-800 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
            {lyric || ' '}
          </p>
        </>
      )}
    </div>
  );
}
