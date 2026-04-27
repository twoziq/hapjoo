'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES, STORAGE_KEYS } from '@/lib/constants';
import { safeSetItem } from '@/lib/storage';
import { parseSheet } from '@/lib/sheet';
import { FEMALE_KEY_OFFSET, transposeNote } from '@/lib/transpose';
import SheetViewer from '@/components/SheetViewer';
import HelpModal from './HelpModal';
import PlaybackControls from './PlaybackControls';
import { useSemitones } from './hooks/useSemitones';
import { type FlatMeasure, usePlayback } from './hooks/usePlayback';
import { type TimeSig } from './types';

interface Props {
  markdown: string;
  songId: string;
}

export default function ViewerClient({ markdown, songId }: Props) {
  const router = useRouter();
  const [semitones, setSemitones] = useSemitones(songId);
  const [showNotes, setShowNotes] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [bpmToast, setBpmToast] = useState(false);

  const { meta, sections } = useMemo(() => parseSheet(markdown), [markdown]);

  const rawBpm = (meta.bpm as number) || 0;
  const [bpm, setBpm] = useState<number>(rawBpm || 100);
  const [bpmMissing] = useState<boolean>(rawBpm === 0);
  const [timeSig, setTimeSig] = useState<TimeSig>('4/4');

  const flatMeasures: FlatMeasure[] = useMemo(() => {
    const r: FlatMeasure[] = [];
    sections.forEach((s, si) => {
      if (s.chords.length > 0) {
        const n = s.measures?.length || 1;
        for (let mi = 0; mi < n; mi++) r.push({ si, mi });
      }
    });
    return r;
  }, [sections]);

  const playback = usePlayback({ flatMeasures, bpm, timeSig });

  // Save last viewed song for tab navigation hints
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.lastSong, songId);
  }, [songId]);

  function togglePlay() {
    if (!playback.isPlaying && !playback.isCountingIn && bpmMissing) {
      setBpmToast(true);
      setTimeout(() => setBpmToast(false), 3000);
    }
    playback.toggle();
  }

  function onCellTap(si: number, mi: number) {
    const idx = flatMeasures.findIndex((m) => m.si === si && m.mi === mi);
    if (idx < 0) return;
    playback.seekTo(idx);
  }

  const currentPos = flatMeasures[playback.playIdx] ?? null;
  const cursorActive = playback.isPlaying || playback.isCountingIn;
  const currentKey = transposeNote((meta.key as string) ?? 'C', semitones);
  const beatsPerBar = parseInt(timeSig.split('/')[0], 10);
  const showBeatBar = playback.isPlaying || playback.isCountingIn;

  const songGender = (meta.gender as string) || '남';
  const maleSemi = songGender === '여' ? -FEMALE_KEY_OFFSET : 0;
  const femaleSemi = songGender === '여' ? 0 : FEMALE_KEY_OFFSET;

  return (
    <div className="flex flex-col h-full">
      {bpmToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none">
          BPM이 설정되지 않았어요. 100으로 시작합니다.
        </div>
      )}

      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-2">
          {showBeatBar && (
            <div className="flex items-center justify-center gap-2 mb-2">
              {Array.from({ length: beatsPerBar }).map((_, i) => {
                const isActive = i === playback.beatState.beat;
                return (
                  <span
                    key={isActive ? `b${i}_${playback.beatState.tick}` : `b${i}`}
                    className={`inline-block rounded-full transition-colors duration-75 ${
                      isActive
                        ? `w-5 h-5 beat-pulse ${playback.isCountingIn ? 'bg-amber-400' : 'bg-red-500'}`
                        : 'w-4 h-4 bg-green-200'
                    }`}
                  />
                );
              })}
              {playback.isCountingIn && (
                <span className="text-[10px] text-amber-500 font-semibold ml-1">카운트인...</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold leading-tight truncate">
                {(meta.title as string) ?? '악보'}
              </p>
              <p className="text-[11px] text-gray-400 truncate leading-none mt-0.5">
                {meta.artist as string}
              </p>
            </div>
            {(meta.capo as number) > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                카포 {meta.capo}
              </span>
            )}
            <button
              onClick={() => setShowHelp(true)}
              aria-label="도움말"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs font-bold shrink-0"
            >
              ?
            </button>
            <button
              onClick={() => router.push(ROUTES.viewerEdit(songId))}
              aria-label="악보 편집"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm shrink-0"
            >
              ✎
            </button>
            <button
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold shrink-0"
            >
              {headerCollapsed ? (
                <>
                  <span className="text-[13px]">▾</span>
                  <span>펼치기</span>
                </>
              ) : (
                <>
                  <span className="text-[13px]">▴</span>
                  <span>접기</span>
                </>
              )}
            </button>
          </div>

          {!headerCollapsed && (
            <PlaybackControls
              semitones={semitones}
              setSemitones={setSemitones}
              maleSemi={maleSemi}
              femaleSemi={femaleSemi}
              currentKey={currentKey}
              timeSig={timeSig}
              setTimeSig={setTimeSig}
              bpm={bpm}
              setBpm={setBpm}
              isPlaying={playback.isPlaying}
              isCountingIn={playback.isCountingIn}
              onTogglePlay={togglePlay}
              showNotes={showNotes}
              setShowNotes={setShowNotes}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <SheetViewer
            sections={sections}
            semitones={semitones}
            currentPos={currentPos}
            cursorActive={cursorActive}
            showNotes={showNotes}
            songId={songId}
            isPlaying={playback.isPlaying}
            onCellTap={onCellTap}
          />
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
