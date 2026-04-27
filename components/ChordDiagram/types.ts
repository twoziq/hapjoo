export interface ChordEntry {
  name?: string;
  frets: string;
  fingers?: string;
  difficulty?: number;
  label?: string;
  alternatives?: ChordEntry[];
}
