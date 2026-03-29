import Link from 'next/link';
import type { Metadata } from 'next';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: '사이트 소개 | 픽앤조이',
  description: '픽앤조이는 인천 및 전국의 유용한 생활 정보를 모아 한눈에 보기 쉽게 제공합니다.',
  alternates: { canonical: '/about/' },
  openGraph: {
    title: '사이트 소개 | 픽앤조이',
    description: '픽앤조이는 인천 및 전국의 유용한 생활 정보를 모아 한눈에 보기 쉽게 제공합니다.',
    url: 'https://pick-n-joy.com/about/',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12 items-start">
          <div className="flex-1 min-w-0 max-w-3xl">
            <h1 className="text-4xl font-extrabold mb-8">사이트 소개</h1>
            
            <article className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-8">
              <section>
                <h2 className="text-2xl font-bold mb-4 text-orange-600">운영 목적</h2>
                <p className="text-stone-600 leading-relaxed">
                  본 사이트는 인천 및 전국의 유용한 생활 정보(행사, 축제, 보조금, 여행 등)를 모아 한눈에 보기 쉽게 제공하는 것을 목적으로 합니다.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4 text-orange-600">데이터 출처</h2>
                <p className="text-stone-600 leading-relaxed">
                  본 사이트에 수집된 모든 기본 정보는 행정안전부 공공데이터포털(<a href="https://data.go.kr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">data.go.kr</a>)의 신뢰할 수 있는 오픈 API를 기반으로 합니다.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4 text-orange-600">콘텐츠 생성 방식</h2>
                <p className="text-stone-600 leading-relaxed">
                  파편화된 공공데이터를 주민들이 가장 이해하기 쉽도록, 최신 AI 알고리즘을 활용해 블로그 포스트 형식으로 자동 요약 및 재생성하고 있습니다.
                </p>
              </section>
            </article>
          </div>
          <aside className="hidden lg:block w-60 flex-shrink-0 sticky top-24">
            <div className="flex flex-col gap-4">
              <TaeheoAdBanner />
              <CoupangBanner bannerId="coupang-sidebar-about" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
