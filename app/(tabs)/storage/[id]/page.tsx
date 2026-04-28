import StorageDetailClient from './StorageDetailClient';

export default async function StorageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StorageDetailClient collectionId={id} />;
}
