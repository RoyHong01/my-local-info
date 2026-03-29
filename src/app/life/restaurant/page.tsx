import type { Metadata } from 'next';
import RestaurantExplorer from '@/components/life/RestaurantExplorer';
import { getRestaurantsByRegion } from '@/lib/life-restaurants';

export const metadata: Metadata = {
  title: '맛집 탐방 | 일상의 즐거움 | 픽앤조이',
  description: '카카오 로컬 API 기반으로 인천/경인, 서울/경기 맛집 정보를 한 번에 확인해보세요.',
  alternates: { canonical: '/life/restaurant/' },
  openGraph: {
    title: '맛집 탐방 | 일상의 즐거움 | 픽앤조이',
    description: '카카오 로컬 API 기반으로 인천/경인, 서울/경기 맛집 정보를 한 번에 확인해보세요.',
    url: 'https://pick-n-joy.com/life/restaurant/',
  },
};

export default async function LifeRestaurantPage() {
  const [incheonGyeongin, seoulGyeonggi] = await Promise.all([
    getRestaurantsByRegion('incheon-gyeongin'),
    getRestaurantsByRegion('seoul-gyeonggi'),
  ]);

  return (
    <section>
      <header className="mb-8 bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
        <p className="text-sm font-semibold text-orange-500 mb-2">맛집 탐방</p>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-4">오늘 어디 갈지 고민될 때, 지역별로 바로 골라드릴게요</h1>
        <p className="text-stone-600 leading-8">
          카카오 로컬 API 결과를 기반으로 상호명, 주소, 전화번호, 카카오맵 링크를 정리해드려요.
          여기에 30대 에디터 톤으로 감성 한 줄 요약까지 더해서 선택이 훨씬 쉬워집니다.
        </p>
      </header>

      <RestaurantExplorer
        datasets={{
          'incheon-gyeongin': incheonGyeongin,
          'seoul-gyeonggi': seoulGyeonggi,
        }}
      />
    </section>
  );
}
