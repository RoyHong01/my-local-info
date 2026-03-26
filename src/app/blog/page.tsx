import Link from 'next/link';
import { getSortedPostsData } from '@/lib/posts';
import BlogFilter from '@/components/BlogFilter';

export default function BlogPage() {
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-3 md:space-x-5 text-sm font-medium text-stone-600">
              <li><Link href="/incheon" className="hover:text-blue-600 transition">인천정보</Link></li>
              <li><Link href="/subsidy" className="hover:text-amber-600 transition">보조금</Link></li>
              <li><Link href="/festival" className="hover:text-rose-600 transition">축제·여행</Link></li>
              <li><Link href="/blog" className="text-orange-500 font-bold">블로그</Link></li>
              <li><Link href="/about" className="hover:text-orange-500 transition">소개</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1">
            <span className="text-3xl">📝</span> 픽앤조이 블로그
          </h1>
          <p className="text-stone-500 text-sm">인천 및 전국의 생활정보를 쉽고 친근하게 전해드립니다</p>
          <p className="text-xs text-stone-400 mt-1">총 {posts.length}편</p>
        </div>

        <BlogFilter posts={posts} />
      </main>

      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-1">픽앤조이</p>
            <p className="text-stone-500">pick-n-joy.com</p>
          </div>
          <div className="text-center md:text-right text-stone-500">
            <p>데이터 출처: 공공데이터포털 · 한국관광공사</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
