// data/songs/**/*.txt 파일들은 scripts/generate-seed-sql.mjs가 읽어
// supabase에 일괄 시드하는 source 자료. 런타임에 직접 읽지 않음.

export interface SongEntry {
  id: string;
  title: string;
  artist: string;
  key: string;
  gender?: '남' | '여';
}
