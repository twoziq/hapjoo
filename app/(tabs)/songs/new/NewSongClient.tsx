'use client';

import SongEditorClient, { type SongEditorMode } from '@/components/SongEditor';
import { useSession } from '@/lib/hooks/useSession';

export default function NewSongClient() {
  const { isAuthenticated, isAdmin, loading } = useSession();

  let mode: SongEditorMode;
  if (loading) mode = 'none';
  else if (!isAuthenticated) mode = 'none';
  else if (isAdmin) mode = 'create-direct';
  else mode = 'create-request';

  return <SongEditorClient mode={mode} />;
}
