import { getPostData, getSortedPostsData } from '@/lib/posts';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import fs from 'fs/promises';
import path from 'path';
import AdBanner from '@/components/AdBanner';
import CoupangBanner from '@/components/CoupangBanner';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await params;
  const post = getPostData(p.slug);
  if (!post) {
    return { title: 'Not Found' };
  }
  const description = post.description || post.summary || post.content.substring(0, 160).replace(/\n/g, ' ');
  return {
    title: `${post.title} | 픽앤조이`,
    description,
    alternates: {
      canonical: `/blog/${p.slug}/`,
    },
    openGraph: {
      title: `${post.title} | 픽앤조이`,
      description,
      url: `https://pick-n-joy.com/blog/${p.slug}/`,
      type: 'article',
      publishedTime: post.date,
      siteName: '픽앤조이',
      ...(post.image ? { images: [{ url: post.image, width: 1200, height: 630, alt: post.title }] } : {}),
    },
  };
}

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

  const filePath = path.join(process.cwd(), 'public/data/local-info.json');
  let sourceLink = '#';
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    const items = JSON.parse(fileContents);
    const sourceItem = items.find((item: any) => item.name === post.title);
    if (sourceItem && sourceItem.link) {
      sourceLink = sourceItem.link;
    }
  } catch (e) {
    // ignore
  }

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    description: post.description || post.summary || post.content.substring(0, 160).replace(/\n/g, ' '),
    author: {
      "@type": "Organization",
      name: "픽앤조이",
    },
    publisher: {
      "@type": "Organization",
      name: "픽앤조이",
      url: "https://pick-n-joy.com",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://pick-n-joy.com/blog/${p.slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
              <li><Link href="/#incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
              <li><Link href="/#subsidy" className="hover:text-amber-600 transition">전국 보조금·복지 정책</Link></li>
              <li><Link href="/#festival" className="hover:text-rose-600 transition">전국 축제·여행 정보</Link></li>
              <li><Link href="/blog" className="text-orange-500 font-bold">블로그</Link></li>
              <li><Link href="/about" className="hover:text-orange-500 transition">소개</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <Link href="/blog" className="text-orange-600 hover:underline mb-8 inline-block">&larr; 목록으로 돌아가기</Link>
        <article className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
          <header className="mb-8 border-b border-stone-100 pb-8">
            <h1 className="text-4xl font-extrabold mb-4">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-stone-500">작성일: {post.date}</span>
              <span className="text-stone-300">|</span>
              <span className="text-stone-500 font-medium">최종 업데이트: {post.date}</span>
            </div>
          </header>
          {post.image && !post.image.endsWith('.svg') && (
            <div className="relative w-full h-72 md:h-96 rounded-2xl overflow-hidden mb-10">
              <Image
                src={post.image}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 1200px"
                priority
              />
            </div>
          )}
          <div className="prose prose-stone prose-orange lg:prose-lg max-w-none mb-12 prose-p:leading-8 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:font-extrabold prose-h2:font-bold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
          <AdBanner />
          <CoupangBanner />
          <footer className="mt-12 pt-8 border-t border-stone-100 text-sm text-stone-500 space-y-4 bg-stone-50 p-6 rounded-2xl">
            <p>
              이 글은 공공데이터포털(<a href="https://data.go.kr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">data.go.kr</a>)의 정보를 바탕으로 AI가 작성하였습니다. 정확한 내용은 원문 링크를 통해 확인해주세요.
            </p>
            {sourceLink !== '#' && (
              <p>
                <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700 transition-colors bg-white px-4 py-2 rounded-lg border border-stone-200 hover:border-orange-300 shadow-sm">
                  <span>공식 원문 바로가기</span>
                  <span>&rarr;</span>
                </a>
              </p>
            )}
          </footer>
        </article>
      </main>
    </div>
  );
}
