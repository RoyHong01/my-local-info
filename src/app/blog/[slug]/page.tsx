import { getPostData, getSortedPostsData } from '@/lib/posts';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import fs from 'fs/promises';
import path from 'path';
import AdBanner from '@/components/AdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import CoupangBottomBanner from '@/components/CoupangBottomBanner';
import BlogBackButton from '@/components/BlogBackButton';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import ProductSidebarBanner from '@/components/ProductSidebarBanner';

function extractFirstSentenceFromMarkdown(markdown: string): string {
  const plain = (markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return '';

  const sentenceMatch = plain.match(/.+?[.!?。！？…](?=\s|$)/);
  return sentenceMatch ? sentenceMatch[0].trim() : plain;
}

function buildMetaDescription(content: string): string {
  const firstSentence = extractFirstSentenceFromMarkdown(content);
  if (!firstSentence) return '';
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157).trimEnd()}...` : firstSentence;
}

function extractRestaurantDetails(post: ReturnType<typeof getPostData>) {
  if (!post) return null;

  const content = post.content || '';
  const linkedNameMatch = content.match(/-\s+\*\*상호명\*\*:\s+\[([^\]]+)\]\(([^)]+)\)/);
  const addressMatch = content.match(/-\s+\*\*주소\*\*:\s+(.+)/);
  const phoneMatch = content.match(/-\s+\*\*전화번호\*\*:\s+(.+)/);
  const parkingMatch = content.match(/-\s+\*\*주차\*\*:\s+(.+)/);

  const name = post.placeName || linkedNameMatch?.[1]?.trim() || post.title;
  const url = post.placeUrl || linkedNameMatch?.[2]?.trim() || `https://pick-n-joy.com/blog/${post.slug}/`;
  const streetAddress = post.placeAddress || addressMatch?.[1]?.trim() || '';
  const telephone = post.placePhone || phoneMatch?.[1]?.trim() || '';
  const parkingInfo = post.parkingInfo || parkingMatch?.[1]?.trim() || '';
  const addressLocality = post.placeLocality
    || (streetAddress.startsWith('인천') ? '인천' : streetAddress.startsWith('서울') ? '서울' : streetAddress.startsWith('경기') ? '경기' : '');
  const addressRegion = post.placeRegion || 'KR';

  return {
    name,
    url,
    streetAddress,
    telephone,
    parkingInfo,
    addressLocality,
    addressRegion,
    ratingValue: post.ratingValue || '',
    reviewCount: post.reviewCount || '',
    priceRange: post.priceRange || '',
    openingHours: post.openingHours || '',
  };
}

function buildRestaurantJsonLd(post: NonNullable<ReturnType<typeof getPostData>>) {
  const details = extractRestaurantDetails(post);
  if (!details) return null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: details.name,
    url: `https://pick-n-joy.com/blog/${post.slug}/`,
    telephone: details.telephone || undefined,
    servesCuisine: 'Korean',
    address: {
      '@type': 'PostalAddress',
      streetAddress: details.streetAddress || undefined,
      addressLocality: details.addressLocality || undefined,
      addressRegion: details.addressRegion,
      addressCountry: 'KR',
    },
    image: post.image ? [post.image] : undefined,
    priceRange: details.priceRange || undefined,
    openingHours: details.openingHours || undefined,
    sameAs: details.url !== `https://pick-n-joy.com/blog/${post.slug}/` ? [details.url] : undefined,
  };

  if (details.ratingValue && details.reviewCount) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: details.ratingValue,
      reviewCount: details.reviewCount,
    };
  }

  return jsonLd;
}

function buildProductJsonLd(post: NonNullable<ReturnType<typeof getPostData>>) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: post.title,
    description: post.description || post.summary,
    image: post.image ? [post.image] : post.coupangBannerImage ? [post.coupangBannerImage] : undefined,
    category: post.category || '픽앤조이 초이스',
    brand: {
      '@type': 'Brand',
      name: '픽앤조이',
    },
    url: `https://pick-n-joy.com/blog/${post.slug}/`,
  };

  if (post.ratingValue && post.reviewCount) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: post.ratingValue,
      reviewCount: post.reviewCount,
    };
  }

  if (post.coupangLink) {
    jsonLd.offers = {
      '@type': 'Offer',
      url: post.coupangLink,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
    };
  }

  return jsonLd;
}

