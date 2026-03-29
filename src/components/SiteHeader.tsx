'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function navClass(isActive: boolean, activeClass: string, hoverClass: string): string {
  if (isActive) return `${activeClass} font-bold`;
  return `${hoverClass} transition`;
}

export default function SiteHeader() {
  const pathname = usePathname() || '';

  const isIncheon = pathname.startsWith('/incheon');
  const isSubsidy = pathname.startsWith('/subsidy');
  const isFestival = pathname.startsWith('/festival');
  const isBlog = pathname.startsWith('/blog');
  const isLife = pathname.startsWith('/life');
  const isAbout = pathname.startsWith('/about');

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
        <nav>
          <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
            <li><Link href="/incheon" className={navClass(isIncheon, 'text-blue-600', 'hover:text-blue-600')}>인천시 정보</Link></li>
            <li><Link href="/subsidy" className={navClass(isSubsidy, 'text-amber-600', 'hover:text-amber-600')}>전국 보조금·복지 정책</Link></li>
            <li><Link href="/festival" className={navClass(isFestival, 'text-rose-600', 'hover:text-rose-600')}>전국 축제·여행 정보</Link></li>
            <li><Link href="/blog" className={navClass(isBlog, 'text-orange-500', 'hover:text-orange-500')}>블로그</Link></li>
            <li><Link href="/life" className={navClass(isLife, 'text-orange-500', 'hover:text-orange-500')}>일상의 즐거움</Link></li>
            <li><Link href="/about" className={navClass(isAbout, 'text-orange-500', 'hover:text-orange-500')}>소개</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
