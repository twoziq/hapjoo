import noeul from './노을';
import neoege from './너에게난_나에게넌';
import superman from './슈퍼맨';
import eyeContact from './눈이마주쳤을때';
import bumpercar from './범퍼카_New_Day_Ver';
import nightview from './야경';
import rules from './Rules';
import loveWillCome from './사랑하게될거야';
import isntItNice from './좋지아니한가';
import song26 from './26';
import hibully from './Hi_Bully';
import pretender from './Pretender';
import fire from './불';
import aluminium from './알루미늄';

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  key: string;
  gender?: '남' | '여';
  folder?: string;
}

export const SONGS: SongEntry[] = [
  { id: 'noeul',   title: '노을',             artist: '김광석',        key: 'G' },
  { id: 'neoege',  title: '너에게난 나에게넌', artist: '자전거탄 풍경', key: 'G' },
  { id: '슈퍼맨',           title: '슈퍼맨',             artist: '노라조',                  key: 'C#m', folder: '엔터' },
  { id: '눈이마주쳤을때',    title: '눈이 마주쳤을 때',   artist: '오오오 (0.0.0)',           key: 'Am',  folder: '엔터' },
  { id: '범퍼카_New_Day_Ver', title: '범퍼카',             artist: '데이브레이크',             key: 'C',   folder: '엔터' },
  { id: '야경',              title: '야경',               artist: '터치드',                  key: 'G',   folder: '엔터' },
  { id: 'Rules',             title: 'Rules',              artist: 'The Volunteers',          key: 'Ab',  folder: '엔터' },
  { id: '사랑하게될거야',    title: '사랑하게 될 거야',   artist: '한로로',                  key: 'G',   folder: '엔터' },
  { id: '좋지아니한가',      title: '좋지 아니한가',      artist: '유다빈 밴드',              key: 'Bb',  folder: '엔터' },
  { id: '26',                title: '26',                 artist: '윤하 (YOUNHA)',            key: 'F',   folder: '엔터' },
  { id: 'Hi_Bully',          title: 'Hi Bully',           artist: '터치드 (Touched)',         key: 'Em',  folder: '엔터' },
  { id: 'Pretender',         title: 'Pretender',          artist: 'Official髭男dism',         key: 'Ab',  folder: '엔터' },
  { id: '불',                title: '불',                 artist: '터치드 (Touched)',         key: 'Bm',  folder: '엔터' },
  { id: '알루미늄',          title: '알루미늄',           artist: '브로큰 발렌타인',          key: 'Em',  folder: '엔터' },
];

const CONTENT: Record<string, string> = {
  noeul,
  neoege,
  '슈퍼맨': superman,
  '눈이마주쳤을때': eyeContact,
  '범퍼카_New_Day_Ver': bumpercar,
  '야경': nightview,
  'Rules': rules,
  '사랑하게될거야': loveWillCome,
  '좋지아니한가': isntItNice,
  '26': song26,
  'Hi_Bully': hibully,
  'Pretender': pretender,
  '불': fire,
  '알루미늄': aluminium,
};

export function getSongMarkdown(id: string): string {
  return CONTENT[id] ?? '';
}

export function getSongsByFolder(): { folder: string | null; songs: SongEntry[] }[] {
  const map = new Map<string | null, SongEntry[]>();
  for (const s of SONGS) {
    const f = s.folder ?? null;
    if (!map.has(f)) map.set(f, []);
    map.get(f)!.push(s);
  }
  const result: { folder: string | null; songs: SongEntry[] }[] = [];
  if (map.has(null)) result.push({ folder: null, songs: map.get(null)! });
  map.forEach((songs, folder) => { if (folder !== null) result.push({ folder, songs }); });
  return result;
}
