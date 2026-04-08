import { Suspense } from 'react';
import { getRestaurantsByRegion } from '@/lib/life-restaurants';
import { getChoiceArticles } from '@/lib/life-choice';
import { getSortedPostsData } from '@/lib/posts';
import LifeFilterClient, { type LifePageItem } from '@/components/LifeFilterClient';
import ScrollRestorer from '@/components/ScrollRestorer';

export default async function LifePage() {
  const [incheon, seoul, gyeonggi] = await Promise.all([
    getRestaurantsByRegion('incheon'),
    getRestaurantsByRegion('seoul'),
    getRestaurantsByRegion('gyeonggi'),
  ]);
  const posts = getSortedPostsData();
  const choices = getChoiceArticles();

  const restaurantPosts = posts
    .filter((post) => post.category === '픽앤조이 맛집 탐방');

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
        meta: post.placeLocality === '인천'
          ? '인천 맛집'
          : post.placeLocality === '서울'
            ? '서울 맛집'
            : post.placeLocality === '경기'
              ? '경기 맛집'
              : post.tags?.includes('인천/경인')
                ? '인천 맛집'
                : post.tags?.includes('서울/경기')
                  ? '서울 맛집'
                  : '경기 맛집',
      }))
    : [
        ...incheon.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          title: r.name,
          description: r.summary.split('\n\n')[0].trim() || r.summary.slice(0, 100),
          href: r.mapUrl,
          external: true,
          badge: '맛집 탐방',
          badgeClass: 'bg-amber-50 text-amber-700',
          meta: '인천 맛집',
        })),
        ...seoul.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          title: r.name,
          description: r.summary.split('\n\n')[0].trim() || r.summary.slice(0, 100),
          href: r.mapUrl,
          external: true,
          badge: '맛집 탐방',
          badgeClass: 'bg-amber-50 text-amber-700',
          meta: '서울 맛집',
        })),
        ...gyeonggi.map((r) => ({
          type: 'restaurant' as const,
          id: r.id,
          title: r.name,
          description: r.summary.split('\n\n')[0].trim() || r.summary.slice(0, 100),
          href: r.mapUrl,
          external: true,
          badge: '맛집 탐방',
          badgeClass: 'bg-amber-50 text-amber-700',
          meta: '경기 맛집',
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
      <ScrollRestorer storageKey="lifeScrollY" />

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1">
          <span className="text-3xl">🌟</span> 일상의 즐거움
        </h1>
        <p className="mt-3 text-gray-500 text-sm">고민은 줄이고 즐거움은 더하고. 검증된 맛집과 감성 가득한 쇼핑 정보로 당신의 하루를 채워드릴게요.</p>
        <p className="text-xs text-stone-400 mt-1">총 {total}편</p>
      </div>

      <Suspense fallback={null}>
        <LifeFilterClient restaurants={restaurantItems} choices={choiceItems} />
      </Suspense>
    </div>
  );
}
