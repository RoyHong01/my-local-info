import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import type { Metadata } from 'next';
import ScrollRestorer from '@/components/ScrollRestorer';
import IncheonCardList from '@/components/IncheonCardList';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';

export const metadata: Metadata = {
  title: '인천 지역 정보 | 픽앤조이',
  description: '인천 지역의 최신 복지, 행사, 생활 정보를 한눈에 확인하세요.',
  alternates: { canonical: '/incheon/' },
  openGraph: {
    title: '인천 지역 정보 | 픽앤조이',
    description: '인천 지역의 최신 복지, 행사, 생활 정보를 한눈에 확인하세요.',
    url: 'https://pick-n-joy.com/incheon/',
  },
};

interface DataItem {
  [key: string]: unknown;
  expired?: boolean;
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

function getField(item: DataItem, keys: string[]): string {
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') return item[key] as string;
  }
  return '';
}

const cleanText = (text: string) =>
  text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export default async function IncheonPage() {
  const all = await readJson('incheon.json');
  const items = all.filter(i => !i.expired);

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          <div className="flex-1 min-w-0">
            <div className="mb-12">
              <h1 className="text-2xl font-extrabold flex items-center gap-3 mb-2">
                <span className="text-3xl">🏙</span> 인천 지역 정보
              </h1>
              <p className="mt-3 text-gray-500 text-sm">우리 동네 인천의 모든 소식. 놓치기 아까운 축제부터 든든한 보조금까지 한눈에 확인하세요.</p>
              <p className="text-xs text-stone-400 mt-1">총 {items.length}건</p>
            </div>

            <ScrollRestorer storageKey="incheonScrollY" />
            {items.length === 0 ? (
              <p className="text-stone-400 text-sm py-16 text-center">곧 업데이트될 예정입니다.</p>
            ) : (
              <IncheonCardList items={items} />
            )}
          </div>
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24 self-start sticky-sidebar">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-incheon-list" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
