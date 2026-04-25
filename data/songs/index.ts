import noeul from './노을';
import neoege from './너에게난_나에게넌';

export const SONGS = [
  { id: 'noeul',  title: '노을',             artist: '김광석',        key: 'G' },
  { id: 'neoege', title: '너에게난 나에게넌', artist: '자전거탄 풍경', key: 'G' },
];

const CONTENT: Record<string, string> = { noeul, neoege };

export function getSongMarkdown(id: string): string {
  return CONTENT[id] ?? '';
}
