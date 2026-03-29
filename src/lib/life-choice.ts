import { getSortedPostsData, type PostData } from '@/lib/posts';

export interface ChoiceArticle {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: string;
  image?: string;
  source: 'post' | 'curated';
}

const CURATED_CHOICES: ChoiceArticle[] = [
  {
    slug: 'choice-digital-desk-setup',
    title: '업무 효율이 올라가는 데스크 셋업, 꼭 필요한 구성만 골라드릴게요',
    date: '2026-03-29',
    summary: '가전/디지털 제품을 무작정 늘리기보다, 실제 사용 시간이 긴 것부터 고르면 만족도가 높아요.',
    content: `## 오늘 바로 적용할 수 있는 데스크 셋업 팁\n\n가장 먼저 하루 사용 시간이 긴 기기부터 점검해보는 게 좋아요. 키보드와 모니터처럼 매일 쓰는 장비는 체감 차이가 크게 나거든요.\n\n### 우선순위를 이렇게 잡아보세요\n\n- **모니터 조명**: 눈 피로를 줄이는 데 바로 도움이 됩니다.\n- **무선 키보드/마우스**: 책상 정리가 쉬워져서 집중력이 올라가요.\n- **멀티탭 정리 액세서리**: 작은 불편을 없애면 작업 흐름이 훨씬 안정적입니다.\n\n처음부터 완벽하게 맞추려 하지 않아도 괜찮아요. 자주 쓰는 것부터 하나씩 바꿔보면, 일상 체감이 훨씬 빨리 옵니다.`,
    source: 'curated',
  },
  {
    slug: 'choice-home-living-spring',
    title: '봄맞이 생활 꿀템, 집안 동선을 가볍게 만드는 조합으로 추천해요',
    date: '2026-03-29',
    summary: '생활용품은 예쁜 것보다 자주 쓰는 공간에 맞는지부터 보는 게 훨씬 실용적이에요.',
    content: `## 생활 꿀템은 동선 기준으로 고르면 실패가 줄어요\n\n집에서 가장 많이 서 있는 공간을 먼저 떠올려보세요. 주방, 현관, 침실처럼 반복 동선에 맞춘 제품은 만족도가 높아요.\n\n### 이번 시즌에 특히 반응 좋은 조합\n\n- **주방 정리함 + 소형 수납함**: 조리 전 준비 시간이 줄어들어요.\n- **욕실 미끄럼 방지 매트**: 안전성과 사용감을 동시에 챙길 수 있어요.\n- **침구 케어 아이템**: 환절기 컨디션 관리에 체감이 분명합니다.\n\n필요한 항목을 메모한 뒤 1~2개만 먼저 바꿔보세요. 과소비를 줄이면서도 집이 훨씬 정돈된 느낌이 듭니다.`,
    source: 'curated',
  },
];

function isChoiceCandidate(post: PostData): boolean {
  const source = [post.title, post.category || '', ...(post.tags || [])].join(' ');
  return /쿠팡|쇼핑|가전|디지털|생활|꿀팁|추천/i.test(source);
}

function mapPostToChoice(post: PostData): ChoiceArticle {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    summary: post.summary,
    content: post.content,
    image: post.image,
    source: 'post',
  };
}

export function getChoiceArticles(limit = 4): ChoiceArticle[] {
  const posts = getSortedPostsData();
  const matched = posts.filter(isChoiceCandidate).map(mapPostToChoice);

  if (matched.length >= limit) {
    return matched.slice(0, limit);
  }

  return [...matched, ...CURATED_CHOICES].slice(0, limit);
}
