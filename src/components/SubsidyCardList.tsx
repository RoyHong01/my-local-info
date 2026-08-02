'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import useClientPagination from '@/components/pagination/useClientPagination';

interface DataItem {
  [key: string]: unknown;
  expired?: boolean;
}

function getField(item: DataItem, keys: string[]): string {
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') return item[key] as string;
  }
  return '';
}

const cleanText = (text: string) =>
  text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

const PAGE_SIZE = 30;

export default function SubsidyCardList({ items }: { items: DataItem[] }) {
  const { visibleItems, visibleCount, hasMore, loadMore, ensureVisible } = useClientPagination({
    items,
    pageSize: PAGE_SIZE,
    scopeKey: 'subsidy-list',
  });

  useEffect(() => {
    const savedVisibleCount = Number(sessionStorage.getItem('subsidyVisibleCount') || 0);
    if (Number.isFinite(savedVisibleCount) && savedVisibleCount > 0) {
      ensureVisible(savedVisibleCount);
    }

    const savedY = sessionStorage.getItem('subsidyScrollY');
    if (savedY) {
      const y = Number(savedY);
      if (Number.isFinite(y) && y >= 0) {
        setTimeout(() => {
          window.scrollTo({ top: y, behavior: 'instant' });
        }, 80);
      }
    }

    sessionStorage.removeItem('subsidyScrollY');
    sessionStorage.removeItem('subsidyVisibleCount');
  }, [ensureVisible]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {visibleItems.map((item, i) => {
        const name = getField(item, ['서비스명', 'name', 'title']);
        const rawSummary = (
          cleanText(getField(item, ['서비스목적요약', 'summary', 'description'])) ||
          '상세 정보는 클릭하여 확인하세요.'
        ).slice(0, 120);
        const target = cleanText(getField(item, ['지원대상', 'target']));
        const org = cleanText(getField(item, ['소관기관명', 'location']));
        const startDate = getField(item, ['startDate']);
        const deadline = getField(item, ['신청기한', 'endDate']);
        const dateStr = startDate && deadline
          ? `${startDate} ~ ${deadline}`
          : deadline || startDate;
        const itemId = encodeURIComponent(getField(item, ['서비스ID', 'id']));
        return (
          <Link
            key={i}
            href={`/subsidy/${itemId}/`}
            onClick={() => {
              sessionStorage.setItem('subsidyScrollY', String(window.scrollY));
              sessionStorage.setItem('subsidyVisibleCount', String(visibleCount));
            }}
            data-testid={`subsidy-card-${itemId}`}
          >
            <div className="menu-card bg-white rounded-2xl p-5 shadow-sm border border-stone-100 border-t-2 border-t-amber-500 hover:shadow-md hover:border-amber-200 transition-all duration-300 flex flex-col h-full cursor-pointer">
              <h2 className="text-[1.05rem] font-bold tracking-tight leading-snug mb-2 line-clamp-2 text-stone-900">{name}</h2>
              {dateStr && (
                <p className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold px-2.5 py-1 mb-3">
                  <span className="menu-card-icon text-amber-500">📅</span> {dateStr}
                </p>
              )}
              <p className="text-[15px] leading-relaxed text-stone-700 line-clamp-3 mb-4 flex-grow">
                {rawSummary}
              </p>
              <div className="pt-3 border-t border-stone-100 space-y-1.5 text-[12px] text-stone-500">
                {target && (
                  <p className="flex items-start gap-1">
                    <span className="menu-card-icon flex-shrink-0 text-stone-400">🎯</span>
                    <span className="line-clamp-1 overflow-hidden">{target}</span>
                  </p>
                )}
                {org && (
                  <p className="flex items-start gap-1">
                    <span className="menu-card-icon flex-shrink-0 text-stone-400">🏛</span>
                    <span className="line-clamp-1 overflow-hidden">{org}</span>
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-stone-400">{visibleCount} / {items.length}편 표시 중</p>
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            data-testid="subsidy-load-more"
            className="px-4 py-2 rounded-full text-sm font-semibold bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition"
          >
            더보기 (+{Math.min(PAGE_SIZE, items.length - visibleCount)})
          </button>
        )}
      </div>
    </>
  );
}
