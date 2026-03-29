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
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
              <li><Link href="/incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
              <li><Link href="/subsidy" className="hover:text-amber-600 transition">전국 보조금·복지 정책</Link></li>
              <li><Link href="/festival" className="hover:text-rose-600 transition">전국 축제·여행 정보</Link></li>
              <li><Link href="/blog" className="text-orange-500 font-bold">블로그</Link></li>
              <li><Link href="/about" className="hover:text-orange-500 transition">소개</Link></li>
            </ul>
          </nav>
        </div>
      </header>

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
          <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24">
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
