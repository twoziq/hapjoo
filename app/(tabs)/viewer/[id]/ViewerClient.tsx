'use client';

import { useState } from 'react';
import { parseSheet } from '@/lib/chordParser';
import KeyTransposer from '@/components/KeyTransposer';
import SheetViewer from '@/components/SheetViewer';

interface Props { markdown: string; }

export default function ViewerClient({ markdown }: Props) {
  const [semitones, setSemitones] = useState(0);
  const { meta, sections } = parseSheet(markdown);

  return (
    <div className="flex flex-col h-full">
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <SheetViewer sections={sections} semitones={semitones} />
        </div>
      </div>
    </div>
  );
}
