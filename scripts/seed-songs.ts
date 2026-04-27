import fs from 'fs';
import path from 'path';

const SONGS_DIR = path.join(process.cwd(), 'data', 'songs');

export interface DiscoveredSong {
  id: string;
  title: string;
  artist: string;
  key: string;
  folder: string | null;
}

function parseMeta(content: string): { title: string; artist: string; key: string } {
  const get = (field: string) =>
    content.match(new RegExp(`\\{${field}:\\s*(.+?)\\}`))?.[1]?.trim() ?? '';
  return { title: get('title'), artist: get('artist'), key: get('key') };
}

export function scanSeedSongs(): DiscoveredSong[] {
  const songs: DiscoveredSong[] = [];
  if (!fs.existsSync(SONGS_DIR)) return songs;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(SONGS_DIR, { withFileTypes: true });
  } catch (e) {
    console.error('[seed-songs] readdir failed:', e);
    return songs;
  }

  for (const e of entries) {
    if (!e.isDirectory() && e.name.endsWith('.txt')) {
      try {
        const content = fs.readFileSync(path.join(SONGS_DIR, e.name), 'utf8');
        songs.push({ id: e.name.replace(/\.txt$/, ''), ...parseMeta(content), folder: null });
      } catch (err) {
        console.error('[seed-songs] read failed:', err);
      }
    }
  }

  for (const e of entries) {
    if (e.isDirectory()) {
      const folderPath = path.join(SONGS_DIR, e.name);
      try {
        const subs = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const sub of subs) {
          if (!sub.isDirectory() && sub.name.endsWith('.txt')) {
            try {
              const content = fs.readFileSync(path.join(folderPath, sub.name), 'utf8');
              songs.push({
                id: sub.name.replace(/\.txt$/, ''),
                ...parseMeta(content),
                folder: e.name,
              });
            } catch (err) {
              console.error('[seed-songs] read failed:', err);
            }
          }
        }
      } catch (err) {
        console.error('[seed-songs] subfolder readdir failed:', err);
      }
    }
  }

  return songs;
}

export function readSeedSongContent(id: string): string | null {
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return null;

  const rootPath = path.join(SONGS_DIR, `${id}.txt`);
  if (fs.existsSync(rootPath)) {
    try {
      return fs.readFileSync(rootPath, 'utf8');
    } catch {
      // continue to subfolder lookup
    }
  }

  if (!fs.existsSync(SONGS_DIR)) return null;
  try {
    const entries = fs.readdirSync(SONGS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const subPath = path.join(SONGS_DIR, e.name, `${id}.txt`);
        if (fs.existsSync(subPath)) {
          try {
            return fs.readFileSync(subPath, 'utf8');
          } catch {
            // continue
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}
