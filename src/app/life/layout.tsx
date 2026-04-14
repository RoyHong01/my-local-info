import type { Metadata } from 'next';
import { Suspense } from 'react';
import LifeSidebarAds from '@/components/LifeSidebarAds';

export const metadata: Metadata = {
  title: '일상의 즐거움 | 픽앤조이',
  description: '맛집 탐방과 쇼핑 초이스를 한 번에 확인하는 일상의 즐거움 섹션입니다.',
  alternates: { canonical: '/life/' },
  openGraph: {
    title: '일상의 즐거움 | 픽앤조이',
    description: '맛집 탐방과 쇼핑 초이스를 한 번에 확인하는 일상의 즐거움 섹션입니다.',
    url: 'https://pick-n-joy.com/life/',
  },
};

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          <div className="flex-1 min-w-0">{children}</div>
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24 self-start sticky-sidebar">
            <Suspense fallback={<div className="h-[730px]" />}>
              <LifeSidebarAds />
            </Suspense>
          </aside>
        </div>
      </main>
    </div>
  );
}
