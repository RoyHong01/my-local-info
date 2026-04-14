import fs from 'fs';
import path from 'path';
import { getSortedPostsData, type PostData } from '@/lib/posts';

export interface ChoiceArticle {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: string;
  image?: string;
  coupangBannerImage?: string;
  source: 'post' | 'curated';
}

const CURATED_CHOICES: ChoiceArticle[] = [];

const CORE_CATEGORIES = ['인천 지역 정보', '전국 보조금·복지 정책', '전국 축제·여행'];

function isChoiceCandidate(post: PostData): boolean {
  // 기존 3대 카테고리 포스트는 무조건 제외
  if (post.category && CORE_CATEGORIES.includes(post.category)) return false;
  // '픽앤조이 초이스' 카테고리이거나 review 관련 태그가 있으면 포함
  if (post.category === '픽앤조이 초이스') return true;
  if (post.tags?.some((t) => /리뷰|review|쿠팡|추천상품/i.test(t))) return true;
  return false;
}

function resolveChoiceCardImage(image?: string, fallback?: string): string | undefined {
  const primary = String(image || '').trim();
  const fallbackImage = String(fallback || '').trim();

  if (!primary) return fallbackImage || undefined;

  // `/images/...` 형태는 실제 public 파일 존재 여부를 확인하고, 없으면 배너 이미지로 대체
  if (primary.startsWith('/')) {
    const diskPath = path.join(process.cwd(), 'public', primary.replace(/^\//, ''));
    if (!fs.existsSync(diskPath)) {
      return fallbackImage || undefined;
    }
  }

  return primary;
}

function mapPostToChoice(post: PostData): ChoiceArticle {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    summary: post.summary,
    content: post.content,
    image: resolveChoiceCardImage(post.image, post.coupangBannerImage),
    coupangBannerImage: post.coupangBannerImage,
    source: 'post',
  };
}

export function getChoiceArticles(limit = 1000): ChoiceArticle[] {
  const posts = getSortedPostsData();
  const matched = posts.filter(isChoiceCandidate).map(mapPostToChoice);

  if (matched.length >= limit) {
    return matched.slice(0, limit);
  }

  return [...matched, ...CURATED_CHOICES].slice(0, limit);
}
