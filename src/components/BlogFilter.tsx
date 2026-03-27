'use client';

import { useState } from 'react';
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

// 카테고리별 SVG 썸네일 컴포넌트
function CategoryThumbnail({ category }: { category?: string }) {
  const configs: Record<string, { gradient: string; label: string; icon: React.ReactNode }> = {
    '인천 지역 정보': {
      gradient: 'from-sky-400 to-blue-600',
      label: '인천 지역 정보',
      icon: (
        // 건물/도시 아이콘
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
        </svg>
      ),
    },
    '전국 보조금·복지 정책': {
      gradient: 'from-amber-400 to-orange-500',
      label: '전국 보조금·복지',
      icon: (
        // 문서/지원 아이콘
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
    '전국 축제·여행': {
      gradient: 'from-rose-400 to-pink-600',
      label: '전국 축제·여행',
      icon: (
        // 깃발/축제 아이콘
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
      ),
    },
  };

  const cfg = category ? configs[category] : null;
  const gradient = cfg?.gradient ?? 'from-orange-400 to-orange-600';
  const label = cfg?.label ?? '픽앤조이';
  const icon = cfg?.icon ?? (
    // 별 아이콘 (기본값)
    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  );

  return (
    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}>
      {icon}
      <span className="text-white text-sm font-bold drop-shadow">{label}</span>
    </div>
  );
}

export default function BlogFilter({ posts }: { posts: PostData[] }) {
  const [active, setActive] = useState('');

  const filtered = active
    ? posts.filter((p) => p.category === active)
    : posts;

  return (
    <div>
      {/* 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActive(value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active === value
                ? 'bg-orange-500 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300'
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
              onClick={() => sessionStorage.setItem('blogScrollY', String(window.scrollY))}
            >
              <div className="bg-white rounded-xl border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col h-full">
                {/* 썸네일 영역 */}
                <div className="relative h-40 w-full flex-shrink-0">
                  {post.image && !post.image.endsWith('.svg') ? (
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <CategoryThumbnail category={post.category} />
                  )}
                </div>

                {/* 텍스트 영역 */}
                <div className="p-4 flex flex-col gap-1.5 flex-grow">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadge(post.category)}`}>
                      {getCategoryLabel(post.category)}
                    </span>
                    <span className="text-xs text-stone-400">{post.date}</span>
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
