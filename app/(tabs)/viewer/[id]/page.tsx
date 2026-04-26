import ViewerClient from './ViewerClient';
import { supabase } from '@/lib/supabase';
import { getSongContent } from '@/lib/songLoader';

export default async function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let markdown = getSongContent(id) ?? '';

  if (supabase) {
    const { data } = await supabase.from('songs').select('content').eq('id', id).single();
    if (data?.content) markdown = data.content;
  }

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        악보를 찾을 수 없어요.
      </div>
    );
  }

  return <ViewerClient markdown={markdown} songId={id} />;
}
