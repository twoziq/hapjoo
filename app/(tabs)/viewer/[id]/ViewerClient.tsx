'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { parseSheet } from '@/lib/chordParser';
import KeyTransposer from '@/components/KeyTransposer';
import SheetViewer from '@/components/SheetViewer';

interface Props { markdown: string; songId: string; }

export default function ViewerClient({ markdown, songId }: Props) {
  const [semitones, setSemitones] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const { meta, sections } = useMemo(() => parseSheet(markdown), [markdown]);

  const [bpm, setBpm] = useState<number>((meta.bpm as number) || 80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);

  // Flat list of all (sectionIdx, measureIdx) pairs in original order
  const flatMeasures = useMemo(() => {
    const result: { si: number; mi: number }[] = [];
    sections.forEach((section, si) => {
      if (section.chords.length > 0) {
        const count = section.measures?.length || 1;
        for (let mi = 0; mi < count; mi++) result.push({ si, mi });
      }
    });
    return result;
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
    }, Math.round(60000 / bpm));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, flatMeasures.length]);

  const currentPos = isPlaying ? (flatMeasures[playIdx] ?? null) : null;

  function togglePlay() {
    if (isPlaying) { setIsPlaying(false); }
    else { setPlayIdx(0); setIsPlaying(true); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h1 className="text-lg font-bold leading-tight">{(meta.title as string) ?? '악보'}</h1>
              <p className="text-sm text-gray-500">{meta.artist as string}</p>
            </div>
            {(meta.capo as number) > 0 && (
              <span className="shrink-0 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                카포 {meta.capo}
              </span>
            )}
          </div>

          <KeyTransposer
            originalKey={(meta.key as string) ?? 'C'}
            semitones={semitones}
            onChange={setSemitones}
          />

          {/* BPM + Play row */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 font-mono shrink-0">BPM</span>
            <button
              onClick={() => setBpm(b => Math.max(40, b - 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200"
            >−</button>
            <span className="w-8 text-center text-sm font-mono font-bold tabular-nums">{bpm}</span>
            <button
              onClick={() => setBpm(b => Math.min(240, b + 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200"
            >+</button>

            <button
              onClick={togglePlay}
              className={`ml-2 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                isPlaying
                  ? 'bg-red-100 text-red-600 active:bg-red-200'
                  : 'bg-indigo-600 text-white active:bg-indigo-700'
              }`}
            >
              {isPlaying ? '■ 정지' : '▶ 재생'}
            </button>

            <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={e => setShowNotes(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600"
              />
              메모 표시
            </label>
          </div>
        </div>
      </div>

      {/* Sheet body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <SheetViewer
            sections={sections}
            semitones={semitones}
            currentPos={currentPos}
            showNotes={showNotes}
            songId={songId}
            isPlaying={isPlaying}
          />
        </div>
      </div>
    </div>
  );
}
