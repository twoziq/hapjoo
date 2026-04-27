'use client';

import { useRef, useState } from 'react';
import { TIME_SIG_OPTIONS, type TimeSig } from './types';

interface Props {
  semitones: number;
  setSemitones: (s: number | ((prev: number) => number)) => void;
  maleSemi: number;
  femaleSemi: number;
  currentKey: string;

  timeSig: TimeSig;
  setTimeSig: (ts: TimeSig) => void;

  bpm: number;
  setBpm: (bpm: number | ((prev: number) => number)) => void;

  isPlaying: boolean;
  isCountingIn: boolean;
  onTogglePlay: () => void;

  showNotes: boolean;
  setShowNotes: (v: boolean) => void;
}

const LONG_PRESS_MS = 500;

export default function PlaybackControls({
  semitones,
  setSemitones,
  maleSemi,
  femaleSemi,
  currentKey,
  timeSig,
  setTimeSig,
  bpm,
  setBpm,
  isPlaying,
  isCountingIn,
  onTogglePlay,
  showNotes,
  setShowNotes,
}: Props) {
  const [timeSigOpen, setTsOpen] = useState(false);
  const [bpmEditing, setBpmEditing] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');

  const tsLongRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bpmLongRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function tsDown() {
    tsLongRef.current = setTimeout(() => setTsOpen(true), LONG_PRESS_MS);
  }
  function tsUp() {
    if (tsLongRef.current) clearTimeout(tsLongRef.current);
  }

  function bpmDown() {
    bpmLongRef.current = setTimeout(() => {
      setBpmDraft(String(bpm));
      setBpmEditing(true);
    }, LONG_PRESS_MS);
  }
  function bpmUp() {
    if (bpmLongRef.current) clearTimeout(bpmLongRef.current);
  }
  function commitBpm() {
    const v = parseInt(bpmDraft, 10);
    if (v >= 20 && v <= 300) setBpm(v);
    setBpmEditing(false);
  }
  function adjustBpm(delta: number) {
    setBpm((prev) => Math.min(300, Math.max(20, prev + delta)));
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => setSemitones(maleSemi)}
        className={`text-[11px] px-2.5 h-7 rounded-l-full font-bold transition-colors border ${
          semitones === maleSemi
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}
      >
        남
      </button>
      <button
        onClick={() => setSemitones(femaleSemi)}
        className={`text-[11px] px-2.5 h-7 rounded-r-full font-bold transition-colors border-t border-b border-r ${
          semitones === femaleSemi
            ? 'bg-pink-500 text-white border-pink-500'
            : 'bg-gray-100 text-gray-500 border-gray-200'
        }`}
      >
        여
      </button>

      <button
        onClick={() => setSemitones((s) => s - 1)}
        aria-label="키 -1"
        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs font-bold active:bg-gray-200 ml-1"
      >
        −
      </button>
      <span className="text-sm font-black text-indigo-600 w-6 text-center">{currentKey}</span>
      <button
        onClick={() => setSemitones((s) => s + 1)}
        aria-label="키 +1"
        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs font-bold active:bg-gray-200"
      >
        +
      </button>

      <div className="flex-1" />

      <div className="relative">
        <button
          onPointerDown={tsDown}
          onPointerUp={tsUp}
          onPointerLeave={tsUp}
          aria-label={`박자표 ${timeSig}`}
          className="text-[11px] font-bold text-gray-500 px-1.5 h-6 rounded bg-gray-100 select-none touch-none"
        >
          {timeSig}
        </button>
        {timeSigOpen && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
            {TIME_SIG_OPTIONS.map((ts) => (
              <button
                key={ts}
                onClick={() => {
                  setTimeSig(ts);
                  setTsOpen(false);
                }}
                className={`block w-full px-5 py-2 text-sm font-semibold text-left ${
                  ts === timeSig ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {ts}
              </button>
            ))}
            <button
              onClick={() => setTsOpen(false)}
              className="block w-full px-5 py-2 text-xs text-gray-400 border-t border-gray-100"
            >
              취소
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 ml-1">
        <button
          onClick={() => adjustBpm(-1)}
          aria-label="BPM -1"
          className="w-6 h-6 flex items-center justify-center rounded-l-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200 select-none"
        >
          −
        </button>
        {bpmEditing ? (
          <input
            autoFocus
            value={bpmDraft}
            onChange={(e) => setBpmDraft(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitBpm();
              if (e.key === 'Escape') setBpmEditing(false);
            }}
            className="w-12 text-center text-sm font-mono font-bold border-y border-gray-200 outline-none bg-white h-6"
          />
        ) : (
          <button
            onPointerDown={bpmDown}
            onPointerUp={bpmUp}
            onPointerLeave={bpmUp}
            aria-label={`BPM ${bpm}`}
            className="text-sm font-mono font-bold text-gray-500 px-1 h-6 bg-gray-50 border-y border-gray-200 select-none touch-none min-w-[2.5rem] text-center"
          >
            {bpm}
            <span className="text-[9px] font-normal text-gray-400">bpm</span>
          </button>
        )}
        <button
          onClick={() => adjustBpm(1)}
          aria-label="BPM +1"
          className="w-6 h-6 flex items-center justify-center rounded-r-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200 select-none"
        >
          +
        </button>
      </div>

      <button
        onClick={onTogglePlay}
        aria-label={isPlaying || isCountingIn ? '정지' : '재생'}
        className={`h-7 w-8 flex items-center justify-center rounded-full text-xs font-bold ml-1 transition-colors ${
          isCountingIn
            ? 'bg-amber-100 text-amber-600'
            : isPlaying
              ? 'bg-red-100 text-red-600'
              : 'bg-indigo-600 text-white'
        }`}
      >
        {isPlaying || isCountingIn ? '■' : '▶'}
      </button>

      <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none ml-1">
        <input
          type="checkbox"
          checked={showNotes}
          onChange={(e) => setShowNotes(e.target.checked)}
          className="w-3 h-3 accent-indigo-600"
        />
        메모
      </label>
    </div>
  );
}
