'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { PostData } from '@/lib/posts';

const CATEGORIES = [
  { label: '전체', value: '' },
  { label: '인천 지역 정보', value: '인천 지역 정보' },
  { label: '전국 보조금', value: '전국 보조금·복지 정책' },
  { label: '전국 축제·여행', value: '전국 축제·여행' },
];

const CATEGORY_BADGE: Record<string, string> = {
  '인천 지역 정보': 'bg-blue-50 text-blue-600',
  '전국 보조금·복지 정책': 'bg-amber-50 text-amber-700',
  '전국 축제·여행': 'bg-rose-50 text-rose-600',
};

function getCategoryBadge(category?: string) {
  if (!category) return 'bg-orange-50 text-orange-600';
  return CATEGORY_BADGE[category] ?? 'bg-orange-50 text-orange-600';
}

function getCategoryLabel(category?: string) {
  if (category === '전국 보조금·복지 정책') return '전국 보조금';
  return category ?? '기타';
}

function isChoicePost(post: PostData) {
  return post.category === '픽앤조이 초이스'
    || /픽앤조이 초이스|쿠팡|review|쇼핑|가전|디지털/i.test([
      post.title,
      post.category || '',
      ...(post.tags || []),
    ].join(' '));
}

function getCurationThumbnail(post: PostData): string {
  const tags = post.tags || [];
  if (tags.includes('보조금')) return '/images/subsidy-thumbnail.png';
  if (tags.includes('인천')) return '/images/incheon-thumbnail.jpg';
  return '';
}

function getCardThumbnail(post: PostData) {
  const primary = post.image && !post.image.endsWith('.svg') ? post.image : '';

  // 초이스는 대표 이미지(또는 쿠팡 배너 이미지) 우선 유지
  if (isChoicePost(post)) {
    return primary || post.coupangBannerImage || '';
  }

  // 큐레이션은 태그 기반 카테고리 이미지 사용
  if (post.category === '큐레이션') {
    return getCurationThumbnail(post);
  }

  // 인천/보조금은 카테고리 기본 썸네일만 사용
  if (post.category === '인천 지역 정보' || post.category === '전국 보조금·복지 정책') {
    return '';
  }

  // 축제는 히어로 이미지(포스트 image) 사용
  if (post.category === '전국 축제·여행') {
    return primary;
  }

  return primary;
}

function isTextHeavyThumbnail(src?: string) {
  return src === '/images/incheon-thumbnail.jpg' || src === '/images/subsidy-thumbnail.png';
}

// 카테고리별 썸네일 컴포넌트
const CATEGORY_THUMBNAIL_IMAGES: Record<string, string> = {
  '인천 지역 정보': '/images/incheon-thumbnail.jpg',
  '전국 보조금·복지 정책': '/images/subsidy-thumbnail.png',
};

function CategoryThumbnail({ category }: { category?: string }) {
  const imageUrl = category ? CATEGORY_THUMBNAIL_IMAGES[category] : null;
  if (imageUrl) {
    return (
      <div className="relative w-full h-full bg-white">
        <Image
          src={imageUrl}
          alt={category!}
          fill
          className={`${isTextHeavyThumbnail(imageUrl) ? 'object-contain p-1' : 'object-cover'}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    );
  }

  const configs: Record<string, { gradient: string; label: string }> = {
    '전국 보조금·복지 정책': {
      gradient: 'from-amber-400 to-orange-500',
      label: '전국 보조금·복지',
    },
    '전국 축제·여행': {
      gradient: 'from-rose-400 to-pink-600',
      label: '전국 축제·여행',
    },
    '큐레이션': {
      gradient: 'from-rose-400 to-pink-600',
      label: '픽앤조이 큐레이션',
    },
  };

  const cfg = category ? configs[category] : null;
  const gradient = cfg?.gradient ?? 'from-orange-400 to-orange-600';
  const label = cfg?.label ?? '픽앤조이';

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center gap-2`}>
      <span className="text-white text-xs font-bold drop-shadow">{label}</span>
    </div>
  );
}

const CATEGORY_PARAM_MAP: Record<string, string> = {
  '인천': '인천 지역 정보',
  '보조금': '전국 보조금·복지 정책',
  '축제': '전국 축제·여행',
};

const REVERSE_MAP: Record<string, string> = {
  '인천 지역 정보': '인천',
  '전국 보조금·복지 정책': '보조금',
  '전국 축제·여행': '축제',
};

export default function BlogFilter({ posts }: { posts: PostData[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeCategoryParam = searchParams.get('category') || '';
  const activeCategory = CATEGORY_PARAM_MAP[activeCategoryParam] || '';

  const handleCategoryClick = (value: string) => {
    if (value === '') {
      router.push('/blog');
    } else {
      router.push(`/blog?category=${REVERSE_MAP[value]}`);
    }
  };

  const handleCardClick = () => {
    sessionStorage.setItem('blogScrollY', String(window.scrollY));
    sessionStorage.setItem('blogCategory', activeCategoryParam);
  };

  const filtered = activeCategory
    ? posts.filter((p) => p.category === activeCategory)
    : posts;

  return (
    <div>
      {/* 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleCategoryClick(value)}
            data-testid={`blog-filter-${value || 'all'}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer transform-gpu will-change-transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-sm ${
              activeCategory === value || (value === '' && !activeCategory)
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300 hover:bg-orange-50/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          아직 작성된 글이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              onClick={handleCardClick}
              data-testid={`blog-card-${post.slug}`}
            >
              <div className="menu-card bg-white rounded-xl border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col h-full">
                {/* 썸네일 영역 */}
                <div className="relative h-24 w-full flex-shrink-0 bg-white">
                  {(() => {
                    const thumb = getCardThumbnail(post);
                    return thumb ? (
                    <Image
                      src={thumb}
                      alt={post.title}
                      fill
                      className={isTextHeavyThumbnail(thumb) ? 'object-contain p-1' : 'object-cover'}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    ) : (
                      <CategoryThumbnail category={post.category} />
                    );
                  })()}
                </div>

                {/* 텍스트 영역 */}
                <div className="p-4 flex flex-col gap-1.5 flex-grow">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadge(post.category)}`}>
                      {getCategoryLabel(post.category)}
                    </span>
                    <span className="menu-card-icon text-xs text-stone-400">{post.date}</span>
                  </div>
                  <h2
                    className="text-base font-bold text-stone-800 hover:text-orange-500 transition-colors leading-snug"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {post.title}
                  </h2>
                  <p
                    className="text-sm text-stone-500 leading-relaxed flex-grow"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {post.summary}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
