import ViewerClient from './ViewerClient';
import { supabase } from '@/lib/supabase';
import { getSongMarkdown } from '@/data/songs/index';

export default async function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let markdown = getSongMarkdown(id);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co'
  ) {
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

  return <ViewerClient markdown={markdown} />;
}
