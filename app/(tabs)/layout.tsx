'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import TopBar from '@/components/TopBar';

const TABS = [
  { href: ROUTES.songs, label: '악보', icon: '♪' },
  { href: ROUTES.chords, label: '코드표', icon: '✋' },
  { href: ROUTES.tuner, label: '튜너', icon: '🎸' },
  { href: ROUTES.storage, label: '저장소', icon: '📁' },
] as const;

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-dvh">
      <TopBar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="shrink-0 flex border-t border-gray-200 bg-white safe-area-bottom">
        {TABS.map(({ href, label, icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === ROUTES.songs && pathname.startsWith('/viewer/'));
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={`flex-1 flex flex-col items-center justify-center py-2 text-xs gap-0.5 transition-colors ${
                active ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
