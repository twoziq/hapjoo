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
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId);

    const filePath = findSongPath(id);
    if (!filePath) {
      return Response.json({ error: `악보를 찾을 수 없어요. (id: ${id})` }, { status: 404 });
    }

    const body = await request.json();
    const content = body?.content;
    if (typeof content !== 'string') {
      return Response.json({ error: `content 타입 오류: ${typeof content}` }, { status: 400 });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return Response.json({ ok: true, path: filePath });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error('[PUT /api/songs]', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
