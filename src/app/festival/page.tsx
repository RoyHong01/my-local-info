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
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start">
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
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24 self-start sticky-sidebar">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-festival-list" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
