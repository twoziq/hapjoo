import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const SONGS_DIR = path.join(process.cwd(), 'data', 'songs');

function findSongPath(id: string): string | null {
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return null;

  const rootPath = path.join(SONGS_DIR, `${id}.txt`);
  if (fs.existsSync(rootPath)) return rootPath;

  try {
    const entries = fs.readdirSync(SONGS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const subPath = path.join(SONGS_DIR, e.name, `${id}.txt`);
        if (fs.existsSync(subPath)) return subPath;
      }
    }
  } catch {}

  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const filePath = findSongPath(id);
  if (!filePath) {
    return Response.json({ error: '악보를 찾을 수 없어요.' }, { status: 404 });
  }

  try {
    const { content } = await request.json();
    if (typeof content !== 'string') {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '파일 저장 실패' }, { status: 500 });
  }
}
