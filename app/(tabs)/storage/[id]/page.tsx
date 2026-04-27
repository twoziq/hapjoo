import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCollection, listCollectionSongs } from '@/lib/db/collections';
import { getMyMembership, listMembers } from '@/lib/db/collectionMembers';
import StorageDetailClient from './StorageDetailClient';

export default async function StorageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        저장소는 로그인 후 사용할 수 있어요.
      </div>
    );
  }
  const collection = await getCollection(id);
  if (!collection) notFound();

  const [songs, members, membership] = await Promise.all([
    listCollectionSongs(id),
    listMembers(id),
    getMyMembership(id, session.user.id),
  ]);

  if (!membership) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">
        이 저장소의 멤버가 아니에요.
      </div>
    );
  }

  return (
    <StorageDetailClient
      collection={collection}
      songs={songs}
      members={members}
      currentUserId={session.user.id}
      myRole={membership.role}
    />
  );
}
