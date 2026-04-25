import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';
import ScrollRestorer from '@/components/ScrollRestorer';
import SubsidyCardList from '@/components/SubsidyCardList';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import { getTopSubsidy } from '@/lib/priority-calculator';

export const metadata: Metadata = {
  title: '전국 보조금·복지 정보 | 픽앤조이',
  description: '전국의 보조금, 복지, 지원금 정보를 한눈에 확인하세요.',
  alternates: { canonical: '/subsidy/' },
  openGraph: {
    title: '전국 보조금·복지 정보 | 픽앤조이',
    description: '전국의 보조금, 복지, 지원금 정보를 한눈에 확인하세요.',
    url: 'https://pick-n-joy.com/subsidy/',
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

export default async function SubsidyPage() {
  const all = await readJson('subsidy.json');
  // SSG된 상세 페이지(Top 800)만 우선 노출 → 404 링크 차단
  const items = getTopSubsidy(all, 800) as DataItem[];

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          <div className="flex-1 min-w-0">
            <div className="mb-12">
              <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-2">
                <span className="text-3xl">💰</span> 전국 보조금·복지 정책
              </h1>
              <p className="mt-3 text-gray-500 text-sm">당신의 삶을 든든하게 채워줄 정책 가이드. 생애주기별 꼭 필요한 혜택들을 꼼꼼하게 골라 담았습니다.</p>
              <p className="text-xs text-stone-400 mt-1">총 {items.length}건</p>
            </div>

            <ScrollRestorer storageKey="subsidyScrollY" />
            {items.length === 0 ? (
              <p className="text-stone-400 text-sm py-16 text-center">곧 업데이트될 예정입니다.</p>
            ) : (
              <SubsidyCardList items={items} />
            )}
          </div>
          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <TaeheoAdBanner />
                <CoupangBanner bannerId="coupang-sidebar-subsidy-list" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
