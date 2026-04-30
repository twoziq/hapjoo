'use client';

import { useEffect, useState } from 'react';
import SongEditorClient, { type SongEditorMode } from '@/components/SongEditor';
import type { EditorData } from '@/types/sheet';
import { useSession } from '@/lib/hooks/useSession';
import { getSupabase, supabaseConfigured } from '@/lib/supabase/client';

interface Props {
  initialData: EditorData;
  editSongId: string;
}

export default function EditSongClient({ initialData, editSongId }: Props) {
  const { isAuthenticated, isAdmin, loading } = useSession();
  // RPC 결과만 effect로 채움. 동기 분기는 모두 아래 mode 계산에서 처리.
  const [canEditFromRpc, setCanEditFromRpc] = useState<boolean | null>(null);

  const needsRpc = !loading && isAuthenticated && !isAdmin && supabaseConfigured;

  useEffect(() => {
    if (!needsRpc) return;
    let cancelled = false;
    const sb = getSupabase();
    sb.rpc('can_edit_song', { sid: editSongId }).then(({ data, error }) => {
      if (cancelled) return;
      setCanEditFromRpc(error ? false : !!data);
    });
    return () => {
      cancelled = true;
    };
  }, [needsRpc, editSongId]);

  const mode: SongEditorMode = (() => {
    if (loading) return 'none';
    if (!isAuthenticated) return 'none';
    if (isAdmin) return 'edit-direct';
    if (canEditFromRpc === null) return 'none';
    return canEditFromRpc ? 'edit-direct' : 'edit-request';
  })();

  return <SongEditorClient initialData={initialData} editSongId={editSongId} mode={mode} />;
}
