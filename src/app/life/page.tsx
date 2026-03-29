import Link from 'next/link';

export default function LifePage() {
  return (
    <section>
      <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm border border-stone-100 mb-8">
        <p className="text-sm text-orange-500 font-semibold mb-3">LIFE</p>
        <h1 className="text-4xl font-extrabold leading-tight mb-4">일상의 즐거움, 지금 바로 골라보세요</h1>
        <p className="text-stone-600 leading-8 max-w-3xl">
          오늘 당장 가볼 맛집 탐방부터, 생활에 바로 도움이 되는 쇼핑 초이스까지 한 번에 정리해드려요.
          기존 블로그와 같은 읽기 편한 톤으로 구성해서 부담 없이 살펴보실 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/life/restaurant" className="menu-card bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:border-orange-200 transition block">
          <p className="text-sm font-semibold text-orange-500 mb-2">맛집 탐방</p>
          <h2 className="text-2xl font-extrabold mb-3">카카오 API 기반 지역 맛집 큐레이션</h2>
          <p className="text-stone-600 leading-7">
            인천/경인과 서울/경기 탭으로 나눠서 실제 검색 결과를 보여드려요.
            가게 정보와 카카오맵 링크, 에디터 한 줄 요약까지 함께 제공합니다.
          </p>
        </Link>

        <Link href="/life/choice" className="menu-card bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:border-orange-200 transition block">
          <p className="text-sm font-semibold text-orange-500 mb-2">픽앤조이 초이스</p>
          <h2 className="text-2xl font-extrabold mb-3">가전·디지털·생활 꿀팁 블로그형 추천</h2>
          <p className="text-stone-600 leading-7">
            기존 블로그 스타일을 그대로 살려서 읽기 쉽게 보여드려요.
            본문 하단에는 쿠팡 파트너스 배너와 안내 문구를 항상 붙여서 제공합니다.
          </p>
        </Link>
      </div>
    </section>
  );
}
