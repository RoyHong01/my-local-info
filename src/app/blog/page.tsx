import Link from 'next/link';
import { getSortedPostsData } from '@/lib/posts';

export default function BlogPage() {
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen bg-orange-50/50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-600">성남시 생활 정보</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-sm font-medium text-stone-600">
              <li><Link href="/#events" className="hover:text-orange-600 transition">행사/축제</Link></li>
              <li><Link href="/#benefits" className="hover:text-orange-600 transition">지원금/혜택</Link></li>
              <li><Link href="/blog" className="hover:text-orange-600 transition">블로그</Link></li>
              <li><Link href="/about" className="hover:text-orange-600 transition">소개</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-extrabold mb-8">블로그</h1>
        <div className="space-y-6">
          {posts.map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.slug} className="block group">
              <article className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md hover:border-orange-200 transition-all">
                <h2 className="text-2xl font-bold mb-2 group-hover:text-orange-600 transition-colors">{post.title}</h2>
                <div className="text-sm text-stone-400 mb-4">{post.date}</div>
                <p className="text-stone-600 line-clamp-3">{post.summary}</p>
              </article>
            </Link>
          ))}
          {posts.length === 0 && (
            <div className="text-center py-12 text-stone-500">
              작성된 블로그 글이 없습니다.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
