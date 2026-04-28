'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { SONGS_TAG } from '@/lib/db/songs';

export async function revalidateSongsList(): Promise<void> {
  revalidateTag(SONGS_TAG, 'max');
  revalidatePath('/songs');
}

export async function revalidateSongDetail(id: string): Promise<void> {
  revalidateTag(SONGS_TAG, 'max');
  revalidatePath(`/viewer/${id}`);
}
