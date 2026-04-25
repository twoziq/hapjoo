'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const GUITAR_STRINGS = [
  { label: '6번', note: 'E', octave: 2, freq: 82.41 },
  { label: '5번', note: 'A', octave: 2, freq: 110.00 },
  { label: '4번', note: 'D', octave: 3, freq: 146.83 },
  { label: '3번', note: 'G', octave: 3, freq: 196.00 },
  { label: '2번', note: 'B', octave: 3, freq: 246.94 },
  { label: '1번', note: 'E', octave: 4, freq: 329.63 },
];

function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  const half = Math.floor(SIZE / 2);

  // Signal check
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / SIZE) < 0.012) return -1;

  // Autocorrelation
  const corr = new Float32Array(half);
  for (let lag = 1; lag < half; lag++) {
    let s = 0;
    for (let i = 0; i < half; i++) s += buf[i] * buf[i + lag];
    corr[lag] = s;
  }

  // Skip initial falling edge, find first local min
  let d = 1;
  while (d < half - 1 && corr[d] > corr[d + 1]) d++;

  // Find peak
  let maxC = -Infinity, maxL = d;
  for (let i = d; i < half; i++) {
    if (corr[i] > maxC) { maxC = corr[i]; maxL = i; }
  }
  if (maxC < 0.005) return -1;

  // Parabolic interpolation for sub-sample accuracy
  if (maxL > 0 && maxL < half - 1) {
    const y1 = corr[maxL - 1], y2 = corr[maxL], y3 = corr[maxL + 1];
    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;
    if (a < 0) maxL -= b / (2 * a);
  }

  return sampleRate / maxL;
}

function freqToNote(freq) {
  if (!freq || freq < 20 || freq > 5000) return null;
  const semis = 12 * Math.log2(freq / 440);
  const rounded = Math.round(semis);
  const cents = Math.round((semis - rounded) * 100);
  const midi = rounded + 69;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return { name, octave, cents, freq: +freq.toFixed(1) };
}

// Cents needle: -50 left, 0 center, +50 right
function CentsMeter({ cents }) {
  const pct = Math.max(-50, Math.min(50, cents));
  const left = ((pct + 50) / 100) * 100; // 0–100%
  const inTune = Math.abs(pct) <= 5;
  const color = inTune ? '#22c55e' : Math.abs(pct) <= 15 ? '#f59e0b' : '#ef4444';

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Track */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        {/* Green center zone */}
        <div className="absolute inset-y-0 left-[45%] w-[10%] bg-green-900 rounded-full" />
        {/* Needle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full transition-all duration-75"
          style={{ left: `calc(${left}% - 2px)`, background: color }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-1 text-xs text-gray-600">
        <span>♭ flat</span>
        <span style={{ color }} className="font-bold tabular-nums">
          {pct > 0 ? `+${pct}` : pct} ¢
        </span>
        <span>sharp ♯</span>
      </div>
    </div>
  );
}

export default function TunerPage() {
  const [active, setActive] = useState(false);
  const [note, setNote] = useState(null);
  const [err, setErr] = useState(null);

  const ctxRef   = useRef(null);
  const streamRef = useRef(null);
  const rafRef   = useRef(null);
  const bufRef   = useRef(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current = null;
    streamRef.current = null;
    setActive(false);
    setNote(null);
  }, []);

  const start = useCallback(async () => {
    try {
      setErr(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;

      ctx.createMediaStreamSource(stream).connect(analyser);
      bufRef.current = new Float32Array(analyser.fftSize);

      setActive(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(bufRef.current);
        const freq = autoCorrelate(bufRef.current, ctx.sampleRate);
        if (freq !== -1) setNote(freqToNote(freq));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setErr(e.name === 'NotAllowedError' ? '마이크 권한을 허용해 주세요.' : `오류: ${e.message}`);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const inTune = note && Math.abs(note.cents) <= 5;

  // Find closest guitar string
  const closestStr = note
    ? GUITAR_STRINGS.reduce((a, b) =>
        Math.abs(b.freq - note.freq) < Math.abs(a.freq - note.freq) ? b : a)
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Note display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {note ? (
          <>
            {/* Note name */}
            <div
              className="text-8xl font-black tracking-tight transition-colors duration-150"
              style={{ color: inTune ? '#22c55e' : '#f9fafb' }}
            >
              {note.name}
              <span className="text-3xl text-gray-500 align-super ml-1">{note.octave}</span>
            </div>

            {/* Frequency */}
            <p className="text-gray-400 text-lg tabular-nums">{note.freq} Hz</p>

            {/* Cents meter */}
            <CentsMeter cents={note.cents} />

            {/* In-tune label */}
            <p className={`text-sm font-semibold transition-opacity ${inTune ? 'opacity-100 text-green-400' : 'opacity-0'}`}>
              ✓ 정확
            </p>

            {/* Closest string hint */}
            {closestStr && (
              <p className="text-xs text-gray-600">
                {closestStr.label}줄({closestStr.note}{closestStr.octave}) 근처
              </p>
            )}
          </>
        ) : (
          <div className="text-center">
            <p className="text-6xl mb-4 opacity-20">𝄞</p>
            <p className="text-gray-500 text-sm">
              {active ? '소리를 감지하는 중...' : '튜너를 시작하세요'}
            </p>
          </div>
        )}
      </div>

      {/* Guitar string reference */}
      <div className="px-4 pb-2">
        <p className="text-xs text-gray-700 text-center mb-2">기준음</p>
        <div className="flex gap-1.5 justify-center">
          {GUITAR_STRINGS.map((s) => {
            const isClose = closestStr?.label === s.label;
            return (
              <div
                key={s.label}
                className={`flex flex-col items-center px-2 py-1.5 rounded-xl text-center transition-colors ${
                  isClose && active ? 'bg-indigo-900/60 text-indigo-300' : 'bg-gray-900 text-gray-500'
                }`}
              >
                <span className="text-xs font-bold">{s.note}</span>
                <span className="text-[10px] opacity-60">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start / Stop */}
      <div className="p-4 shrink-0">
        {err && <p className="text-red-400 text-xs text-center mb-2">{err}</p>}
        <button
          onClick={active ? stop : start}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            active
              ? 'bg-gray-800 text-gray-300 active:bg-gray-700'
              : 'bg-indigo-600 text-white active:bg-indigo-700'
          }`}
        >
          {active ? '■ 정지' : '▶ 튜너 시작'}
        </button>
      </div>
    </div>
  );
}
