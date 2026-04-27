import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { getSession } from '@/lib/auth';
import { listMyCollections } from '@/lib/db/collections';
import StorageClient from './StorageClient';

export default async function StoragePage() {
  const session = await getSession();
  if (!session) {
    redirect(ROUTES.settings);
  }
  const collections = await listMyCollections();
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold">저장소</h1>
      </div>
      <StorageClient initialCollections={collections} />
    </div>
  );
}
