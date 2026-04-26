'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { transposeChord } from '@/lib/transpose';
import ChordDiagram from '@/components/ChordDiagram';
import chordDB from '@/data/chords.json';
import type { SheetSection } from '@/lib/chordParser';

interface Props {
  sections: SheetSection[];
  semitones: number;
  currentPos: { si: number; mi: number } | null;
  cursorActive: boolean; // true = playing/counting, false = parked cursor
  showNotes: boolean;
  songId: string;
  isPlaying: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
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

function flatten(blocks: Block[]): OSection[] {
  return blocks.flatMap(b => [...(b.label ? [b.label] : []), ...b.rows]);
}

function noteKey(originalIdx: number, mi: number) { return `${originalIdx}_${mi}`; }

function useLongPress(cb: () => void, ms = 500) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); t.current = setTimeout(cb, ms); },
    onPointerUp:     () => { if (t.current) clearTimeout(t.current); },
    onPointerCancel: () => { if (t.current) clearTimeout(t.current); },
    onPointerLeave:  () => { if (t.current) clearTimeout(t.current); },
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SheetViewer({ sections, semitones, currentPos, cursorActive, showNotes, songId, isPlaying, editMode, setEditMode, onCellTap }: Props) {
  const [activeChord, setActiveChord] = useState<string | null>(null);
  const [oSections, setOSections]     = useState<OSection[]>(() => makeOS(sections));
  const [labels, setLabels]           = useState<Record<string, string>>({});
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [subActive, setSubActive]     = useState(false);
  const [subInput, setSubInput]       = useState('');
  const [editingUid, setEditingUid]   = useState<string | null>(null);
  const [labelDraft, setLabelDraft]   = useState('');
  const [activeNote, setActiveNote]   = useState<{ origIdx: number; mi: number } | null>(null);
  const [noteDraft, setNoteDraft]     = useState('');
  const [animBlockIds, setAnimBlockIds] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow]   = useState<OSection | null>(null);

  // Block drag state
  const [activeDrag, setActiveDrag]   = useState<{ fromBi: number } | null>(null);
  const [dragOverBi, setDragOverBi]   = useState<number | null>(null);
  const blockDivRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Row drag state
  const [rowDrag, setRowDrag]         = useState<{ bi: number; fromRi: number } | null>(null);
  const [rowDragOver, setRowDragOver] = useState<{ bi: number; ri: number } | null>(null);
  const rowDivRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`hapjoo_notes_${songId}`) ?? '{}'); }
    catch { return {}; }
  });

  function persistNotes(next: Record<string, string>) {
    setNotes(next);
    try { localStorage.setItem(`hapjoo_notes_${songId}`, JSON.stringify(next)); } catch {}
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

  // ── Block operations ───────────────────────────────────────────
  function moveBlockTo(from: number, to: number) {
    const nb = [...blocks];
    const [removed] = nb.splice(from, 1);
    nb.splice(to, 0, removed);
    setOSections(flatten(nb));
  }

  function insertRow(bi: number) {
    const uid = `row_${Date.now()}`;
    const newOS: OSection = {
      uid,
      originalIdx: -1,
      section: { chords: ['', '', '', ''], lyrics: '', measures: ['', '', '', ''] },
    };
    const nb = blocks.map(b => ({ ...b, rows: [...b.rows] }));
    nb[bi].rows.push(newOS);
    setOSections(flatten(nb));
  }

  function moveRowTo(bi: number, fromRi: number, toRi: number) {
    const nb = blocks.map(b => ({ ...b, rows: [...b.rows] }));
    const [removed] = nb[bi].rows.splice(fromRi, 1);
    nb[bi].rows.splice(toRi, 0, removed);
    setOSections(flatten(nb));
  }

  function copyBlock(bi: number) {
    const b = blocks[bi]; const ts = Date.now();
    const copied: Block = {
      id: `cp_${ts}`,
      label: b.label ? { ...b.label, uid: `cp_l_${ts}`, section: { ...b.label.section } } : null,
      rows: b.rows.map((r, i) => ({ ...r, uid: `cp_r_${ts}_${i}`, originalIdx: -1, section: { ...r.section } })),
    };
    const nb = [...blocks];
    nb.splice(bi + 1, 0, copied);
    setOSections(flatten(nb));
  }

  function deleteBlock(bi: number) {
    const nb = [...blocks];
    nb.splice(bi, 1);
    setOSections(flatten(nb));
  }

  function resetToOriginal() {
    setOSections(makeOS(sections));
    setLabels({});
    setSelected(new Set());
    setSubActive(false);
    setEditMode(false);
  }

  function insertSection(afterBi: number) {
    const uid = `new_${Date.now()}`;
    const newOS: OSection = {
      uid,
      originalIdx: -1,
      section: { chords: [], lyrics: '새 구간', measures: ['새 구간'] },
    };
    const newBlock: Block = { id: uid, label: newOS, rows: [] };
    const nb = [...blocks];
    nb.splice(afterBi + 1, 0, newBlock);
    setOSections(flatten(nb));
    setAnimBlockIds(prev => new Set([...prev, uid]));
    setTimeout(() => setAnimBlockIds(prev => { const n = new Set(prev); n.delete(uid); return n; }), 500);
    setLabelDraft('새 구간');
    setEditingUid(uid);
  }

  function createSubLabel() {
    if (!subInput.trim() || !selected.size) return;
    const next: OSection[] = []; let done = false;
    for (const os of oSections) {
      if (selected.has(os.uid) && !done) {
        next.push({ uid: `sub_${Date.now()}`, originalIdx: -1, section: { chords: [], lyrics: subInput.trim(), measures: [subInput.trim()] } });
        done = true;
      }
      next.push(os);
    }
    setOSections(next);
    setSelected(new Set()); setSubActive(false); setSubInput('');
  }

  function commitLabel(uid: string, val: string) {
    setLabels(prev => ({ ...prev, [uid]: val }));
    setEditingUid(null);
  }

  function updateRow(uid: string, chords: string[], measures: string[]) {
    setOSections(prev => prev.map(s =>
      s.uid === uid
        ? { ...s, section: { ...s.section, chords, measures, lyrics: measures.join(' | ') } }
        : s
    ));
  }

  // ── Row drag handlers ──────────────────────────────────────────
  function handleRowDragPointerDown(e: React.PointerEvent, bi: number, ri: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setRowDrag({ bi, fromRi: ri });
    setRowDragOver({ bi, ri });
  }

  function handleRowDragPointerMove(e: React.PointerEvent, bi: number) {
    if (!rowDrag || rowDrag.bi !== bi) return;
    const y = e.clientY;
    const rows = blocks[bi].rows;
    for (let ri = 0; ri < rows.length; ri++) {
      const el = rowDivRefs.current.get(rows[ri].uid);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) { setRowDragOver({ bi, ri }); break; }
    }
  }

  function handleRowDragPointerUp() {
    if (rowDrag && rowDragOver && rowDragOver.bi === rowDrag.bi && rowDragOver.ri !== rowDrag.fromRi) {
      moveRowTo(rowDrag.bi, rowDrag.fromRi, rowDragOver.ri);
    }
    setRowDrag(null);
    setRowDragOver(null);
  }

  // ── Block drag handlers ────────────────────────────────────────
  function handleDragPointerDown(e: React.PointerEvent, bi: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDrag({ fromBi: bi });
    setDragOverBi(bi);
  }

  function handleDragPointerMove(e: React.PointerEvent) {
    if (!activeDrag) return;
    const y = e.clientY;
    for (let i = 0; i < blockDivRefs.current.length; i++) {
      const el = blockDivRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) {
        setDragOverBi(i);
        break;
      }
    }
  }

  function handleDragPointerUp() {
    if (activeDrag && dragOverBi !== null && dragOverBi !== activeDrag.fromBi) {
      moveBlockTo(activeDrag.fromBi, dragOverBi);
    }
    setActiveDrag(null);
    setDragOverBi(null);
  }

  function tr(c: string) { return transposeChord(c, semitones); }

  return (
    <div className="pb-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => { setEditMode(!editMode); setSelected(new Set()); setSubActive(false); }}
          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${editMode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
        >{editMode ? '✓ 편집 완료' : '✎ 편집'}</button>

        {editMode && (
          <button onClick={resetToOriginal}
            className="text-xs px-3 py-1 rounded-full font-semibold bg-red-50 text-red-400">
            ↺ 원본 복귀
          </button>
        )}
        {editMode && selected.size > 0 && !subActive && (
          <button onClick={() => setSubActive(true)}
            className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-semibold">
            구간 이름 붙이기 ({selected.size}줄)
          </button>
        )}
        {subActive && (
          <div className="flex items-center gap-1">
            <input autoFocus value={subInput} onChange={e => setSubInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createSubLabel(); if (e.key === 'Escape') setSubActive(false); }}
              placeholder="구간 이름…"
              className="text-xs border border-gray-300 rounded px-2 py-1 w-28 outline-none focus:border-indigo-400" />
            <button onClick={createSubLabel} className="text-xs text-indigo-600 font-semibold">확인</button>
            <button onClick={() => setSubActive(false)} className="text-xs text-gray-400">취소</button>
          </div>
        )}
      </div>

      {/* Blocks */}
      {blocks.map((block, bi) => (
        <div
          key={block.id}
          ref={el => { blockDivRefs.current[bi] = el; }}
        >
          <div className={`mb-3 ${animBlockIds.has(block.id) ? 'slide-in-section' : ''}
            ${activeDrag?.fromBi === bi ? 'opacity-40' : ''}
            ${dragOverBi === bi && activeDrag?.fromBi !== bi ? 'ring-2 ring-indigo-300 rounded-xl' : ''}
          `}>
            {/* Section label */}
            {block.label && (
              <div className="flex items-center gap-1 mt-4 mb-1 px-0.5 min-h-[1.5rem]">
                {editMode && (
                  <div className="flex items-center gap-0.5 mr-1 shrink-0">
                    {/* Drag handle */}
                    <div
                      className="w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none text-gray-300 text-lg"
                      onPointerDown={e => handleDragPointerDown(e, bi)}
                      onPointerMove={handleDragPointerMove}
                      onPointerUp={handleDragPointerUp}
                      onPointerCancel={() => { setActiveDrag(null); setDragOverBi(null); }}
                    >⠿</div>
                    <button onClick={() => copyBlock(bi)} title="복사"
                      className="w-5 h-5 text-[11px] text-gray-400 hover:text-indigo-500">⊕</button>
                    <button onClick={() => deleteBlock(bi)} title="삭제"
                      className="w-5 h-5 text-[11px] text-gray-400 hover:text-red-500">✕</button>
                  </div>
                )}
                {editingUid === block.label.uid ? (
                  <input autoFocus value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
                    onBlur={() => commitLabel(block.label!.uid, labelDraft)}
                    onKeyDown={e => { if (e.key === 'Enter') commitLabel(block.label!.uid, labelDraft); if (e.key === 'Escape') setEditingUid(null); }}
                    className="text-[11px] font-bold tracking-widest uppercase text-indigo-500 border-b border-indigo-400 outline-none bg-transparent w-36" />
                ) : (
                  <LabelSpan
                    text={labels[block.label.uid] ?? block.label.section.lyrics ?? ''}
                    onLongPress={() => {
                      setLabelDraft(labels[block.label!.uid] ?? block.label!.section.lyrics ?? '');
                      setEditingUid(block.label!.uid);
                      setEditMode(true);
                    }}
                  />
                )}
              </div>
            )}

            {(block.rows.length > 0 || editMode) && (
              <div className="rounded-xl border border-gray-200 overflow-hidden flex flex-col gap-px bg-gray-200">
                {block.rows.map((os, ri) => {
                  const chords   = os.section.chords.map(tr);
                  const measures = os.section.measures?.length ? os.section.measures : [os.section.lyrics ?? ''];
                  const count    = measures.length;
                  const oneToOne = chords.length === count;
                  const isRowSel = editMode && selected.has(os.uid);
                  const cols = count <= 4 ? count : 4;
                  const isDraggingThis = rowDrag?.bi === bi && rowDrag.fromRi === ri;
                  const isDragTarget  = rowDragOver?.bi === bi && rowDragOver.ri === ri && rowDrag?.fromRi !== ri;

                  return (
                    <div
                      key={os.uid}
                      ref={el => { rowDivRefs.current.set(os.uid, el); }}
                      className={`flex items-stretch gap-px bg-gray-200 transition-opacity
                        ${isDraggingThis ? 'opacity-40' : ''}
                        ${isDragTarget ? 'ring-2 ring-inset ring-indigo-300' : ''}
                      `}
                    >
                      {editMode && (
                        <div
                          className="w-5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none text-gray-300 text-base bg-white shrink-0"
                          onPointerDown={e => handleRowDragPointerDown(e, bi, ri)}
                          onPointerMove={e => handleRowDragPointerMove(e, bi)}
                          onPointerUp={handleRowDragPointerUp}
                          onPointerCancel={() => { setRowDrag(null); setRowDragOver(null); }}
                        >⠿</div>
                      )}
                      <div className="flex-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                        {measures.map((lyric, mi) => {
                          const barChords = oneToOne
                            ? (chords[mi] ? [chords[mi]] : [])
                            : chords.slice(Math.floor((mi / count) * chords.length), Math.floor(((mi + 1) / count) * chords.length));

                          const key  = `${os.uid}_${mi}`;
                          const nk   = noteKey(os.originalIdx, mi);
                          const note = os.originalIdx >= 0 ? notes[nk] : undefined;
                          const isCur = currentPos?.si === os.originalIdx && currentPos?.mi === mi;

                          return (
                            <MeasureCell
                              key={key}
                              cellKey={key}
                              cellRefs={cellRefs}
                              isCurrent={isCur}
                              cursorActive={cursorActive}
                              isRest={os.section.restFrom !== undefined && mi >= os.section.restFrom}
                              isRowSelected={isRowSel}
                              chords={barChords}
                              lyric={lyric}
                              note={note}
                              showNotes={showNotes}
                              editMode={editMode}
                              onChordClick={setActiveChord}
                              onLongPress={() => editMode
                                ? setSelected(prev => { const n = new Set(prev); n.has(os.uid) ? n.delete(os.uid) : n.add(os.uid); return n; })
                                : (setActiveNote({ origIdx: os.originalIdx, mi }), setNoteDraft(notes[nk] ?? ''))
                              }
                              onTap={() => {
                                if (editMode) {
                                  setEditingRow(os);
                                } else {
                                  onCellTap(os.originalIdx, mi);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {editMode && (
                  <button
                    onClick={() => insertRow(bi)}
                    className="w-full text-xs text-gray-400 hover:text-indigo-500 py-1.5 bg-white hover:bg-indigo-50 transition-colors text-center"
                  >+ 줄 추가</button>
                )}
              </div>
            )}
          </div>

          {editMode && (
            <InsertSectionButton onClick={() => insertSection(bi)} />
          )}
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

      {/* Row edit modal */}
      {editingRow && (
        <RowEditModal
          os={editingRow}
          semitones={semitones}
          onSave={(chords, measures) => {
            updateRow(editingRow.uid, chords, measures);
            setEditingRow(null);
          }}
          onClose={() => setEditingRow(null)}
        />
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

// ── RowEditModal ───────────────────────────────────────────────────────────────
function RowEditModal({ os, semitones, onSave, onClose }: {
  os: OSection;
  semitones: number;
  onSave: (chords: string[], measures: string[]) => void;
  onClose: () => void;
}) {
  const CELLS = 4;
  const initChords   = [...os.section.chords,   '', '', '', ''].slice(0, CELLS);
  const initMeasures = [...(os.section.measures ?? [os.section.lyrics ?? '']), '', '', '', ''].slice(0, CELLS);

  const [chords,   setChords]   = useState(initChords);
  const [measures, setMeasures] = useState(initMeasures);

  function handleSave() {
    let len = CELLS;
    while (len > 0 && !chords[len - 1] && !measures[len - 1]) len--;
    onSave(chords.slice(0, Math.max(len, 1)), measures.slice(0, Math.max(len, 1)));
  }

  function setChord(i: number, v: string) {
    setChords(p => { const n = [...p]; n[i] = v.toUpperCase(); return n; });
  }
  function setMeasure(i: number, v: string) {
    setMeasures(p => { const n = [...p]; n[i] = v; return n; });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-3 text-gray-700">마디 편집</h3>
        <div className="grid grid-cols-4 gap-1 mb-4">
          {Array.from({ length: CELLS }).map((_, i) => (
            <input key={`c${i}`}
              value={chords[i]}
              onChange={e => setChord(i, e.target.value)}
              placeholder={['G', 'D', 'Em', 'C'][i]}
              className="bg-indigo-50 text-indigo-700 font-bold text-sm px-1 py-1.5 rounded outline-none focus:bg-indigo-100 w-full text-center" />
          ))}
          {Array.from({ length: CELLS }).map((_, i) => (
            <input key={`m${i}`}
              value={measures[i]}
              onChange={e => setMeasure(i, e.target.value)}
              placeholder="가사"
              className="bg-white text-gray-800 text-sm px-1 py-1.5 rounded border border-gray-100 outline-none focus:border-indigo-300 w-full" />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold">저장</button>
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-400">취소</button>
        </div>
      </div>
    </div>
  );
}

// ── InsertSectionButton ────────────────────────────────────────────────────────
function InsertSectionButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="w-full flex items-center gap-2 py-1 mb-2 group"
    >
      <div className={`flex-1 h-px transition-colors ${hover ? 'bg-indigo-300' : 'bg-gray-150'}`} />
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
        hover
          ? 'bg-indigo-600 text-white border-indigo-600 scale-105'
          : 'bg-white text-gray-300 border-gray-200'
      }`}>
        + 구간 추가
      </span>
      <div className={`flex-1 h-px transition-colors ${hover ? 'bg-indigo-300' : 'bg-gray-150'}`} />
    </button>
  );
}

// ── LabelSpan ──────────────────────────────────────────────────────────────────
function LabelSpan({ text, onLongPress }: { text: string; onLongPress: () => void }) {
  const lp = useLongPress(onLongPress);
  return (
    <span {...lp} className="text-[11px] font-bold text-gray-400 tracking-widest uppercase touch-none select-none cursor-pointer">
      {text.toUpperCase()}
    </span>
  );
}

// ── MeasureCell ────────────────────────────────────────────────────────────────
function MeasureCell({
  cellKey, cellRefs, isCurrent, cursorActive, isRest, isRowSelected, chords, lyric, note, showNotes,
  editMode, onChordClick, onLongPress, onTap,
}: {
  cellKey: string;
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  isCurrent: boolean;
  cursorActive: boolean;
  isRest: boolean;
  isRowSelected: boolean;
  chords: string[];
  lyric: string;
  note?: string;
  showNotes: boolean;
  editMode: boolean;
  onChordClick: (c: string) => void;
  onLongPress: () => void;
  onTap: () => void;
}) {
  const lp = useLongPress(onLongPress);
  const didLongPress = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    didLongPress.current = false;
    lp.onPointerDown({ ...e, preventDefault: () => { e.preventDefault(); didLongPress.current = true; } } as any);
  }
  function handlePointerUp() {
    lp.onPointerUp();
    if (!didLongPress.current) onTap();
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
      className={`px-2 pb-2 transition-colors relative
        ${cursorClass}
        ${isRowSelected ? '!bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}
        ${editMode && !isRest ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${isRest ? 'pointer-events-none' : ''}
      `}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={lp.onPointerCancel}
      onPointerLeave={lp.onPointerLeave}
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
              const nonEmpty = subParts.filter(Boolean);
              return (
                <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
                  {nonEmpty.map((p, i) => (
                    <button key={i} onClick={e => { e.stopPropagation(); onChordClick(p); }}
                      className="text-indigo-600 font-bold text-[11px] leading-none hover:underline active:opacity-60">
                      {p}
                    </button>
                  ))}
                </div>
              );
            }
            return (
              <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
                {chords.map((chord, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); onChordClick(chord); }}
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
