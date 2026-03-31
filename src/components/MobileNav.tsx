'use client';

import { useState } from 'react';
import Link from 'next/link';
import SearchOverlay from './SearchOverlay';

const links = [
  { label: '인천시 정보', href: '/incheon' },
  { label: '전국 보조금·복지 정책', href: '/subsidy' },
  { label: '전국 축제·여행 정보', href: '/festival' },
  { label: '일상의 즐거움', href: '/life' },
  { label: '블로그', href: '/blog' },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Mobile buttons: search + hamburger */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="검색"
          className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-gradient-to-b from-orange-600 to-purple-700 border-t border-white/10 shadow-xl z-30">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {links.map(link => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-base font-medium rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
