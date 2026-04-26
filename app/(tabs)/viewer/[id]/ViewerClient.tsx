'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { parseSheet } from '@/lib/chordParser';
import { transposeNote } from '@/lib/transpose';
import SheetViewer from '@/components/SheetViewer';

interface Props { markdown: string; songId: string; }

type TimeSig = '4/4' | '3/4' | '6/8';
const TIME_SIG_OPTIONS: TimeSig[] = ['4/4', '3/4', '6/8'];

function getBeatsPerBar(ts: TimeSig): number {
  return parseInt(ts.split('/')[0], 10);
}

function getBeatIntervalMs(ts: TimeSig, bpm: number): number {
  const d = parseInt(ts.split('/')[1], 10);
  return d === 8 ? Math.round(60000 / bpm * 0.5) : Math.round(60000 / bpm);
}

export default function ViewerClient({ markdown, songId }: Props) {
  const [semitones, setSemitones]         = useState(0);
  const [showNotes, setShowNotes]         = useState(true);
  const [headerCollapsed, setHeaderRaw]   = useState(false);
  const [showHelp, setShowHelp]           = useState(false);
  const { meta, sections } = useMemo(() => parseSheet(markdown), [markdown]);

  const [bpm, setBpm]           = useState<number>((meta.bpm as number) || 80);
  const [bpmEditing, setBpmEd]  = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  const [timeSig, setTimeSig]    = useState<TimeSig>('4/4');
  const [timeSigOpen, setTsOpen] = useState(false);
  const tsLongRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editMode, setEditMode] = useState(false);

  // Playback
  const [isPlaying, setIsPlaying]       = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [playIdx, setPlayIdx]           = useState(0);

  const [beatState, setBeatState] = useState<{ beat: number; tick: number }>({ beat: -1, tick: 0 });

  // Refs for imperative control
  const phaseRef          = useRef<'idle' | 'countIn' | 'playing'>('idle');
  const beatsPerBarRef    = useRef(getBeatsPerBar(timeSig));
  const beatIntervalRef   = useRef(getBeatIntervalMs(timeSig, bpm));
  const countInCountRef   = useRef(0);
  const playBeatCountRef  = useRef(0);
  const beatTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const playIdxRef = useRef(0);
  const flatMeasuresRef = useRef<{ si: number; mi: number }[]>([]);

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

  useEffect(() => { flatMeasuresRef.current = flatMeasures; }, [flatMeasures]);
  useEffect(() => {
    beatsPerBarRef.current  = getBeatsPerBar(timeSig);
    beatIntervalRef.current = getBeatIntervalMs(timeSig, bpm);
  }, [timeSig, bpm]);

  // Save last viewed song for tab navigation
  useEffect(() => {
    try { localStorage.setItem('hapjoo_lastSong', songId); } catch {}
  }, [songId]);

  // ── Seek helper ────────────────────────────────────────────────
  function seekTo(idx: number) {
    playIdxRef.current = idx;
    setPlayIdx(idx);
  }

  // ── Stop everything ────────────────────────────────────────────
  function stopAll() {
    if (beatTimerRef.current) { clearInterval(beatTimerRef.current); beatTimerRef.current = null; }
    phaseRef.current = 'idle';
    setIsPlaying(false);
    setIsCountingIn(false);
    setBeatState({ beat: -1, tick: 0 });
  }

  // ── Beat ticker — drives both metronome AND measure advance ────
  function launchBeatTicker() {
    if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    countInCountRef.current  = 0;
    playBeatCountRef.current = 0;
    setBeatState({ beat: 0, tick: 1 });

    beatTimerRef.current = setInterval(() => {
      setBeatState(prev => ({
        beat: (prev.beat + 1) % beatsPerBarRef.current,
        tick: prev.tick + 1,
      }));

      if (phaseRef.current === 'countIn') {
        countInCountRef.current++;
        if (countInCountRef.current >= beatsPerBarRef.current) {
          phaseRef.current = 'playing';
          setIsCountingIn(false);
          setIsPlaying(true);
          countInCountRef.current  = 0;
          playBeatCountRef.current = 0;
        }
        return;
      }

      if (phaseRef.current === 'playing') {
        playBeatCountRef.current++;
        if (playBeatCountRef.current >= beatsPerBarRef.current) {
          playBeatCountRef.current = 0;
          const next = playIdxRef.current + 1;
          if (next >= flatMeasuresRef.current.length) {
            stopAll();
          } else {
            playIdxRef.current = next;
            setPlayIdx(next);
          }
        }
      }
    }, beatIntervalRef.current);
  }

  // ── Toggle play ────────────────────────────────────────────────
  function togglePlay() {
    if (phaseRef.current !== 'idle') { stopAll(); return; }
    seekTo(0);
    phaseRef.current = 'countIn';
    setIsCountingIn(true);
    launchBeatTicker();
  }

  function onCellTap(si: number, mi: number) {
    const idx = flatMeasures.findIndex(m => m.si === si && m.mi === mi);
    if (idx < 0) return;
    seekTo(idx);
    if (phaseRef.current === 'idle') {
      playBeatCountRef.current = 0;
      phaseRef.current = 'playing';
      setIsPlaying(true);
      launchBeatTicker();
    }
  }

  // ── BPM editing ───────────────────────────────────────────────
  const bpmLongRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function bpmDown() { bpmLongRef.current = setTimeout(() => { setBpmDraft(String(bpm)); setBpmEd(true); }, 500); }
  function bpmUp()   { if (bpmLongRef.current) clearTimeout(bpmLongRef.current); }
  function commitBpm() {
    const v = parseInt(bpmDraft, 10);
    if (v >= 20 && v <= 300) setBpm(v);
    setBpmEd(false);
  }
  function adjustBpm(delta: number) {
    setBpm(prev => Math.min(300, Math.max(20, prev + delta)));
  }

  // ── Header collapse ────────────────────────────────────────────
  function setHeader(collapsed: boolean) {
    setHeaderRaw(collapsed);
    if (collapsed) setEditMode(false);
  }

  // ── Time sig long-press ────────────────────────────────────────
  function tsDown() { tsLongRef.current = setTimeout(() => setTsOpen(true), 500); }
  function tsUp()   { if (tsLongRef.current) clearTimeout(tsLongRef.current); }

  const currentPos = (isPlaying || isCountingIn) ? (flatMeasures[playIdx] ?? null) : null;
  const currentKey = transposeNote((meta.key as string) ?? 'C', semitones);
  const beatsPerBar = getBeatsPerBar(timeSig);
  const showBeatBar = isPlaying || isCountingIn;

  // ── 남/여 key logic ────────────────────────────────────────────
  const songGender  = (meta.gender as string) || '남';
  const maleSemi    = songGender === '여' ? -5 : 0;
  const femaleSemi  = songGender === '여' ? 0 : 5;

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header ─────────────────────────────────────── */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-2">

          {showBeatBar && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {Array.from({ length: beatsPerBar }).map((_, i) => {
                const isActive = i === beatState.beat;
                return (
                  <span
                    key={isActive ? `b${i}_${beatState.tick}` : `b${i}`}
                    className={`inline-block rounded-full transition-colors duration-75 ${
                      isActive
                        ? `w-5 h-5 beat-pulse ${isCountingIn ? 'bg-amber-400' : 'bg-red-500'}`
                        : 'w-4 h-4 bg-green-200'
                    }`}
                  />
                );
              })}
              {isCountingIn && (
                <span className="text-[10px] text-amber-500 font-semibold ml-1">카운트인...</span>
              )}
            </div>
          )}

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
            <button onClick={() => setHeader(!headerCollapsed)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold shrink-0">
              {headerCollapsed ? (
                <><span className="text-[13px]">▾</span><span>펼치기</span></>
              ) : (
                <><span className="text-[13px]">▴</span><span>접기</span></>
              )}
            </button>
          </div>

          {/* Row 2: controls (collapsible) */}
          {!headerCollapsed && (
            <div className="flex items-center gap-1">
              {/* Key transpose */}
              <button onClick={() => setSemitones(s => s - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200">−</button>
              <span className="text-sm font-black text-indigo-600 w-7 text-center">{currentKey}</span>
              <button onClick={() => setSemitones(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200">+</button>

              {/* 남/여 버튼 */}
              <button onClick={() => setSemitones(maleSemi)}
                className={`text-[10px] px-2 h-6 rounded-full font-semibold ml-1 ${semitones === maleSemi ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                남
              </button>
              <button onClick={() => setSemitones(femaleSemi)}
                className={`text-[10px] px-2 h-6 rounded-full font-semibold ${semitones === femaleSemi ? 'bg-pink-100 text-pink-500' : 'bg-gray-100 text-gray-400'}`}>
                여
              </button>

              <div className="flex-1" />

              {/* Time signature (long-press) */}
              <div className="relative">
                <button
                  onPointerDown={tsDown} onPointerUp={tsUp} onPointerLeave={tsUp}
                  className="text-[11px] font-bold text-gray-500 px-1.5 h-6 rounded bg-gray-100 select-none touch-none">
                  {timeSig}
                </button>
                {timeSigOpen && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    {TIME_SIG_OPTIONS.map(ts => (
                      <button key={ts}
                        onClick={() => { setTimeSig(ts); setTsOpen(false); }}
                        className={`block w-full px-5 py-2 text-sm font-semibold text-left ${
                          ts === timeSig ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                        }`}>{ts}</button>
                    ))}
                    <button onClick={() => setTsOpen(false)}
                      className="block w-full px-5 py-2 text-xs text-gray-400 border-t border-gray-100">취소</button>
                  </div>
                )}
              </div>

              {/* BPM with +/- */}
              <div className="flex items-center gap-0.5 ml-1">
                <button onClick={() => adjustBpm(-1)}
                  className="w-6 h-6 flex items-center justify-center rounded-l-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200 select-none">−</button>
                {bpmEditing ? (
                  <input autoFocus value={bpmDraft} onChange={e => setBpmDraft(e.target.value)}
                    onBlur={commitBpm}
                    onKeyDown={e => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setBpmEd(false); }}
                    className="w-12 text-center text-sm font-mono font-bold border-y border-gray-200 outline-none bg-white h-6" />
                ) : (
                  <button onPointerDown={bpmDown} onPointerUp={bpmUp} onPointerLeave={bpmUp}
                    className="text-sm font-mono font-bold text-gray-500 px-1 h-6 bg-gray-50 border-y border-gray-200 select-none touch-none min-w-[2.5rem] text-center">
                    {bpm}<span className="text-[9px] font-normal text-gray-400">bpm</span>
                  </button>
                )}
                <button onClick={() => adjustBpm(1)}
                  className="w-6 h-6 flex items-center justify-center rounded-r-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200 select-none">+</button>
              </div>

              {/* Play */}
              <button onClick={togglePlay}
                className={`h-7 w-8 flex items-center justify-center rounded-full text-xs font-bold ml-1 transition-colors ${
                  isCountingIn ? 'bg-amber-100 text-amber-600' :
                  isPlaying    ? 'bg-red-100 text-red-600' :
                                 'bg-indigo-600 text-white'
                }`}>
                {isPlaying || isCountingIn ? '■' : '▶'}
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
      <div className="flex-1 overflow-y-auto px-4 py-4" onClick={() => timeSigOpen && setTsOpen(false)}>
        <div className="max-w-2xl mx-auto">
          <SheetViewer
            sections={sections}
            semitones={semitones}
            currentPos={currentPos}
            showNotes={showNotes}
            songId={songId}
            isPlaying={isPlaying}
            editMode={editMode}
            setEditMode={setEditMode}
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
              <HelpRow icon="▶" title="재생 / 정지">마디 클릭 → 해당 위치부터 바로 재생. ▶ 버튼은 카운트인 후 시작.</HelpRow>
              <HelpRow icon="🥁" title="메트로놈">재생 시 상단에 박자 동글뱅이 표시. 카운트인은 주황색, 재생 중은 빨간색. 박자에 맞춰 마디 커서도 이동.</HelpRow>
              <HelpRow icon="♩" title="박자표 꾹 누르기">4/4 · 3/4 · 6/8 중 선택.</HelpRow>
              <HelpRow icon="↯" title="BPM 꾹 누르기">BPM 숫자를 길게 누르면 직접 입력. +/- 버튼으로 1씩 조절.</HelpRow>
              <HelpRow icon="남/여" title="키 전환">남/여 버튼으로 키 전환. 곡에 성별이 지정된 경우 해당 키로 설정됨.</HelpRow>
              <HelpRow icon="접기" title="헤더 접기">접기/펼치기 버튼으로 상단 컨트롤 토글.</HelpRow>
              <HelpRow icon="💬" title="마디 꾹 누르기 (일반 모드)">메모 입력 → 말풍선으로 표시.</HelpRow>
              <HelpRow icon="✎" title="편집 모드">
                {'• 섹션 이름 꾹 누르기 → 이름 변경\n• ⠿ 핸들 드래그 → 블록 순서 이동\n• ⊕ 블록 복사\n• ✕ 블록 삭제\n• 마디 탭 → 코드/가사 편집\n• 마디 꾹 누르기 → 행 선택 후 구간 이름 붙이기\n• 블록 사이 + 버튼 → 새 구간 추가\n• 원본 복귀 버튼으로 초기화'}
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
