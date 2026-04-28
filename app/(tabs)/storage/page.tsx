import StorageClient from './StorageClient';

export default function StoragePage() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold">저장소</h1>
      </div>
      <StorageClient />
    </div>
  );
}
