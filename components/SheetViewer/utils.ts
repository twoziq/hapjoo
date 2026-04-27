import type { SheetSection } from '@/types/sheet';

export interface OSection {
  uid: string;
  section: SheetSection;
  originalIdx: number;
}

export interface Block {
  id: string;
  label: OSection | null;
  rows: OSection[];
}

export function toBlocks(list: OSection[]): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const os of list) {
    if (os.section.chords.length === 0) {
      if (cur) out.push(cur);
      cur = { id: os.uid, label: os, rows: [] };
    } else {
      if (!cur) cur = { id: `intro_${os.uid}`, label: null, rows: [] };
      cur.rows.push(os);
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function noteKey(originalIdx: number, mi: number): string {
  return `${originalIdx}_${mi}`;
}

export function buildOSections(sections: SheetSection[]): OSection[] {
  return sections.map((s, i) => ({ uid: `s${i}`, section: { ...s }, originalIdx: i }));
}
