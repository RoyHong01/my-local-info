import { Suspense } from 'react';
import { getRestaurantsByRegion } from '@/lib/life-restaurants';
import { getChoiceArticles } from '@/lib/life-choice';
import { getSortedPostsData } from '@/lib/posts';
import LifeFilterClient, { type LifePageItem } from '@/components/LifeFilterClient';

export default async function LifePage() {
  const [incheonGyeongin, seoulGyeonggi] = await Promise.all([
    getRestaurantsByRegion('incheon-gyeongin'),
    getRestaurantsByRegion('seoul-gyeonggi'),
  ]);
  const posts = getSortedPostsData();
  const choices = getChoiceArticles(6);

  const restaurantPosts = posts
    .filter((post) => post.category === '픽앤조이 맛집 탐방')
    .slice(0, 12);

  const restaurantItems: LifePageItem[] = restaurantPosts.length > 0
    ? restaurantPosts.map((post) => ({
        type: 'restaurant' as const,
        id: post.slug,
        title: post.title,
        description: post.description || post.summary,
        date: post.date,
        image: post.image,
        href: `/blog/${post.slug}`,
        badge: '맛집 탐방',
        badgeClass: 'bg-amber-50 text-amber-700',
        meta: post.tags?.includes('인천/경인')
          ? '인천/경인'
          : post.tags?.includes('서울/경기')
            ? '서울/경기'
            : '맛집 포스트',
      }))
    : [
        ...incheonGyeongin.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          title: r.name,
          description: r.summary.split('\n\n')[0].trim() || r.summary.slice(0, 100),
          href: r.mapUrl,
          external: true,
          badge: '맛집 탐방',
          badgeClass: 'bg-amber-50 text-amber-700',
          meta: '인천/경인',
        })),
        ...seoulGyeonggi.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          title: r.name,
          description: r.summary.split('\n\n')[0].trim() || r.summary.slice(0, 100),
          href: r.mapUrl,
          external: true,
          badge: '맛집 탐방',
          badgeClass: 'bg-amber-50 text-amber-700',
          meta: '서울/경기',
        })),
      ];

  const choiceItems: LifePageItem[] = choices.map((c) => ({
    type: 'choice' as const,
    id: c.slug,
    title: c.title,
    description: c.summary,
    date: c.date,
    image: c.image,
    href: c.source === 'post' ? `/blog/${c.slug}` : '/life/choice',
    badge: '픽앤조이 초이스',
    badgeClass: 'bg-orange-50 text-orange-600',
  }));

  const total = restaurantItems.length + choiceItems.length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1">
          <span className="text-3xl">🌟</span> 일상의 즐거움
        </h1>
        <p className="text-stone-500 text-sm">맛집 탐방부터 쇼핑 초이스까지, 오늘의 선택을 도와드립니다</p>
        <p className="text-xs text-stone-400 mt-1">총 {total}편</p>
      </div>

      <Suspense fallback={null}>
        <LifeFilterClient restaurants={restaurantItems} choices={choiceItems} />
      </Suspense>
    </div>
  );
}
