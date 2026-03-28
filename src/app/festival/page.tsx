import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import ScrollRestorer from '@/components/ScrollRestorer';
import FestivalCardList from '@/components/FestivalCardList';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';

export const metadata: Metadata = {
  title: '전국 축제·여행 정보 | 픽앤조이',
  description: '전국의 축제, 여행, 관광 정보를 한눈에 확인하세요.',
  alternates: { canonical: '/festival/' },
  openGraph: {
    title: '전국 축제·여행 정보 | 픽앤조이',
    description: '전국의 축제, 여행, 관광 정보를 한눈에 확인하세요.',
    url: 'https://pick-n-joy.com/festival/',
  },
};

interface DataItem {
  [key: string]: unknown;
  expired?: boolean;
}

function hasContentId(item: DataItem): boolean {
  return typeof item.contentid === 'string' && item.contentid.trim().length > 0;
}

async function readJson(filename: string): Promise<DataItem[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export default async function FestivalPage() {
  const all = await readJson('festival.json');
  const activeItems = all.filter(i => !i.expired);
  const apiItems = activeItems.filter(hasContentId);
  const items = apiItems.length > 0 ? apiItems : activeItems;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
              <li><Link href="/incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
              <li><Link href="/subsidy" className="hover:text-amber-600 transition">전국 보조금·복지 정책</Link></li>
              <li><Link href="/festival" className="text-rose-600 font-bold">전국 축제·여행 정보</Link></li>
              <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-2">
                <span className="text-3xl">🎪</span> 전국 축제·여행 정보
              </h1>
              <p className="text-stone-500 text-sm">전국 축제, 관광지, 여행 추천, 계절 이벤트 전체 목록입니다.</p>
            </div>

            <ScrollRestorer storageKey="festivalScrollY" />
            {items.length === 0 ? (
              <p className="text-stone-400 text-sm py-16 text-center">곧 업데이트될 예정입니다.</p>
            ) : (
              <FestivalCardList items={items} />
            )}
          </div>
          <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24 flex flex-col gap-4">
            <TaeheoAdBanner />
            <CoupangBanner />
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
            <p>데이터 출처: 공공데이터포털 · 한국관광공사</p>
            <p className="text-stone-500 text-xs mt-2">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
