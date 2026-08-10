'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LifeRegionTab, RestaurantItem } from '@/lib/life-restaurants';
import useClientPagination from '@/components/pagination/useClientPagination';

type RegionDataset = Record<LifeRegionTab, RestaurantItem[]>;

const tabMeta: Array<{ key: LifeRegionTab; label: string; description: string }> = [
  { key: 'incheon', label: '인천', description: '송도·청라·부평 중심으로 골랐어요' },
  { key: 'seoul', label: '서울', description: '성수·연남·한남 중심으로 모았어요' },
  { key: 'gyeonggi', label: '경기', description: '판교·수원·하남 중심으로 모았어요' },
];

const PAGE_SIZE = 30;

export default function RestaurantExplorer({ datasets }: { datasets: RegionDataset }) {
  const [activeTab, setActiveTab] = useState<LifeRegionTab>('incheon');

  const activeItems = useMemo(() => datasets[activeTab] || [], [activeTab, datasets]);
  const { visibleItems, visibleCount, hasMore, loadMore, ensureVisible } = useClientPagination({
    items: activeItems,
    pageSize: PAGE_SIZE,
    scopeKey: activeTab,
  });

  useEffect(() => {
    const savedTab = sessionStorage.getItem('lifeRestaurantTab') as LifeRegionTab | null;
    if (savedTab && savedTab !== activeTab && ['incheon', 'seoul', 'gyeonggi'].includes(savedTab)) {
      setActiveTab(savedTab);
      return;
    }

    const savedVisibleCount = Number(sessionStorage.getItem('lifeRestaurantVisibleCount') || 0);
    if (Number.isFinite(savedVisibleCount) && savedVisibleCount > 0) {
      ensureVisible(savedVisibleCount);
    }

    const savedY = sessionStorage.getItem('lifeRestaurantScrollY');
    if (savedY) {
      const y = Number(savedY);
      if (Number.isFinite(y) && y >= 0) {
        const restoreScroll = () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo({ top: y, behavior: 'instant' });
            });
          });
        };

        setTimeout(restoreScroll, 160);
        setTimeout(restoreScroll, 420);
      }
    }

    sessionStorage.removeItem('lifeRestaurantTab');
    sessionStorage.removeItem('lifeRestaurantVisibleCount');
    sessionStorage.removeItem('lifeRestaurantScrollY');
  }, [activeTab, ensureVisible]);

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
        {visibleItems.map((item) => (
          <article
            key={item.id}
            data-testid={`life-restaurant-card-${item.id}`}
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
                    카카오맵 바로 보기
                  </a>
                  {item.blogHref && (
                    <>
                      <span className="text-stone-300">|</span>
                      <a
                        href={item.blogHref}
                        onClick={() => {
                          sessionStorage.setItem('lifeRestaurantTab', activeTab);
                          sessionStorage.setItem('lifeRestaurantVisibleCount', String(visibleCount));
                          sessionStorage.setItem('lifeRestaurantScrollY', String(window.scrollY));
                        }}
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

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-stone-400">{visibleCount} / {activeItems.length}편 표시 중</p>
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            data-testid="life-restaurant-load-more"
            className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition"
          >
            더보기 (+{Math.min(PAGE_SIZE, activeItems.length - visibleCount)})
          </button>
        )}
      </div>

      {activeItems.length === 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-100 text-sm text-stone-500">
          현재 표시할 결과가 없어요. 잠시 후 다시 시도해보시면 더 안정적으로 조회될 수 있습니다.
        </div>
      )}
    </section>
  );
}
