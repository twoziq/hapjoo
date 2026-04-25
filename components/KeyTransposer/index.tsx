'use client';

import { transposeNote } from '@/lib/transpose';

interface KeyTransposerProps {
  originalKey: string;
  semitones: number;
  onChange: (semitones: number) => void;
}

export default function KeyTransposer({ originalKey, semitones, onChange }: KeyTransposerProps) {
  const currentKey = transposeNote(originalKey, semitones);

  return (
    <div className="flex flex-col gap-4 bg-gray-50 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 font-medium">현재 키</span>
          <span className="text-2xl font-black text-indigo-600">{currentKey}</span>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => onChange(semitones - 1)}
            className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm active:scale-95 transition-all text-xl font-bold"
          >
            -
          </button>
          <button 
            onClick={() => onChange(semitones + 1)}
            className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm active:scale-95 transition-all text-xl font-bold"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => onChange(0)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            semitones === 0 ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          원키
        </button>
        <button 
          onClick={() => onChange(5)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            semitones === 5 ? 'bg-pink-500 text-white' : 'bg-white border border-gray-200 text-pink-500'
          }`}
        >
          여자키 (+5)
        </button>
      </div>
      
      {semitones !== 0 && (
        <p className="text-[10px] text-center text-gray-400">
          원키({originalKey}) 대비 {semitones > 0 ? `+${semitones}` : semitones} 반음 이동됨
        </p>
      )}
    </div>
  );
}
