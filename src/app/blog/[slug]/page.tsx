import { getPostData, getSortedPostsData } from '@/lib/posts';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const posts = getSortedPostsData();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await params;
  const post = getPostData(p.slug);

  if (!post) {
    notFound();
  }

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
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/blog" className="text-orange-600 hover:underline mb-8 inline-block">&larr; 목록으로 돌아가기</Link>
        <article className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <header className="mb-8 border-b border-stone-100 pb-8">
            <h1 className="text-4xl font-extrabold mb-4">{post.title}</h1>
            <div className="text-stone-500">{post.date}</div>
          </header>
          <div className="prose prose-stone prose-orange max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
        </article>
      </main>
    </div>
  );
}
