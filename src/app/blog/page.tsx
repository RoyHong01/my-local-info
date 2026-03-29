import { Suspense } from 'react';
import Link from 'next/link';
import { getSortedPostsData } from '@/lib/posts';
import BlogFilter from '@/components/BlogFilter';
import BlogScrollRestorer from '@/components/BlogScrollRestorer';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import SiteHeader from '@/components/SiteHeader';
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
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <SiteHeader />

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
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-blog-list" />
            </div>
          </aside>
        </div>
      </main>

      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-1">픽앤조이</p>
            <p className="text-stone-500">pick-n-joy.com</p>
          </div>
          <div className="text-center md:text-right text-stone-500">
            <p>데이터 출처: 공공데이터포털 · 한국관광공사</p>
            <p className="text-xs text-stone-600 mt-1 text-center md:text-right">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
