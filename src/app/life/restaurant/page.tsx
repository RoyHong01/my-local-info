import type { Metadata } from 'next';
import RestaurantExplorer from '@/components/life/RestaurantExplorer';
import { getRestaurantsByRegion } from '@/lib/life-restaurants';
import { getSortedPostsData } from '@/lib/posts';

export const metadata: Metadata = {
  title: '맛집 탐방 | 일상의 즐거움 | 픽앤조이',
  description: '카카오 로컬 API 기반으로 인천, 서울, 경기 맛집 정보를 한 번에 확인해보세요.',
  alternates: { canonical: '/life/restaurant/' },
  openGraph: {
    title: '맛집 탐방 | 일상의 즐거움 | 픽앤조이',
    description: '카카오 로컬 API 기반으로 인천, 서울, 경기 맛집 정보를 한 번에 확인해보세요.',
    url: 'https://pick-n-joy.com/life/restaurant/',
  },
};

export default async function LifeRestaurantPage() {
  const [incheon, seoul, gyeonggi] = await Promise.all([
    getRestaurantsByRegion('incheon'),
    getRestaurantsByRegion('seoul'),
    getRestaurantsByRegion('gyeonggi'),
  ]);
  const posts = getSortedPostsData().filter((post) => post.category === '픽앤조이 맛집 탐방');

  const postBySourceId = new Map(
    posts
      .filter((post) => post.sourceId)
      .map((post) => [String(post.sourceId), { href: `/blog/${post.slug}`, title: post.title }])
  );

  const postByPlaceName = new Map(
    posts
      .filter((post) => post.placeName)
      .map((post) => [String(post.placeName).trim(), { href: `/blog/${post.slug}`, title: post.title }])
  );

  const attachBlogLink = <T extends { id: string; name: string }>(items: T[]) =>
    items.map((item) => {
      const matched = postBySourceId.get(item.id) || postByPlaceName.get(item.name.trim());
      return matched
        ? { ...item, blogHref: matched.href, blogTitle: matched.title }
        : item;
    });

  return (
    <section>
      <header className="mb-8 bg-content-floral rounded-3xl p-8 shadow-sm border border-stone-100">
        <p className="text-base md:text-lg font-semibold text-orange-500 mb-3">맛집 탐방</p>
        <h1 className="text-[1.75rem] md:text-[2rem] font-extrabold mb-5">오늘 어디 갈지 고민될 때, 지역별로 바로 골라드릴게요</h1>
        <p className="text-stone-600 leading-8">
          카카오 로컬 API 결과를 기반으로 상호명, 주소, 전화번호, 카카오맵 링크를 정리해드려요.
          여기에 30대 에디터 톤으로 감성 한 줄 요약까지 더해서 선택이 훨씬 쉬워집니다.
        </p>
      </header>

      <RestaurantExplorer
        datasets={{
          incheon: attachBlogLink(incheon),
          seoul: attachBlogLink(seoul),
          gyeonggi: attachBlogLink(gyeonggi),
        }}
      />
    </section>
  );
}
