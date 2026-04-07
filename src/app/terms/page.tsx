import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 | 픽앤조이',
  description:
    '픽앤조이 이용약관 안내 페이지입니다. 서비스 이용 조건, 정보 제공 한계와 면책, 저작권, 문의처를 확인할 수 있습니다.',
  alternates: { canonical: '/terms/' },
  openGraph: {
    title: '이용약관 | 픽앤조이',
    description:
      '공공데이터 기반 정보 서비스의 이용 조건과 면책 조항, 콘텐츠 저작권 및 문의처를 안내합니다.',
    url: 'https://pick-n-joy.com/terms/',
  },
};

export default function TermsPage() {
  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="bg-content-floral p-8 rounded-3xl shadow-sm border border-stone-100 space-y-8">
          <header>
            <h1 className="text-4xl font-extrabold mb-5">이용약관 (Terms of Service)</h1>
            <p className="text-stone-600 leading-relaxed">
              본 약관은 픽앤조이(pick-n-joy.com)가 제공하는 공공데이터 큐레이션 서비스의 이용 조건 및 절차를 규정합니다.
            </p>
          </header>

          <section className="pt-4">
            <h2 className="text-2xl font-bold mb-3 text-orange-600">제1조 (목적)</h2>
            <p className="text-stone-600 leading-relaxed">
              본 약관은 픽앤조이가 제공하는 공공데이터 기반 정보 서비스의 이용과 관련하여, 이용자와 운영자 간의
              권리·의무 및 책임사항을 정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">제2조 (서비스의 내용)</h2>
            <p className="text-stone-600 leading-relaxed mb-3">
              픽앤조이는 공공데이터포털, 한국관광공사 API 등 공개된 데이터 소스를 기반으로 복지, 축제, 지역 정보를
              AI 기반으로 재구성하여 제공합니다.
            </p>
            <ul className="list-disc pl-6 text-stone-600 leading-relaxed space-y-2">
              <li>공공데이터 수집 및 정기 업데이트</li>
              <li>이용자 관점의 요약·정리·카테고리 큐레이션</li>
              <li>콘텐츠 탐색 및 비교를 위한 부가 정보 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">제3조 (서비스 이용의 한계 및 면책)</h2>
            <p className="text-stone-600 leading-relaxed mb-3">
              본 서비스에서 제공하는 정보는 공공기관의 데이터를 실시간 또는 정기적으로 반영한 것이나,
              데이터의 완전성·정확성·최신성을 절대적으로 보장하지 않습니다.
            </p>
            <ul className="list-disc pl-6 text-stone-600 leading-relaxed space-y-2">
              <li>제공 정보는 참고용이며, 실제 신청·접수·법적 판단 전 해당 기관에 반드시 직접 확인해야 합니다.</li>
              <li>서비스 정보 이용으로 인해 발생한 직·간접적 손실에 대해 운영자는 책임을 지지 않습니다.</li>
              <li>외부 기관 정책 변경, API 장애, 데이터 지연으로 인한 정보 차이에 대해 운영자는 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">제4조 (저작권)</h2>
            <p className="text-stone-600 leading-relaxed">
              서비스 내 AI 생성 문구, 편집물, 디자인, 정보 구조 및 큐레이션 결과물의 저작권은 픽앤조이 운영자에게 있습니다.
              본 사이트의 콘텐츠를 운영자의 사전 동의 없이 무단 복제, 배포, 2차 가공, 상업적 이용하는 행위를 금지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">제5조 (문의)</h2>
            <p className="text-stone-600 leading-relaxed">
              약관 관련 문의는 아래 이메일로 접수해 주세요.
              <br />
              이메일: <a className="text-orange-500 hover:underline" href="mailto:royshong01@gmail.com">royshong01@gmail.com</a>
            </p>
          </section>

          <p className="text-sm text-stone-500">시행일: 2026년 4월 8일</p>
        </article>
      </main>
    </div>
  );
}