'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { parseSheet } from '@/lib/chordParser';
import { transposeNote } from '@/lib/transpose';
import SheetViewer from '@/components/SheetViewer';

interface Props { markdown: string; songId: string; }

export default function ViewerClient({ markdown, songId }: Props) {
  const [semitones, setSemitones]         = useState(0);
  const [showNotes, setShowNotes]         = useState(true);
  const [headerCollapsed, setHeader]      = useState(false);
  const [showHelp, setShowHelp]           = useState(false);
  const { meta, sections } = useMemo(() => parseSheet(markdown), [markdown]);

  const [bpm, setBpm]           = useState<number>((meta.bpm as number) || 80);
  const [bpmEditing, setBpmEd]  = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIdx, setPlayIdx]     = useState(0);

  const flatMeasures = useMemo(() => {
    const r: { si: number; mi: number }[] = [];
    sections.forEach((s, si) => {
      if (s.chords.length > 0) {
        const n = s.measures?.length || 1;
        for (let mi = 0; mi < n; mi++) r.push({ si, mi });
      }
    });
    return r;
  }, [sections]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setPlayIdx(prev => {
        const next = prev + 1;
        if (next >= flatMeasures.length) { setIsPlaying(false); return 0; }
        return next;
      });
    }, Math.round(60000 / bpm * 2));        // ×2 = 반박자씩 (한 마디)
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, flatMeasures.length]);

  const currentPos = isPlaying ? (flatMeasures[playIdx] ?? null) : null;
  const currentKey = transposeNote((meta.key as string) ?? 'C', semitones);

  function togglePlay() {
    if (isPlaying) setIsPlaying(false);
    else setIsPlaying(true);
  }

  function onCellTap(si: number, mi: number) {
    const idx = flatMeasures.findIndex(m => m.si === si && m.mi === mi);
    if (idx >= 0) { setPlayIdx(idx); if (!isPlaying) setIsPlaying(true); }
  }

  // BPM long-press to enter number
  const bpmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function bpmDown() { bpmTimer.current = setTimeout(() => { setBpmDraft(String(bpm)); setBpmEd(true); }, 500); }
  function bpmUp()   { if (bpmTimer.current) clearTimeout(bpmTimer.current); }
  function commitBpm() {
    const v = parseInt(bpmDraft, 10);
    if (v >= 20 && v <= 300) setBpm(v);
    setBpmEd(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ───────────────────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-2">

          {/* Row 1: title + icon buttons */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold leading-tight truncate">{(meta.title as string) ?? '악보'}</p>
              <p className="text-[11px] text-gray-400 truncate leading-none mt-0.5">{meta.artist as string}</p>
            </div>
            {(meta.capo as number) > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                카포 {meta.capo}
              </span>
            )}
            <button onClick={() => setShowHelp(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs font-bold shrink-0">?</button>
            <button onClick={() => setHeader(c => !c)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 shrink-0 text-xs">
              {headerCollapsed ? '▾' : '▴'}
            </button>
          </div>

          {/* Row 2: controls (collapsible) */}
          {!headerCollapsed && (
            <div className="flex items-center gap-1">
              {/* Key transpose — compact */}
              <button onClick={() => setSemitones(s => s - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200">−</button>
              <span className="text-sm font-black text-indigo-600 w-7 text-center">{currentKey}</span>
              <button onClick={() => setSemitones(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200">+</button>
              <button onClick={() => setSemitones(0)}
                className={`text-[10px] px-1.5 h-6 rounded-full font-semibold ml-1 ${semitones === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                원키
              </button>
              <button onClick={() => setSemitones(5)}
                className={`text-[10px] px-1.5 h-6 rounded-full font-semibold ${semitones === 5 ? 'bg-pink-100 text-pink-500' : 'bg-gray-100 text-gray-400'}`}>
                +5
              </button>

              <div className="flex-1" />

              {/* BPM — long press to edit */}
              {bpmEditing ? (
                <input autoFocus value={bpmDraft} onChange={e => setBpmDraft(e.target.value)}
                  onBlur={commitBpm}
                  onKeyDown={e => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setBpmEd(false); }}
                  className="w-14 text-center text-sm font-mono font-bold border-b-2 border-indigo-400 outline-none bg-transparent" />
              ) : (
                <button onPointerDown={bpmDown} onPointerUp={bpmUp} onPointerLeave={bpmUp}
                  className="text-sm font-mono font-bold text-gray-500 px-1 select-none touch-none">
                  {bpm}<span className="text-[10px] font-normal ml-0.5 text-gray-400">bpm</span>
                </button>
              )}

              {/* Play */}
              <button onClick={togglePlay}
                className={`h-7 w-8 flex items-center justify-center rounded-full text-xs font-bold ml-1 transition-colors ${isPlaying ? 'bg-red-100 text-red-600' : 'bg-indigo-600 text-white'}`}>
                {isPlaying ? '■' : '▶'}
              </button>

              {/* Notes toggle */}
              <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none ml-1">
                <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} className="w-3 h-3 accent-indigo-600" />
                메모
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Sheet body ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <SheetViewer
            sections={sections}
            semitones={semitones}
            currentPos={currentPos}
            showNotes={showNotes}
            songId={songId}
            isPlaying={isPlaying}
            onCellTap={onCellTap}
          />
        </div>
      </div>

      {/* ── Help modal ──────────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4"
          onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">도움말</h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <HelpRow icon="▶" title="재생 / 정지">마디 클릭 → 해당 위치부터 재생 시작. 재생 중 자동 스크롤.</HelpRow>
              <HelpRow icon="↯" title="BPM 꾹 누르기">BPM 숫자를 길게 누르면 직접 입력 가능.</HelpRow>
              <HelpRow icon="▴▾" title="헤더 접기">우측 상단 버튼으로 상단 컨트롤을 접어 악보 공간 확보.</HelpRow>
              <HelpRow icon="💬" title="마디 꾹 누르기 (일반 모드)">메모 입력 → 말풍선으로 표시. 메모 체크 해제 시 삼각형만 표시.</HelpRow>
              <HelpRow icon="✎" title="편집 모드">
                {'• 섹션 이름 꾹 누르기 → 이름 변경\n• ▲▼ 블록 순서 이동\n• ⊕ 블록 복사\n• ✕ 블록 삭제\n• 마디 꾹 누르기 → 행 선택\n• 선택 행에 구간 이름 붙이기\n• 원본 복귀 버튼으로 초기화'}
              </HelpRow>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HelpRow({ icon, title, children }: { icon: string; title: string; children: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-lg shrink-0 w-6 text-center leading-snug">{icon}</span>
      <div>
        <p className="font-semibold text-gray-800 text-xs">{title}</p>
        <p className="text-gray-500 text-[11px] mt-0.5 whitespace-pre-line leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
