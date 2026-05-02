import { getSongContent } from '@/lib/db/songs';
import ViewerClient from './ViewerClient';

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { id: rawId } = await params;
  const { room } = await searchParams;
  const id = decodeURIComponent(rawId);
  const markdown = await getSongContent(id);

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        악보를 찾을 수 없어요.
      </div>
    );
  }

  return <ViewerClient markdown={markdown} songId={id} roomId={room} />;
}
