'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants';

const TOP_LEVEL_TABS: readonly string[] = [
  ROUTES.songs,
  ROUTES.chords,
  ROUTES.tuner,
  ROUTES.storage,
];

export default function TopBar() {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_TABS.includes(pathname);
  if (!isTopLevel) return null;

  return (
    <div className="fixed top-2 right-2 z-40">
      <Link
        href={ROUTES.settings}
        prefetch
        aria-label="설정"
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/85 backdrop-blur border border-gray-200 text-gray-500 shadow-sm hover:bg-white active:bg-gray-50"
      >
        ⚙️
      </Link>
    </div>
  );
}
