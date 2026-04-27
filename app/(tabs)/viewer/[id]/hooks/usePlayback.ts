'use client';

import { useEffect, useRef, useState } from 'react';
import { getBeatIntervalMs, getBeatsPerBar, type TimeSig } from '../types';

export interface FlatMeasure {
  si: number;
  mi: number;
}

export interface BeatState {
  beat: number;
  tick: number;
}

export interface PlaybackController {
  isPlaying: boolean;
  isCountingIn: boolean;
  beatState: BeatState;
  playIdx: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  seekTo: (idx: number) => void;
}

interface Options {
  flatMeasures: FlatMeasure[];
  bpm: number;
  timeSig: TimeSig;
}

type Phase = 'idle' | 'countIn' | 'playing';

export function usePlayback({ flatMeasures, bpm, timeSig }: Options): PlaybackController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [beatState, setBeatState] = useState<BeatState>({ beat: -1, tick: 0 });
  const [playIdx, setPlayIdx] = useState(0);

  const phaseRef = useRef<Phase>('idle');
  const beatsPerBarRef = useRef(getBeatsPerBar(timeSig));
  const beatIntervalRef = useRef(getBeatIntervalMs(timeSig, bpm));
  const countInCountRef = useRef(0);
  const playBeatCountRef = useRef(0);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIdxRef = useRef(0);
  const flatMeasuresRef = useRef<FlatMeasure[]>(flatMeasures);

  useEffect(() => {
    flatMeasuresRef.current = flatMeasures;
  }, [flatMeasures]);

  useEffect(() => {
    beatsPerBarRef.current = getBeatsPerBar(timeSig);
    beatIntervalRef.current = getBeatIntervalMs(timeSig, bpm);
  }, [timeSig, bpm]);

  function clearBeatTimer() {
    if (beatTimerRef.current) {
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = null;
    }
  }

  function stop() {
    clearBeatTimer();
    phaseRef.current = 'idle';
    setIsPlaying(false);
    setIsCountingIn(false);
    setBeatState({ beat: -1, tick: 0 });
  }

  function seekTo(idx: number) {
    playIdxRef.current = idx;
    setPlayIdx(idx);
  }

  function scheduleTick() {
    beatTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'idle') return;

      setBeatState((prev) => ({
        beat: (prev.beat + 1) % beatsPerBarRef.current,
        tick: prev.tick + 1,
      }));

      if (phaseRef.current === 'countIn') {
        countInCountRef.current++;
        if (countInCountRef.current >= beatsPerBarRef.current) {
          phaseRef.current = 'playing';
          setIsCountingIn(false);
          setIsPlaying(true);
          countInCountRef.current = 0;
          playBeatCountRef.current = 0;
        }
      } else if (phaseRef.current === 'playing') {
        playBeatCountRef.current++;
        if (playBeatCountRef.current >= beatsPerBarRef.current) {
          playBeatCountRef.current = 0;
          const next = playIdxRef.current + 1;
          if (next >= flatMeasuresRef.current.length) {
            stop();
            seekTo(0);
            return;
          }
          playIdxRef.current = next;
          setPlayIdx(next);
        }
      }

      scheduleTick();
    }, beatIntervalRef.current);
  }

  function start() {
    clearBeatTimer();
    countInCountRef.current = 0;
    playBeatCountRef.current = 0;
    setBeatState({ beat: 0, tick: 1 });
    phaseRef.current = 'countIn';
    setIsCountingIn(true);
    scheduleTick();
  }

  function toggle() {
    if (phaseRef.current !== 'idle') {
      stop();
      return;
    }
    start();
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearBeatTimer();
    };
  }, []);

  return {
    isPlaying,
    isCountingIn,
    beatState,
    playIdx,
    start,
    stop,
    toggle,
    seekTo,
  };
}