function classifyPostForSeo(post: { title: string; category?: string; tags?: string[] }) {
  const source = [post.title, post.category || '', ...(post.tags || [])].join(' ');

  if (/픽앤조이 초이스|쿠팡|review|쇼핑|가전|디지털/i.test(source)) {
    return {
      articleSection: '상품 리뷰',
      about: [
        { '@type': 'Thing', name: '상품 리뷰' },
        { '@type': 'Thing', name: '쇼핑 정보' },
      ],
      additionalType: 'https://schema.org/Product',
    };
  }

  if (/맛집|restaurant|food|카페|먹거리/i.test(source)) {
    return {
      articleSection: '맛집 리뷰',
      about: [
        { '@type': 'Thing', name: '맛집 리뷰' },
        { '@type': 'Thing', name: '식음료 정보' },
      ],
      additionalType: 'https://schema.org/Review',
    };
  }

  if (/축제|여행|festival|trip/i.test(source)) {
    return {
      articleSection: '축제 정보',
      about: [
        { '@type': 'Thing', name: '축제 정보' },
        { '@type': 'Thing', name: '여행 정보' },
      ],
      additionalType: 'https://schema.org/Event',
    };
  }

  return {
    articleSection: post.category || '생활정보',
    about: [{ '@type': 'Thing', name: post.category || '생활정보' }],
    additionalType: 'https://schema.org/Article',
  };
}

