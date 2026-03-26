'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PostData } from '@/lib/posts';

const CATEGORIES = [
  { label: '전체', value: '' },
  { label: '인천 지역 정보', value: '인천 지역 정보' },
  { label: '전국 보조금', value: '전국 보조금·복지 정책' },
  { label: '전국 축제·여행', value: '전국 축제·여행' },
];

const CATEGORY_STYLE: Record<string, string> = {
  '인천 지역 정보': 'bg-blue-50 text-blue-600 border border-blue-100',
  '전국 보조금·복지 정책': 'bg-amber-50 text-amber-600 border border-amber-100',
  '전국 축제·여행': 'bg-rose-50 text-rose-600 border border-rose-100',
};

function getCategoryStyle(category?: string) {
  if (!category) return 'bg-orange-50 text-orange-600 border border-orange-100';
  return CATEGORY_STYLE[category] ?? 'bg-orange-50 text-orange-600 border border-orange-100';
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
              <div className="bg-white rounded-xl p-4 border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col gap-2 h-full">
                <div className="flex items-center justify-between">
                  {post.category ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getCategoryStyle(post.category)}`}>
                      {post.category === '전국 보조금·복지 정책' ? '전국 보조금' : post.category}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                      기타
                    </span>
                  )}
                  <span className="text-xs text-stone-400">{post.date}</span>
                </div>
                <h2
                  className="text-sm font-bold text-stone-800 hover:text-orange-500 transition-colors leading-snug"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {post.title}
                </h2>
                <p
                  className="text-xs text-stone-600 leading-relaxed flex-grow"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {post.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
