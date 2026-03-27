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

const CATEGORY_GRADIENT: Record<string, string> = {
  '인천 지역 정보': 'from-blue-400 to-blue-600',
  '전국 보조금·복지 정책': 'from-amber-400 to-orange-500',
  '전국 축제·여행': 'from-rose-400 to-pink-600',
};

function getCategoryGradient(category?: string) {
  if (!category) return 'from-orange-400 to-orange-600';
  return CATEGORY_GRADIENT[category] ?? 'from-orange-400 to-orange-600';
}

function getCategoryLabel(category?: string) {
  if (category === '전국 보조금·복지 정책') return '전국 보조금';
  return category ?? '기타';
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
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <div className="bg-white rounded-xl border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col h-full">
                {/* 썸네일 영역 */}
                <div className="relative h-36 w-full flex-shrink-0">
                  {post.image && !post.image.endsWith('.svg') ? (
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getCategoryGradient(post.category)} flex items-center justify-center`}>
                      <span className="text-white text-sm font-bold drop-shadow">
                        {getCategoryLabel(post.category)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 텍스트 영역 */}
                <div className="p-4 flex flex-col gap-2 flex-grow">
                  <span className="text-xs text-stone-500">{post.date}</span>
                  <h2
                    className="text-base font-bold text-stone-800 hover:text-orange-500 transition-colors leading-snug"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {post.title}
                  </h2>
                  <p
                    className="text-sm text-stone-600 leading-relaxed flex-grow"
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
