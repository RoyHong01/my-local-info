import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사이트 소개 | 픽앤조이',
  description: '픽앤조이는 시민 체감형 공공 복지 플랫폼으로 공공데이터 기반 복지 큐레이션과 데이터 분석 기반 라이프스타일 큐레이션을 제공합니다.',
  alternates: { canonical: '/about/' },
  openGraph: {
    title: '사이트 소개 | 픽앤조이',
    description: '공공데이터 기반 복지 큐레이션과 데이터 분석 기반 라이프스타일 큐레이션으로 인천부터 전국 축제·여행 정보까지 쉽게 전달합니다.',
    url: 'https://pick-n-joy.com/about/',
  },
};

export default function AboutPage() {
  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-extrabold mb-8">사이트 소개</h1>
            
        <article className="bg-content-floral p-8 rounded-3xl shadow-sm border border-stone-100 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">운영 목적</h2>
            <p className="text-stone-600 leading-relaxed">
              픽앤조이는 시민이 실제로 체감할 수 있는 정보를 가장 빠르게 전달하는 생활정보 플랫폼을 목표로 운영합니다.
              인천 생활정보와 전국 복지·보조금, 축제·여행 정보를 한 흐름에서 볼 수 있도록 묶어,
              "몰라서 놓치는 혜택"과 "찾기 어려운 생활정보"를 줄이는 데 집중합니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">데이터 출처</h2>
            <p className="text-stone-600 leading-relaxed">
              본 사이트의 핵심 정보는 행정안전부 공공데이터포털(<a href="https://data.go.kr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">data.go.kr</a>)과 관광 공공 API 등
              검증 가능한 오픈데이터를 기반으로 수집됩니다.
              원문 데이터의 핵심 필드를 유지한 상태에서 생활자 관점으로 재구성해, 공공 복지 정보를 더 이해하기 쉽게 제공합니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">콘텐츠 생성 방식</h2>
            <p className="text-stone-600 leading-relaxed">
              픽앤조이는 단순 목록 노출이 아니라, 공공데이터 기반 복지 큐레이션과 데이터 분석 기반 라이프스타일 큐레이션을 함께 운영합니다.
              복지·보조금은 신청 동선 중심으로 정리하고, 축제·여행과 맛집·초이스 콘텐츠는 상황 기반 추천 로직으로 선별해
              검색 시간을 줄이는 "프리미엄 생활 큐레이션" 경험을 제공하는 것이 운영 원칙입니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">문의</h2>
            <p className="text-stone-600 leading-relaxed">
              사이트 운영 및 제휴 관련 문의: <a href="mailto:royshong01@gmail.com" className="text-orange-500 hover:underline">royshong01@gmail.com</a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
