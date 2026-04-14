'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface PageContentShellProps {
  children: ReactNode;
}

export default function PageContentShell({ children }: PageContentShellProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  // overflow-x: clip - hidden처럼 가로 넘침을 숨기지만 스크롤 컨텍스트를 만들지 않음 (sticky 정상 작동)
  return <div className={`flex-1 overflow-x-clip ${isHome ? '' : 'bg-cherry-blossom pt-8 md:pt-10'}`}>{children}</div>;
}