'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface PageContentShellProps {
  children: ReactNode;
}

export default function PageContentShell({ children }: PageContentShellProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return <div className={`flex-1 overflow-x-hidden ${isHome ? '' : 'bg-cherry-blossom pt-8 md:pt-10'}`}>{children}</div>;
}