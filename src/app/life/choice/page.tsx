import type { Metadata } from 'next';
import ChoiceArticleCard from '@/components/life/ChoiceArticleCard';
import CoupangBottomBanner from '@/components/CoupangBottomBanner';
import { getChoiceArticles } from '@/lib/life-choice';

export const metadata: Metadata = {
  title: '픽앤조이 초이스 | 일상의 즐거움 | 픽앤조이',
  description: '가전/디지털/생활 꿀팁을 블로그 형식으로 쉽게 읽고 바로 실천해보세요.',
  alternates: { canonical: '/life/choice/' },
  openGraph: {
    title: '픽앤조이 초이스 | 일상의 즐거움 | 픽앤조이',
    description: '가전/디지털/생활 꿀팁을 블로그 형식으로 쉽게 읽고 바로 실천해보세요.',
    url: 'https://pick-n-joy.com/life/choice/',
  },
};

export default function LifeChoicePage() {
  const articles = getChoiceArticles(4);

  return (
    <section>
      <header className="mb-8 bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
        <p className="text-sm font-semibold text-orange-500 mb-2">픽앤조이 초이스</p>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-4">가전·디지털·생활 꿀팁, 블로그처럼 편하게 읽어보세요</h1>
        <p className="text-stone-600 leading-8">
          기존 블로그 페이지와 동일한 읽기 경험으로 구성해두었어요.
          실사용 기준으로 고른 정보만 모아서 바로 참고할 수 있게 정리해드립니다.
        </p>
      </header>

      <div className="space-y-8">
        {articles.map((article) => (
          <ChoiceArticleCard key={article.slug} article={article} />
        ))}
      </div>

      <div className="mt-10 bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
        <h2 className="text-2xl font-extrabold mb-2">추천 상품도 함께 확인해보세요</h2>
        <p className="text-stone-600 leading-7 mb-4">
          글에서 다룬 생활 동선과 연결되는 상품을 함께 보시면 비교가 훨씬 쉬워요.
        </p>
        <CoupangBottomBanner bannerId="coupang-bottom-life-choice" />
        <p className="mt-3 text-center text-xs text-stone-400">
          이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
        </p>
      </div>
    </section>
  );
}
