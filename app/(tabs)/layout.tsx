'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/songs',  label: '악보',   icon: '♪' },
  { href: '/chords', label: '코드표', icon: '✋' },
  { href: '/tuner',  label: '튜너',   icon: '🎸' },
];

export default function TabsLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-dvh">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="shrink-0 flex border-t border-gray-200 bg-white safe-area-bottom">
        {TABS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
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
