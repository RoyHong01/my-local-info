import { getPostData, getSortedPostsData } from '@/lib/posts';
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
import ReadingProgressBar from '@/components/ReadingProgressBar';
import StickyChoiceCTA from '@/components/StickyChoiceCTA';
import { sanitizeMarkdown } from '@/lib/markdown-utils';

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeFirstDuplicateHeroImage(markdown: string, heroImage?: string): string {
  // [재발 방지 - 단독 픽 본문 첫 이미지 위치 회귀 방지]
  // 이 함수는 frontmatter `image`(=hero)와 동일한 본문 이미지를 첫 1회 strip한다.
  // 따라서 단독 모드 초이스 글의 buildSinglePickBlock(scripts/generate-choice-post.js)은
  // "## 📍 픽앤조이 오늘의 단독 픽" 헤딩 아래에 hero를 절대 푸시하면 안 된다
  // (= middleImage만 사용. 안 그러면 헤딩 아래 이미지가 strip되어 CTA만 외톨이로 남음).
  // 빌드 가드: scripts/validate-choice-quality.js::validateManualSinglePickImagePosition
  const image = String(heroImage || '').trim();
  if (!markdown || !image) return markdown;

  const pattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(image)}\\)\\s*\\n?`, 'i');
  return markdown.replace(pattern, '');
}

function stripTrailingChoiceDisclosure(markdown: string): string {
  return String(markdown || '')
    .replace(/\n\s*---\s*\n\s*쿠팡\s*파트너스\s*활동의\s*일환으로[^\n]*\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type ChoiceSidebarProduct = {
  href: string;
  imageSrc: string;
  alt: string;
};

function extractChoiceSidebarProducts(markdown: string, fallbackAlt: string): ChoiceSidebarProduct[] {
  const text = String(markdown || '');
  if (!text) return [];

  // escaped bracket(\], \[)가 포함된 alt 텍스트도 파싱 가능하도록 처리
  const imageMatches = Array.from(text.matchAll(/!\[((?:\\.|[^\]])*)\]\((https?:\/\/[^)\s]+)\)/g));
  const linkMatches = Array.from(text.matchAll(/\[((?:\\.|[^\]])*)\]\((https?:\/\/[^)\s]+)\)/g))
    .map((match) => match[2])
    .filter((url) => /link\.coupang\.com\/re\//i.test(url));

  const maxPairs = Math.min(imageMatches.length, linkMatches.length);
  const products: ChoiceSidebarProduct[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < maxPairs; i++) {
    const alt = (imageMatches[i][1] || fallbackAlt || '추천 상품')
      .replace(/\\([\[\]\(\)])/g, '$1')
      .trim();
    const imageSrc = imageMatches[i][2];
    const href = linkMatches[i];
    const key = `${imageSrc}__${href}`;

    if (seen.has(key)) continue;
    seen.add(key);
    products.push({ href, imageSrc, alt });
  }

  return products;
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

function parseSchemaNumber(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/,/g, '').trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractChoiceProductName(post: NonNullable<ReturnType<typeof getPostData>>) {
  const bannerAlt = String(post.coupangBannerAlt || '').trim();
  if (bannerAlt) {
    return bannerAlt.split(',')[0].trim() || bannerAlt;
  }
  return post.title;
}

function buildEditorialAuthorJsonLd() {
  return {
    '@type': 'Person',
    name: 'Pick-n-Joy Editor',
    alternateName: '픽앤조이 에디터',
    url: 'https://pick-n-joy.com/about/',
  };
}

function buildChoiceReviewJsonLd(post: NonNullable<ReturnType<typeof getPostData>>, description: string) {
  const ratingValue = parseSchemaNumber(post.ratingValue);
  if (!ratingValue) return null;

  const reviewCount = parseSchemaNumber(post.reviewCount);
  const pageUrl = `https://pick-n-joy.com/blog/${post.slug}/`;
  const editorialAuthorJsonLd = buildEditorialAuthorJsonLd();
  const productJsonLd: Record<string, unknown> = {
    '@type': 'Product',
    name: extractChoiceProductName(post),
    description: post.description || post.summary,
    image: post.image ? [post.image] : post.coupangBannerImage ? [post.coupangBannerImage] : undefined,
    category: post.category || '픽앤조이 초이스',
    url: pageUrl,
  };

  if (reviewCount) {
    productJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: `${post.title} 리뷰`,
    headline: post.title,
    reviewBody: description,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'ko-KR',
    author: editorialAuthorJsonLd,
    publisher: {
      '@type': 'Organization',
      name: '픽앤조이',
      url: 'https://pick-n-joy.com',
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: productJsonLd,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  };
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
      additionalType: 'https://schema.org/Review',
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

type MarkdownSectionSplit = {
  before: string;
  section: string;
  after: string;
};

function splitMarkdownByHeadingBlock(markdown: string, headingPattern: RegExp): MarkdownSectionSplit | null {
  const headingMatch = headingPattern.exec(markdown);
  if (!headingMatch || headingMatch.index == null) return null;

  const sectionStart = headingMatch.index;
  const afterHeadingStart = sectionStart + headingMatch[0].length;
  const rest = markdown.slice(afterHeadingStart);
  const nextHeadingMatch = /\n#{1,6}\s+/.exec(rest);
  const sectionEnd = nextHeadingMatch ? afterHeadingStart + nextHeadingMatch.index + 1 : markdown.length;

  return {
    before: markdown.slice(0, sectionStart),
    section: markdown.slice(sectionStart, sectionEnd),
    after: markdown.slice(sectionEnd),
  };
}

function findFirstSectionSplit(markdown: string, headingPatterns: RegExp[]): MarkdownSectionSplit | null {
  for (const pattern of headingPatterns) {
    const split = splitMarkdownByHeadingBlock(markdown, pattern);
    if (split) return split;
  }
  return null;
}

function buildKakaoSearchLink(query: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query.trim())}`;
}

function extractAddressCandidateFromContent(content: string): string {
  const markerPatterns = [
    /📌\s*\*\*주소\*\*:\s*([^\n]+)/,
    /📍\s*장소:\s*([^\n]+)/,
    /-\s+\*\*주소\*\*:\s*([^\n]+)/,
  ];

  for (const pattern of markerPatterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return '';
}

function resolveFestivalKakaoMapLink(post: NonNullable<ReturnType<typeof getPostData>>, content: string): string | null {
  const existingMapLink = content.match(/\[[^\]]*카카오맵[^\]]*\]\((https?:\/\/map\.kakao\.com\/[^)]+)\)/i)?.[1];
  if (existingMapLink) return existingMapLink;

  const address = extractAddressCandidateFromContent(content);
  if (address) return buildKakaoSearchLink(address);

  const fallbackQuery = String(post.title || '').trim();
  if (!fallbackQuery) return null;
  return buildKakaoSearchLink(fallbackQuery);
}

function resolveRestaurantKakaoMapLink(post: NonNullable<ReturnType<typeof getPostData>>, content: string): string | null {
  const query = String(post.placeAddress || '').trim()
    || extractAddressCandidateFromContent(content)
    || String(post.placeName || '').trim()
    || String(post.title || '').trim();

  if (!query) return null;
  return buildKakaoSearchLink(query);
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
      ...((post.image || post.coupangBannerImage) ? { images: [{ url: post.image || post.coupangBannerImage!, width: 1200, height: 630, alt: post.title }] } : {}),
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
  const sanitizedContent = sanitizeMarkdown(post.content || '');
  const description = buildMetaDescription(sanitizedContent) || post.description || post.summary || sanitizedContent.substring(0, 160).replace(/\n/g, ' ');
  const seoClassification = classifyPostForSeo(post);
  const editorialAuthorJsonLd = buildEditorialAuthorJsonLd();

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
    author: editorialAuthorJsonLd,
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
  const isFestivalPost = !isRestaurantPost && !isChoicePost && /축제|여행/.test(post.category || '');
  const isIncheonOrSubsidyPost = /인천|보조금|복지/.test(post.category || '');
  const useExpandedSourceSpacing = isIncheonOrSubsidyPost && !isChoicePost && !!sourceLink;
  const choiceContentBase = isChoicePost ? stripTrailingChoiceDisclosure(sanitizedContent) : sanitizedContent;
  const extractedFromBase = isChoicePost
    ? extractChoiceSidebarProducts(choiceContentBase, post.coupangBannerAlt || post.title)
    : [];
  const shouldHideChoiceHero = isChoicePost && extractedFromBase.length >= 2;
  const renderedContent = isChoicePost
    ? (shouldHideChoiceHero ? choiceContentBase : removeFirstDuplicateHeroImage(choiceContentBase, post.image))
    : sanitizedContent;
  const isSingleChoicePost = isChoicePost && /(^|\n)##\s+📍\s+픽앤조이\s+오늘의\s+단독\s+픽\s*(\n|$)/m.test(renderedContent);
  const extractedChoiceSidebarProducts = isChoicePost
    ? extractChoiceSidebarProducts(renderedContent, post.coupangBannerAlt || post.title)
    : [];
  const choiceSidebarProducts = extractedChoiceSidebarProducts.length > 0
    ? extractedChoiceSidebarProducts
    : (isChoicePost && post.coupangLink && post.coupangBannerImage
      ? [{
          href: post.coupangLink,
          imageSrc: post.coupangBannerImage,
          alt: post.coupangBannerAlt || post.title,
        }]
      : []);
  const hasChoiceSidebarBanner = choiceSidebarProducts.length > 0;
  const restaurantJsonLd = isRestaurantPost ? buildRestaurantJsonLd(post) : null;
  const choiceReviewJsonLd = isChoicePost ? buildChoiceReviewJsonLd(post, description) : null;
  const heroImageSourceNote = String(post.imageSourceNote || (post.imageSource ? `출처: ${post.imageSource}` : '')).trim();
  const shouldShowHero = !!post.image && (!isChoicePost || !shouldHideChoiceHero);
  const isSvgHero = !!post.image && post.image.endsWith('.svg');
  const useOriginalHeroSize = !!post.heroOriginalSize && !isChoicePost && !isSvgHero;
  const heroImageSrc = post.image || '/images/default-lifestyle.svg';
  const restaurantSectionSplit = isRestaurantPost
    ? findFirstSectionSplit(renderedContent, [/^##\s*방문 정보 한눈에\s*$/m])
    : null;
  const festivalSectionSplit = isFestivalPost
    ? findFirstSectionSplit(renderedContent, [
        /^###\s*📍\s*위치 확인\s*&\s*길찾기\s*$/m,
        /^##\s*📌\s*한눈에 보는 여행 정보\s*$/m,
      ])
    : null;
  const mapSectionSplit = restaurantSectionSplit || festivalSectionSplit;
  const kakaoMapLink = isRestaurantPost
    ? resolveRestaurantKakaoMapLink(post, renderedContent)
    : isFestivalPost
      ? resolveFestivalKakaoMapLink(post, renderedContent)
      : null;

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <ReadingProgressBar />
      {isChoicePost && post.coupangLink && (
        <StickyChoiceCTA href={post.coupangLink} />
      )}
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
      {choiceReviewJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(choiceReviewJsonLd) }}
        />
      )}

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12 items-start overflow-visible">
          {/* 본문 영역 */}
          <div className="flex-1 min-w-0">
            <Suspense fallback={<span className="text-orange-600 mb-8 inline-block">&larr; 목록으로 돌아가기</span>}>
              <BlogBackButton fallbackHref="/blog" />
            </Suspense>
            <article className="bg-content-floral p-8 rounded-3xl shadow-sm border border-stone-100">
              <header className="mb-8 border-b border-stone-100 pb-8">
                <h1 className="text-4xl font-extrabold mb-4">{post.title}</h1>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-stone-500">작성일: {post.date}</span>
                  <span className="text-stone-300">|</span>
                  <span className="text-stone-500 font-medium">최종 업데이트: {post.date}</span>
                </div>
              </header>
              {shouldShowHero && (
                isChoicePost ? (
                  <div className="mb-14 flex justify-center">
                    <div className="relative w-full max-w-[480px] aspect-[4/5] overflow-hidden rounded-xl border border-stone-100 shadow-sm bg-white">
                      <Image
                        src={heroImageSrc}
                        alt={post.title}
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 75vw, 480px"
                        priority
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mb-14">
                    {useOriginalHeroSize ? (
                      <div className="rounded-2xl overflow-hidden border border-stone-100 bg-white">
                        <Image
                          src={heroImageSrc}
                          alt={post.title}
                          width={0}
                          height={0}
                          sizes="100vw"
                          className="w-full h-auto object-contain"
                          priority
                        />
                      </div>
                    ) : (
                      <div className={`relative w-full h-72 md:h-96 rounded-2xl overflow-hidden ${isSvgHero ? 'bg-white border border-stone-100' : ''}`}>
                        <Image
                          src={heroImageSrc}
                          alt={post.title}
                          fill
                          className={isSvgHero ? 'object-contain p-6' : 'object-cover'}
                          sizes="(max-width: 768px) 100vw, 1200px"
                          priority
                        />
                      </div>
                    )}
                    {heroImageSourceNote && (
                      <p className="mt-2 text-xs text-stone-500">{heroImageSourceNote}</p>
                    )}
                  </div>
                )
              )}
              <div className={`blog-prose${isChoicePost ? ' choice-post-prose' : ''}${isSingleChoicePost ? ' choice-single-post-prose' : ''} prose prose-stone prose-orange max-w-none mb-12 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h1:font-extrabold prose-h2:font-bold`}>
                {mapSectionSplit && kakaoMapLink ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mapSectionSplit.before}
                    </ReactMarkdown>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mapSectionSplit.section}
                    </ReactMarkdown>
                    <div className="my-8 not-prose">
                      <a
                        href={kakaoMapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-3 font-bold text-gray-900 transition-colors hover:bg-yellow-500"
                      >
                        <span>🗺️ 카카오맵 길찾기</span>
                      </a>
                    </div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mapSectionSplit.after}
                    </ReactMarkdown>
                  </>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {renderedContent}
                  </ReactMarkdown>
                )}
              </div>
              <AdBanner />
              <div className={`mt-4 pt-4 ${isChoicePost ? '' : 'border-t border-stone-100'} text-sm text-stone-500 ${useExpandedSourceSpacing ? 'flex flex-col gap-8' : ''}`}>
                {sourceLink && !isChoicePost && (
                  <p className={useExpandedSourceSpacing ? 'my-12 py-2' : 'mt-1 mb-7'}>
                    <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700 transition-colors bg-white px-4 py-2 rounded-lg border border-stone-200 hover:border-orange-300 shadow-sm">
                      <span>공식 원문 바로가기</span>
                      <span>&rarr;</span>
                    </a>
                  </p>
                )}
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
              </div>
              <div className="mt-8">
                <CoupangBottomBanner bannerId="coupang-bottom-blog" />
              </div>
            </article>
          </div>

          {/* 사이드바 영역 - sticky 작동 필수 조건:
              1. 부모(flex 컨테이너)에 overflow: visible 유지
              2. self-stretch로 부모 높이만큼 레일 확보
              3. 조상 요소에 overflow: hidden 금지 (clip은 허용)
              4. 조상에 h-screen/h-full 금지 */}
          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <div className="mb-4">
                  <TaeheoAdBanner />
                </div>
                {hasChoiceSidebarBanner ? (
                  choiceSidebarProducts.map((product, index) => (
                    <ProductSidebarBanner
                      key={`${product.href}-${index}`}
                      href={product.href}
                      imageSrc={product.imageSrc}
                      alt={product.alt}
                      title={product.alt}
                    />
                  ))
                ) : (
                  <CoupangBanner bannerId="coupang-sidebar-blog-detail" />
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
