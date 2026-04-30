import { getSongContent } from '@/lib/db/songs';
import { parseCodeToData } from '@/lib/sheet';
import EditSongClient from './EditSongClient';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const markdown = await getSongContent(id);

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        악보를 찾을 수 없어요.
      </div>
    );
  }

  const initialData = parseCodeToData(markdown);
  return <EditSongClient initialData={initialData} editSongId={id} />;
}
