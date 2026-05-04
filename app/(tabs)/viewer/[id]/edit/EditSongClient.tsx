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
  const { isAuthenticated, isAdmin, isManager, loading } = useSession();
  const [canEditFromRpc, setCanEditFromRpc] = useState<boolean | null>(null);

  const needsRpc = !loading && isAuthenticated && !isManager && supabaseConfigured;

  useEffect(() => {
    if (!needsRpc) return;
    let cancelled = false;
    const sb = getSupabase();
    sb.rpc('can_edit_song', { sid: editSongId }).then(({ data, error }) => {
      if (cancelled) return;
      setCanEditFromRpc(error ? false : !!data);
    });
    return () => { cancelled = true; };
  }, [needsRpc, editSongId]);

  const mode: SongEditorMode = (() => {
    if (loading) return 'none';
    if (!isAuthenticated) return 'none';
    if (isManager) return 'edit-direct';
    if (canEditFromRpc === null) return 'none';
    return canEditFromRpc ? 'edit-direct' : 'edit-request';
  })();

  return <SongEditorClient initialData={initialData} editSongId={editSongId} mode={mode} />;
}
