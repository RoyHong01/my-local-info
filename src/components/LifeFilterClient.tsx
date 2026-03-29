'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

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
  { label: '맛집 탐방', value: 'restaurant' },
  { label: '픽앤조이 초이스', value: 'choice' },
] as const;

function RestaurantThumbnail({ meta }: { meta?: string }) {
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

function buildLifeReturnHref(activeTab: string) {
  return activeTab ? `/life?tab=${activeTab}` : '/life';
}

function LifeCard({ item, activeTab }: { item: LifePageItem; activeTab: string }) {
  const handleInternalCardClick = () => {
    sessionStorage.setItem('lifeScrollY', String(window.scrollY));
    sessionStorage.setItem('lifeTab', activeTab);
  };

  const returnHref = buildLifeReturnHref(activeTab);
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
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return (
    <Link href={internalHref} className="block" onClick={handleInternalCardClick}>
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
        : [...restaurants, ...choices];

  return (
    <div>
      {/* 탭 필터 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleTabClick(value)}
            data-testid={`life-filter-${value || 'all'}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <LifeCard key={`${item.type}-${item.id}`} item={item} activeTab={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}
