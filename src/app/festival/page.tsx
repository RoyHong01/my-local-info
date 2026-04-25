import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';
import ScrollRestorer from '@/components/ScrollRestorer';
import FestivalCardList from '@/components/FestivalCardList';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import { getTopFestival } from '@/lib/priority-calculator';

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
  const baseItems = apiItems.length > 0 ? apiItems : activeItems;
  // SSG된 상세 페이지(Top 300)만 우선 노출 → 404 링크 차단
  const items = getTopFestival(baseItems, 300) as DataItem[];

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          <div className="flex-1 min-w-0">
            <div className="mb-12">
              <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-2">
                <span className="text-3xl">🎪</span> 전국 축제·여행 정보
              </h1>
              <p className="mt-3 text-gray-500 text-sm">떠나고 싶은 모든 순간을 위해, 전국의 계절 축제와 숨은 명소들을 에디터의 시선으로 큐레이션합니다.</p>
              <p className="text-xs text-stone-400 mt-1">총 {items.length}건</p>
            </div>

            <ScrollRestorer storageKey="festivalScrollY" />
            {items.length === 0 ? (
              <p className="text-stone-400 text-sm py-16 text-center">곧 업데이트될 예정입니다.</p>
            ) : (
              <FestivalCardList items={items} />
            )}
          </div>
          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <TaeheoAdBanner />
                <CoupangBanner bannerId="coupang-sidebar-festival-list" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
