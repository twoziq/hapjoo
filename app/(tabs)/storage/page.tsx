import { listMyCollections } from '@/lib/db/collections';
import { getSession } from '@/lib/auth';
import StorageClient from './StorageClient';

export default async function StoragePage() {
  const session = await getSession();
  const collections = session ? await listMyCollections() : [];
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold">저장소</h1>
      </div>
      <StorageClient initialCollections={collections} loggedIn={!!session} />
    </div>
  );
}
