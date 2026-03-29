import type { Metadata } from 'next';
import CoupangBanner from '@/components/CoupangBanner';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import LifeHeader from '@/components/life/LifeHeader';

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
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <LifeHeader />

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start">
          <div className="flex-1 min-w-0">{children}</div>
          <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-life" />
            </div>
          </aside>
        </div>
      </main>

      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-1">픽앤조이</p>
            <p className="text-stone-500">pick-n-joy.com</p>
          </div>
          <div className="text-center md:text-right text-stone-500">
            <p>데이터 출처: 카카오 로컬 API · 공공데이터포털</p>
            <p className="text-xs text-stone-600 mt-1 text-center md:text-right">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
