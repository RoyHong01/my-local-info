'use client';
import Link from 'next/link';
import { usePagedList } from '@/components/pagination/useClientPagination';

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

const fmtDate = (d: string) => d.length === 8
  ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  : d;

const PAGE_SIZE = 30;

export default function FestivalCardList({ items }: { items: DataItem[] }) {
  const {
    pageItems,
    currentPage,
    totalPages,
    totalCount,
    pageNumbers,
    hasPrev,
    hasNext,
    goTo,
  } = usePagedList(items, PAGE_SIZE);

  const BLOCK_SIZE = 10;
  const blockStart = Math.floor((currentPage - 1) / BLOCK_SIZE) * BLOCK_SIZE + 1;
  const blockEnd = Math.min(blockStart + BLOCK_SIZE - 1, totalPages);
  const hasPrevBlock = blockStart > 1;
  const hasNextBlock = blockEnd < totalPages;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {pageItems.map((item, i) => {
        const name = getField(item, ['title', 'name', '서비스명']);
        const rawSummary = cleanText(getField(item, ['summary', 'overview', 'description', '서비스목적요약']));
        const summary = rawSummary || '상세 정보는 해당 축제를 통해 확인하세요.';
        const location = getField(item, ['addr1', 'location', '소관기관명']);
        const rawStart = getField(item, ['eventstartdate', 'startDate']);
        const rawEnd = getField(item, ['eventenddate', 'endDate']);
        const dateStr = rawStart
          ? rawEnd ? `${fmtDate(rawStart)} ~ ${fmtDate(rawEnd)}` : fmtDate(rawStart)
          : '';
        const itemId = encodeURIComponent(getField(item, ['contentid', 'id']));
        return (
          <Link
            key={i}
            href={`/festival/${itemId}`}
            data-testid={`festival-card-${itemId}`}
          >
            <div className="menu-card bg-white rounded-2xl p-5 shadow-sm border border-stone-100 border-t-2 border-t-rose-500 hover:shadow-md hover:border-rose-200 transition-all duration-300 flex flex-col h-full cursor-pointer">
              <h2 className="text-[1.05rem] font-bold tracking-tight leading-snug mb-2 line-clamp-2 text-stone-900">{name}</h2>
              {dateStr && (
                <p className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold px-2.5 py-1 mb-3">
                  <span className="menu-card-icon text-rose-500">📅</span> {dateStr}
                </p>
              )}
              <p className="text-[15px] leading-relaxed text-stone-700 line-clamp-3 mb-4 flex-grow">{summary}</p>
              {location && (
                <p className="mt-auto pt-3 border-t border-stone-100 text-[12px] text-stone-500 flex items-center gap-1 truncate">
                  <span className="menu-card-icon text-stone-400">📍</span> {location}
                </p>
              )}
            </div>
          </Link>
        );
      })}
      </div>

      <div className="mt-6">
        <p className="text-xs text-stone-400">{totalCount}편 중 {currentPage} / {totalPages} 페이지</p>
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-1 mt-8" aria-label="페이지 이동">
            <button type="button" onClick={() => goTo(blockStart - 1)} disabled={!hasPrevBlock} aria-label="이전 10페이지" className="px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer">≪</button>
            <button type="button" onClick={() => goTo(currentPage - 1)} disabled={!hasPrev} aria-label="이전 페이지" className="px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer">←</button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goTo(p)}
                aria-current={p === currentPage ? 'page' : undefined}
                className={p === currentPage
                  ? 'px-3 py-2 rounded-lg text-sm font-bold bg-orange-500 text-white cursor-pointer'
                  : 'px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 cursor-pointer'}
              >
                {p}
              </button>
            ))}
            <button type="button" onClick={() => goTo(currentPage + 1)} disabled={!hasNext} aria-label="다음 페이지" className="px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer">→</button>
            <button type="button" onClick={() => goTo(blockEnd + 1)} disabled={!hasNextBlock} aria-label="다음 10페이지" className="px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer">≫</button>
          </nav>
        )}
      </div>
    </>
  );
}
