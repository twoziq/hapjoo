export type TimeSig = '4/4' | '3/4' | '6/8';
export const TIME_SIG_OPTIONS: TimeSig[] = ['4/4', '3/4', '6/8'];

export function getBeatsPerBar(ts: TimeSig): number {
  return parseInt(ts.split('/')[0], 10);
}

export function getBeatIntervalMs(ts: TimeSig, bpm: number): number {
  const d = parseInt(ts.split('/')[1], 10);
  return d === 8 ? Math.round((60000 / bpm) * 0.5) : Math.round(60000 / bpm);
}
