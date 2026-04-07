import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사이트 소개 | 픽앤조이',
  description: '인천 보조금부터 전국 축제까지, 복잡한 공공 데이터를 AI가 분석하여 시민 눈높이로 전달하는 픽앤조이 소개 페이지입니다.',
  alternates: { canonical: '/about/' },
  openGraph: {
    title: '사이트 소개 | 픽앤조이',
    description: '공공데이터포털 정식 API 활용, AI 기반 맞춤형 큐레이션으로 복잡한 복지·생활 정보를 빠르게 전달합니다.',
    url: 'https://pick-n-joy.com/about/',
  },
};

export default function AboutPage() {
  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "픽앤조이 소개",
    url: "https://pick-n-joy.com/about/",
    description: "인천 보조금부터 전국 축제까지, 복잡한 공공 데이터를 AI가 분석하여 시민 눈높이로 전달하는 픽앤조이 소개 페이지입니다.",
    mainEntity: {
      "@type": "Organization",
      name: "픽앤조이",
      url: "https://pick-n-joy.com",
      description: "공공데이터포털 정식 API를 활용해 복지·보조금·축제 정보를 AI가 시민 관점으로 재구성하는 공공데이터 기반 생활정보 서비스",
    },
  };

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-extrabold mb-2">픽앤조이 소개</h1>
        <p className="text-stone-500 mb-8 text-base">공공데이터를 시민 눈높이로 재구성하는 생활정보 서비스</p>

        <article className="bg-content-floral p-8 rounded-3xl shadow-sm border border-stone-100 space-y-8">

          {/* E-E-A-T: 운영 목적 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">운영 목적</h2>
            <p className="text-stone-600 leading-relaxed">
              픽앤조이는 시민이 실제로 체감할 수 있는 정보를 가장 빠르게 전달하는 생활정보 플랫폼입니다.
              인천 생활정보와 전국 복지·보조금, 축제·여행 정보를 한 흐름에서 볼 수 있도록 묶어,
              "몰라서 놓치는 혜택"과 "찾기 어려운 생활정보"를 줄이는 데 집중합니다.
            </p>
          </section>

          {/* E-E-A-T: 공공데이터 접근성 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">공공데이터 접근성 개선</h2>
            <p className="text-stone-600 leading-relaxed">
              복잡한 공공기관 API 데이터를 시민들이 가장 빠르게 확인할 수 있도록 재구성했습니다.
              행정 용어로 가득한 원문을 생활자 관점으로 풀어 쓰고, 신청 동선 중심으로 정리해
              정보 탐색 시간을 대폭 줄이는 것이 픽앤조이의 핵심 가치입니다.
            </p>
          </section>

          {/* E-E-A-T: AI 기반 맞춤형 해석 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">AI 기반 맞춤형 해석</h2>
            <p className="text-stone-600 leading-relaxed">
              단순 정보 나열을 넘어, AI 분석을 통해 사용자별 맞춤 혜택과 주의사항을 큐레이션합니다.
              복지·보조금은 신청 자격과 놓치기 쉬운 조건을 부각하고, 축제·여행과 맛집·초이스 콘텐츠는
              상황 기반 추천 로직으로 선별해 검색 시간을 줄이는 "프리미엄 생활 큐레이션" 경험을 제공합니다.
            </p>
          </section>

          {/* E-E-A-T: 데이터 투명성 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">데이터 투명성</h2>
            <p className="text-stone-600 leading-relaxed">
              공공데이터포털(<a href="https://data.go.kr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">data.go.kr</a>)과 한국관광공사 TourAPI 등
              정식 오픈API를 활용하며, 출처를 명확히 밝혀 정보의 신뢰도를 높였습니다.
              원문 데이터의 핵심 필드를 유지한 상태에서 생활자 관점으로 재구성하며,
              공공데이터 활용 가이드라인을 준수합니다.
            </p>
          </section>

          {/* 콘텐츠 생성 방식 */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-orange-600">콘텐츠 생성 방식</h2>
            <p className="text-stone-600 leading-relaxed">
              인천시 공공데이터, 보조금24, TourAPI의 데이터를 매일 자동 수집하고,
              AI를 통해 일반 시민이 이해하기 쉬운 형태로 재작성합니다.
              단순 데이터 출력이 아닌, 편집 기준과 큐레이션 원칙이 적용된 가공 콘텐츠를 제공하는
              정보 가공 및 제공 서비스입니다.
            </p>
          </section>

          {/* 문의 */}
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