async function resolveSourceLink(post: { sourceId?: string; category?: string }): Promise<string | null> {
  if (!post.sourceId) return null;
  const cat = post.category || '';
  type FileConfig = { file: string; idFields: string[]; linkFields: string[] };
  let configs: FileConfig[];
  if (/축제|여행/.test(cat)) {
    configs = [
      { file: 'festival.json', idFields: ['contentid', 'id'], linkFields: ['homepage', 'link', '상세조회URL'] },
      { file: 'incheon.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
      { file: 'subsidy.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
    ];
  } else if (/인천/.test(cat)) {
    configs = [
      { file: 'incheon.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link', 'homepage'] },
      { file: 'festival.json', idFields: ['contentid', 'id'], linkFields: ['homepage', 'link'] },
      { file: 'subsidy.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
    ];
  } else if (/보조금|복지/.test(cat)) {
    configs = [
      { file: 'subsidy.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link', 'homepage'] },
      { file: 'incheon.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
      { file: 'festival.json', idFields: ['contentid', 'id'], linkFields: ['homepage', 'link'] },
    ];
  } else {
    configs = [
      { file: 'festival.json', idFields: ['contentid', 'id'], linkFields: ['homepage', 'link', '상세조회URL'] },
      { file: 'incheon.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
      { file: 'subsidy.json', idFields: ['서비스ID', 'id'], linkFields: ['상세조회URL', 'link'] },
    ];
  }
  for (const config of configs) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), `public/data/${config.file}`), 'utf8');
      const items: Record<string, string>[] = JSON.parse(raw);
      const item = items.find((row) => config.idFields.some((f) => String(row[f]) === String(post.sourceId)));
      if (item) {
        for (const lf of config.linkFields) {
          if (item[lf]?.trim() && item[lf] !== '#') return item[lf];
        }
      }
    } catch {
      // ignore missing file
    }
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await params;
  const post = getPostData(p.slug);
  if (!post) {
    return { title: 'Not Found' };
  }
  const description = buildMetaDescription(post.content) || post.description || post.summary || post.content.substring(0, 160).replace(/\n/g, ' ');
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

  const sourceLink = await resolveSourceLink(post);

  const description = buildMetaDescription(post.content) || post.description || post.summary || post.content.substring(0, 160).replace(/\n/g, ' ');
  const seoClassification = classifyPostForSeo(post);

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    description,
    articleSection: seoClassification.articleSection,
    about: seoClassification.about,
    additionalType: seoClassification.additionalType,
    keywords: (post.tags && post.tags.length > 0) ? post.tags.join(', ') : undefined,
    inLanguage: 'ko-KR',
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
      "@id": `https://pick-n-joy.com/blog/${p.slug}/`,
    },
  };

  const isRestaurantPost = post.category === '픽앤조이 맛집 탐방' || /맛집|restaurant|food|먹거리/i.test([post.title, post.category || '', ...(post.tags || [])].join(' '));
  const isChoicePost = post.category === '픽앤조이 초이스' || /픽앤조이 초이스|쿠팡|review|쇼핑|가전|디지털/i.test([post.title, post.category || '', ...(post.tags || [])].join(' '));
  const hasChoiceSidebarBanner = isChoicePost && !!post.coupangLink && !!post.coupangBannerImage;
  const restaurantJsonLd = isRestaurantPost ? buildRestaurantJsonLd(post) : null;
  const productJsonLd = isChoicePost ? buildProductJsonLd(post) : null;

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      {restaurantJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />
      )}
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12 items-start">
          <div className="flex-1 min-w-0">
        <Suspense fallback={<span className="text-orange-600 mb-8 inline-block">&larr; 목록으로 돌아가기</span>}>
          <BlogBackButton fallbackHref="/blog" />
        </Suspense>
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
            isChoicePost ? (
              <div className="mb-14 flex justify-center">
                <div className="relative w-full max-w-[480px] aspect-[4/5] overflow-hidden rounded-xl border border-stone-100 shadow-sm bg-white">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 75vw, 480px"
                    priority
                  />
                </div>
              </div>
            ) : (
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
            )
          )}
          <div className="blog-prose prose prose-stone prose-orange max-w-none mb-12 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:font-extrabold prose-h2:font-bold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
          <AdBanner />
          <div className="mt-8 pt-6 border-t border-stone-100 text-sm text-stone-500 space-y-4">
            <p className={isChoicePost ? 'text-base font-normal text-stone-700 leading-7' : 'text-sm text-stone-500 leading-6'}>
              {isRestaurantPost ? (
                <>이 글은 카카오 API 정보를 바탕으로 AI가 작성하였습니다. 정확한 음식점 정보는 카카오맵을 통해 확인해주세요.</>
              ) : isChoicePost ? (
                <>
                  <span className="block">본 콘텐츠는 AI 기술을 활용하여 제품 사양 및 실제 사용자 리뷰 데이터를 정밀 분석하고, 픽앤조이(Pick-n-Joy) 에디터의 엄격한 큐레이션을 거쳐 제작되었습니다.</span>
                  <span className="block">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. 단, 구매 가격에는 영향을 미치지 않으며 에디터의 주관적인 의견이 반영된 정보임을 밝힙니다.</span>
                </>
              ) : (
                <>
                  이 글은 공공데이터포털(<a href="https://data.go.kr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">data.go.kr</a>)의 정보를 바탕으로 AI가 작성하였습니다.{' '}
                  {sourceLink
                    ? '정확한 내용은 원문 링크를 통해 확인해주세요.'
                    : '최신 정보와 세부 조건은 공공데이터포털 또는 해당 기관 공지를 통해 확인해주세요.'}
                </>
              )}
            </p>
            {sourceLink && !isChoicePost && (
              <p>
                <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700 transition-colors bg-white px-4 py-2 rounded-lg border border-stone-200 hover:border-orange-300 shadow-sm">
                  <span>공식 원문 바로가기</span>
                  <span>&rarr;</span>
                </a>
              </p>
            )}
          </div>

          <div className="mt-8">
            <CoupangBottomBanner bannerId="coupang-bottom-blog" />
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">
            이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </article>
          </div>
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              {hasChoiceSidebarBanner ? (
                <ProductSidebarBanner
                  href={post.coupangLink!}
                  imageSrc={post.coupangBannerImage!}
                  alt={post.coupangBannerAlt || post.title}
                  title="픽앤조이 초이스 단독 배너"
                />
              ) : (
                <CoupangBanner bannerId="coupang-sidebar-blog-detail" />
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
