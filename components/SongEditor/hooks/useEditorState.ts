'use client';

import { useState } from 'react';
import type { Measure, Section } from '@/types/sheet';
import { emptyRow, emptySection } from '@/lib/sheet/editor';

export function useEditorState(initial: Section[]) {
  const [sections, setSections] = useState<Section[]>(initial);

  function updateSection(si: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection()]);
  }

  function removeSection(si: number) {
    setSections((prev) => prev.filter((_, i) => i !== si));
  }

  function moveSection(from: number, to: number) {
    setSections((prev) => {
      const arr = [...prev];
      const [rem] = arr.splice(from, 1);
      arr.splice(to, 0, rem);
      return arr;
    });
  }

  function addRow(si: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, rows: [...s.rows, emptyRow()] } : s)),
    );
  }

  function removeRow(si: number, ri: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const rows = s.rows.filter((_, j) => j !== ri);
        return { ...s, rows: rows.length ? rows : [emptyRow()] };
      }),
    );
  }

  function moveRow(si: number, from: number, to: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const rows = [...s.rows];
        const [removed] = rows.splice(from, 1);
        rows.splice(to, 0, removed);
        return { ...s, rows };
      }),
    );
  }

  function updateMeasure(si: number, ri: number, mi: number, patch: Partial<Measure>) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const rows = s.rows.map((r, j) => {
          if (j !== ri) return r;
          const measures = r.measures.map((m, k) => (k === mi ? { ...m, ...patch } : m));
          return { ...r, measures };
        });
        return { ...s, rows };
      }),
    );
  }

  function batchUpdateChords(si: number, ri: number, chords: string[]) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const rows = s.rows.map((r, j) => {
          if (j !== ri) return r;
          const measures = r.measures.map((m, k) => ({ ...m, chord: chords[k] ?? '' }));
          return { ...r, measures };
        });
        return { ...s, rows };
      }),
    );
  }

  return {
    sections,
    setSections,
    updateSection,
    addSection,
    removeSection,
    moveSection,
    addRow,
    removeRow,
    moveRow,
    updateMeasure,
    batchUpdateChords,
  };
}

export type EditorActions = ReturnType<typeof useEditorState>;
