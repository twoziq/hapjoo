import { Suspense } from 'react';
import MyClient from './MyClient';

export default function MyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">불러오는 중…</div>}>
      <MyClient />
    </Suspense>
  );
}
