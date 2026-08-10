'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { usePagedList } from '@/components/pagination/useClientPagination';

export interface LifePageItem {
  type: 'restaurant' | 'choice';
  id: string;
  title: string;
  description: string;
  date?: string;
  image?: string;
  href: string;
  external?: boolean;
  badge: string;
  badgeClass: string;
  meta?: string; // "인천/경인" | "서울/경기" for restaurants
}

const TABS = [
  { label: '전체', value: '' },
  { label: '서울·인천·경기 맛집 탐방', value: 'restaurant' },
  { label: '픽앤조이 초이스', value: 'choice' },
] as const;

const PAGE_SIZE = 30;

const RESTAURANT_THUMBNAIL_IMAGES: Record<string, string> = {
  '인천 맛집': '/images/restaurant-incheon-thumbnail.png',
  '서울 맛집': '/images/restaurant-seoul-thumbnail.png',
  '경기 맛집': '/images/restaurant-gyeonggi-thumbnail.png',
};

function RestaurantThumbnail({ meta }: { meta?: string }) {
  const imageUrl = meta ? RESTAURANT_THUMBNAIL_IMAGES[meta] : null;
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={meta!}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  }

  const isSeoul = meta === '서울 맛집';
  const isIncheon = meta === '인천 맛집';
  const label = isSeoul ? '서울 맛집' : isIncheon ? '인천 맛집' : '경기 맛집';
  const gradient = isSeoul
    ? 'from-emerald-400 to-teal-600'
    : isIncheon
      ? 'from-amber-400 to-orange-500'
      : 'from-sky-400 to-blue-600';
  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-12 h-12 text-white/80"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
      <span className="text-white text-sm font-bold drop-shadow">{label}</span>
    </div>
  );
}

function ChoiceThumbnail() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex flex-col items-center justify-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-12 h-12 text-white/80"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </svg>
      <span className="text-white text-sm font-bold drop-shadow">픽앤조이 초이스</span>
    </div>
  );
}

function buildLifeReturnHref(activeTab: string, currentPage: number) {
  const params = new URLSearchParams();
  if (activeTab) params.set('tab', activeTab);
  if (currentPage > 1) params.set('page', String(currentPage));
  const query = params.toString();
  return query ? `/life?${query}` : '/life';
}

function LifeCard({ item, activeTab, currentPage }: { item: LifePageItem; activeTab: string; currentPage: number }) {
  const handleInternalCardClick = () => {
    sessionStorage.setItem('lifeTab', activeTab);
  };

  const returnHref = buildLifeReturnHref(activeTab, currentPage);
  const internalHref = !item.external && item.href.startsWith('/blog/')
    ? `${item.href}?from=life&returnTo=${encodeURIComponent(returnHref)}`
    : item.href;

  const inner = (
    <div className="menu-card bg-white rounded-xl border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col h-full">
      {/* 썸네일 */}
      <div className="relative h-20 w-full flex-shrink-0">
        {item.image && !item.image.endsWith('.svg') ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : item.type === 'restaurant' ? (
          <RestaurantThumbnail meta={item.meta} />
        ) : (
          <ChoiceThumbnail />
        )}
      </div>

      {/* 텍스트 */}
      <div className="p-4 flex flex-col gap-1.5 flex-grow">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.badgeClass}`}>
            {item.badge}
          </span>
          {item.meta ? (
            <span className="menu-card-icon text-xs text-stone-400">{item.meta}</span>
          ) : item.date ? (
            <span className="menu-card-icon text-xs text-stone-400">{item.date}</span>
          ) : null}
        </div>

        <h2
          className="text-base font-bold text-stone-800 hover:text-orange-500 transition-colors leading-snug"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {item.title}
        </h2>

        {/* 문제 해결형 서사 — description(첫 문장) 노출 */}
        <p
          className="text-sm text-stone-500 leading-relaxed flex-grow"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {item.description}
        </p>

        {item.external && (
          <p className="text-xs text-orange-500 font-medium mt-1">카카오맵에서 보기 →</p>
        )}
      </div>
    </div>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block" data-testid={`life-card-${item.type}-${item.id}`}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={internalHref} className="block" onClick={handleInternalCardClick} data-testid={`life-card-${item.type}-${item.id}`}>
      {inner}
    </Link>
  );
}

export default function LifeFilterClient({
  restaurants,
  choices,
}: {
  restaurants: LifePageItem[];
  choices: LifePageItem[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = searchParams.get('tab') ?? '';

  const handleTabClick = (value: string) => {
    if (value === '') {
      router.push('/life');
    } else {
      router.push(`/life?tab=${value}`);
    }
  };

  const items =
    activeTab === 'restaurant'
      ? restaurants
      : activeTab === 'choice'
        ? choices
        : [...restaurants, ...choices].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
          });

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
    <div>
      {/* 탭 필터 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleTabClick(value)}
            data-testid={`life-filter-${value || 'all'}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 hover:-translate-y-1 ${
              activeTab === value || (value === '' && !activeTab)
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">아직 콘텐츠가 없습니다.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((item) => (
            <LifeCard key={`${item.type}-${item.id}`} item={item} activeTab={activeTab} currentPage={currentPage} />
          ))}
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
      )}
    </div>
  );
}
