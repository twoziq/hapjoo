export interface Measure {
  chord: string;
  lyric: string;
}

export interface Row {
  id: string;
  measures: Measure[];
}

export interface Section {
  id: string;
  name: string;
  rows: Row[];
}

export interface SheetMeta {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  gender?: string;
  [key: string]: string | number | undefined;
}

export interface SheetSection {
  chords: string[];
  lyrics: string;
  measures: string[];
  restFrom?: number;
}

export interface ParsedSheet {
  meta: SheetMeta;
  sections: SheetSection[];
}

export interface EditorData {
  title: string;
  artist: string;
  key: string;
  gender: string;
  capo: number;
  bpm: number;
  sections: Section[];
}
