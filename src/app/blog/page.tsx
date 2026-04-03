import { Suspense } from 'react';
import Link from 'next/link';
import { getSortedPostsData } from '@/lib/posts';
import BlogFilter from '@/components/BlogFilter';
import BlogScrollRestorer from '@/components/BlogScrollRestorer';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '블로그 | 픽앤조이',
  description: '인천 및 전국의 행사, 축제, 보조금, 여행 정보를 쉽고 친근하게 전해드리는 블로그입니다.',
  alternates: { canonical: '/blog/' },
  openGraph: {
    title: '블로그 | 픽앤조이',
    description: '인천 및 전국의 행사, 축제, 보조금, 여행 정보를 쉽고 친근하게 전해드리는 블로그입니다.',
    url: 'https://pick-n-joy.com/blog/',
  },
};

export default function BlogPage() {
  const allPosts = getSortedPostsData();
  const posts = allPosts.filter((p) => {
    const source = [p.title, p.category || '', ...(p.tags || [])].join(' ');
    const isChoice = p.category === '픽앤조이 초이스';
    const isRestaurant = p.category === '픽앤조이 맛집 탐방' || /맛집|restaurant/i.test(source);
    return !isChoice && !isRestaurant;
  });

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start">
          <div className="flex-1 min-w-0">
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1">
                <span className="text-3xl">📝</span> 픽앤조이 블로그
              </h1>
              <p className="text-stone-500 text-sm">인천 및 전국의 생활정보를 쉽고 친근하게 전해드립니다</p>
              <p className="text-xs text-stone-400 mt-1">총 {posts.length}편</p>
            </div>

            <Suspense fallback={null}>
              <BlogScrollRestorer />
              <BlogFilter posts={posts} />
            </Suspense>
          </div>
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24 self-start sticky-sidebar">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-blog-list" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
