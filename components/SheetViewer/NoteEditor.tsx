'use client';

import { useState } from 'react';

interface Props {
  initial: string;
  hasExisting: boolean;
  onSave: (text: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export default function NoteEditor({ initial, hasExisting, onSave, onDelete, onCancel }: Props) {
  const [draft, setDraft] = useState(initial);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-3 text-gray-700">마디 메모</h3>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 마디에 대한 메모…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
          rows={3}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSave(draft)}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold"
          >
            저장
          </button>
          {hasExisting && (
            <button
              onClick={onDelete}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-red-500 bg-red-50"
            >
              삭제
            </button>
          )}
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-gray-400">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
