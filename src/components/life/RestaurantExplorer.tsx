'use client';

import { useMemo, useState } from 'react';
import type { LifeRegionTab, RestaurantItem } from '@/lib/life-restaurants';

type RegionDataset = Record<LifeRegionTab, RestaurantItem[]>;

const tabMeta: Array<{ key: LifeRegionTab; label: string; description: string }> = [
  { key: 'incheon', label: '인천', description: '송도·청라·부평 중심으로 골랐어요' },
  { key: 'seoul', label: '서울', description: '성수·연남·한남 중심으로 모았어요' },
  { key: 'gyeonggi', label: '경기', description: '판교·수원·하남 중심으로 모았어요' },
];

export default function RestaurantExplorer({ datasets }: { datasets: RegionDataset }) {
  const [activeTab, setActiveTab] = useState<LifeRegionTab>('incheon');

  const activeItems = useMemo(() => datasets[activeTab] || [], [activeTab, datasets]);

  return (
    <section className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {tabMeta.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-stone-500">
          {tabMeta.find((tab) => tab.key === activeTab)?.description} 실제 검색 결과 기준으로 정리해드려요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {activeItems.map((item) => (
          <article
            key={item.id}
            className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:shadow-md hover:border-orange-200 transition"
          >
            <h3 className="text-xl font-extrabold mb-3 leading-snug">{item.name}</h3>
            <dl className="space-y-2 text-sm text-stone-600 mb-4">
              <div>
                <dt className="font-semibold text-stone-700">주소</dt>
                <dd>{item.address}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">전화번호</dt>
                <dd>{item.phone}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700">바로가기</dt>
                <dd className="flex items-center gap-2 text-[13px] sm:text-sm">
                  <a
                    href={item.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-orange-500 hover:underline"
                  >
                    지도에서 바로 보기
                  </a>
                  {item.blogHref && (
                    <>
                      <span className="text-stone-300">|</span>
                      <a
                        href={item.blogHref}
                        className="whitespace-nowrap text-orange-500 hover:underline"
                      >
                        해당 블로그 내용 보기
                      </a>
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-stone-600 leading-7 whitespace-pre-line">{item.summary}</p>
          </article>
        ))}
      </div>

      {activeItems.length === 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-100 text-sm text-stone-500">
          현재 표시할 결과가 없어요. 잠시 후 다시 시도해보시면 더 안정적으로 조회될 수 있습니다.
        </div>
      )}
    </section>
  );
}
