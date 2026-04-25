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
  showNotes: boolean;
  songId: string;
  isPlaying: boolean;
  onCellTap: (si: number, mi: number) => void;
}

// ── Types ──────────────────────────────────────────────────────────────────
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

// Note key uses originalIdx so notes survive reset
function noteKey(originalIdx: number, mi: number) { return `${originalIdx}_${mi}`; }

// ── Long-press hook ────────────────────────────────────────────────────────
function useLongPress(cb: () => void, ms = 500) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); t.current = setTimeout(cb, ms); },
    onPointerUp:     () => { if (t.current) clearTimeout(t.current); },
    onPointerCancel: () => { if (t.current) clearTimeout(t.current); },
    onPointerLeave:  () => { if (t.current) clearTimeout(t.current); },
  };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SheetViewer({ sections, semitones, currentPos, showNotes, songId, isPlaying, onCellTap }: Props) {
  const [activeChord, setActiveChord] = useState<string | null>(null);
  const [oSections, setOSections]     = useState<OSection[]>(() => makeOS(sections));
  const [labels, setLabels]           = useState<Record<string, string>>({});
  const [editMode, setEditMode]       = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [subActive, setSubActive]     = useState(false);
  const [subInput, setSubInput]       = useState('');
  const [editingUid, setEditingUid]   = useState<string | null>(null);
  const [labelDraft, setLabelDraft]   = useState('');
  const [activeNote, setActiveNote]   = useState<{ origIdx: number; mi: number } | null>(null);
  const [noteDraft, setNoteDraft]     = useState('');

  // Notes persisted via localStorage, keyed by originalIdx
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

  // Measure refs for auto-scroll
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  useEffect(() => {
    if (!currentPos || !isPlaying) return;
    const os = oSections.find(s => s.originalIdx === currentPos.si);
    if (!os) return;
    cellRefs.current.get(`${os.uid}_${currentPos.mi}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentPos, isPlaying]);

  const blocks = toBlocks(oSections);

  // ── Block operations ─────────────────────────────────────
  function moveBlock(bi: number, dir: -1 | 1) {
    const nb = [...blocks], ti = bi + dir;
    if (ti < 0 || ti >= nb.length) return;
    [nb[bi], nb[ti]] = [nb[ti], nb[bi]];
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

  function tr(c: string) { return transposeChord(c, semitones); }

  return (
    <div className="pb-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => { setEditMode(e => !e); setSelected(new Set()); setSubActive(false); }}
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
        <div key={block.id} className="mb-3">

          {/* Section label */}
          {block.label && (
            <div className="flex items-center gap-1 mt-4 mb-1 px-0.5 min-h-[1.5rem]">
              {editMode && (
                <div className="flex items-center gap-0.5 mr-1 shrink-0">
                  <button onClick={() => moveBlock(bi, -1)} disabled={bi === 0}
                    className="w-5 h-5 text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20">▲</button>
                  <button onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1}
                    className="w-5 h-5 text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20">▼</button>
                  <button onClick={() => copyBlock(bi)} title="복사"
                    className="w-5 h-5 text-[11px] text-gray-300 hover:text-indigo-500">⊕</button>
                  <button onClick={() => deleteBlock(bi)} title="삭제"
                    className="w-5 h-5 text-[11px] text-gray-300 hover:text-red-500">✕</button>
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

          {/* Row grid — no overflow-hidden so bubbles can show */}
          <div className="grid grid-cols-4 gap-px bg-gray-200 rounded-xl border border-gray-200"
            style={{ overflow: 'visible' }}>
            {block.rows.flatMap(os => {
              const chords   = os.section.chords.map(tr);
              const measures = os.section.measures?.length ? os.section.measures : [os.section.lyrics ?? ''];
              const count    = measures.length;
              const oneToOne = chords.length === count;
              const isRowSel = editMode && selected.has(os.uid);

              return measures.map((lyric, mi) => {
                const barChords = oneToOne
                  ? (chords[mi] ? [chords[mi]] : [])
                  : chords.slice(Math.floor((mi / count) * chords.length), Math.floor(((mi + 1) / count) * chords.length));

                const key     = `${os.uid}_${mi}`;
                const nk      = noteKey(os.originalIdx, mi);
                const note    = os.originalIdx >= 0 ? notes[nk] : undefined;
                const isCur   = currentPos?.si === os.originalIdx && currentPos?.mi === mi;
                // Corner rounding
                const totalCells = measures.length * block.rows.length; // approx
                const flatIdx = block.rows.indexOf(os) * measures.length + mi; // not perfect but ok
                // We handle corners via CSS on first/last cells in rows
                const isFirstCell = block.rows.indexOf(os) === 0 && mi === 0;
                const isLastCell  = block.rows.indexOf(os) === block.rows.length - 1 && mi === measures.length - 1;
                const colIdx = mi % 4;
                const isLastRow = block.rows.indexOf(os) === block.rows.length - 1;
                const isFirstRow = block.rows.indexOf(os) === 0;

                return (
                  <MeasureCell
                    key={key}
                    cellKey={key}
                    cellRefs={cellRefs}
                    isCurrent={isCur}
                    isRowSelected={isRowSel}
                    chords={barChords}
                    lyric={lyric}
                    note={note}
                    showNotes={showNotes}
                    editMode={editMode}
                    colIdx={colIdx}
                    isFirstRow={isFirstRow}
                    isLastRow={isLastRow}
                    totalCols={Math.min(count, 4)}
                    onChordClick={setActiveChord}
                    onLongPress={() => editMode
                      ? setSelected(prev => { const n = new Set(prev); n.has(os.uid) ? n.delete(os.uid) : n.add(os.uid); return n; })
                      : (setActiveNote({ origIdx: os.originalIdx, mi }), setNoteDraft(notes[nk] ?? ''))
                    }
                    onTap={() => onCellTap(os.originalIdx, mi)}
                  />
                );
              });
            })}
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

// ── LabelSpan ──────────────────────────────────────────────────────────────
function LabelSpan({ text, onLongPress }: { text: string; onLongPress: () => void }) {
  const lp = useLongPress(onLongPress);
  return (
    <span {...lp} className="text-[11px] font-bold text-gray-400 tracking-widest uppercase touch-none select-none cursor-pointer">
      {text.toUpperCase()}
    </span>
  );
}

// ── MeasureCell ────────────────────────────────────────────────────────────
function MeasureCell({
  cellKey, cellRefs, isCurrent, isRowSelected, chords, lyric, note, showNotes,
  editMode, colIdx, isFirstRow, isLastRow, totalCols, onChordClick, onLongPress, onTap,
}: {
  cellKey: string;
  cellRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  isCurrent: boolean;
  isRowSelected: boolean;
  chords: string[];
  lyric: string;
  note?: string;
  showNotes: boolean;
  editMode: boolean;
  colIdx: number;
  isFirstRow: boolean;
  isLastRow: boolean;
  totalCols: number;
  onChordClick: (c: string) => void;
  onLongPress: () => void;
  onTap: () => void;
}) {
  const lp = useLongPress(onLongPress);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // Distinguish tap vs long-press
  function handlePointerDown(e: React.PointerEvent) {
    didLongPress.current = false;
    lp.onPointerDown({ ...e, preventDefault: () => { e.preventDefault(); didLongPress.current = true; } } as any);
  }
  function handlePointerUp(e: React.PointerEvent) {
    lp.onPointerUp();
    if (!didLongPress.current) onTap();
  }

  const setRef = useCallback((el: HTMLElement | null) => {
    if (el) cellRefs.current.set(cellKey, el);
    else    cellRefs.current.delete(cellKey);
  }, [cellKey]);

  // Corner rounding
  const roundTl = isFirstRow && colIdx === 0            ? 'rounded-tl-xl' : '';
  const roundTr = isFirstRow && colIdx === totalCols - 1 ? 'rounded-tr-xl' : '';
  const roundBl = isLastRow  && colIdx === 0            ? 'rounded-bl-xl' : '';
  const roundBr = isLastRow  && colIdx === totalCols - 1 ? 'rounded-br-xl' : '';

  return (
    <div
      ref={setRef as any}
      className={`bg-white px-2 pb-2 transition-colors relative
        ${roundTl} ${roundTr} ${roundBl} ${roundBr}
        ${isCurrent     ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : ''}
        ${isRowSelected ? '!bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}
      `}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={lp.onPointerCancel}
      onPointerLeave={lp.onPointerLeave}
    >
      {/* Note bubble — inside cell, no overflow issues */}
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

      {/* Chords */}
      <div className="flex gap-1 flex-wrap min-h-[1.1rem] mb-0.5">
        {chords.map((chord, i) => (
          <button key={i} onClick={e => { e.stopPropagation(); onChordClick(chord); }}
            className="text-indigo-600 font-bold text-[13px] leading-none hover:underline active:opacity-60">
            {chord}
          </button>
        ))}
      </div>

      {/* Lyrics */}
      <p className="text-[13px] text-gray-800 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
        {lyric || ' '}
      </p>
    </div>
  );
}
