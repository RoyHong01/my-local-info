import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보 처리방침 | 픽앤조이',
  description:
    '픽앤조이의 개인정보 처리방침 안내 페이지입니다. 쿠키 사용, Google AdSense 광고 제공 방식, 이용자 선택권 및 문의처를 안내합니다.',
  alternates: { canonical: '/privacy/' },
  openGraph: {
    title: '개인정보 처리방침 | 픽앤조이',
    description:
      '쿠키 사용, Google AdSense 광고 제공 방식, 맞춤형 광고 거부 방법, 수집 정보와 목적을 안내합니다.',
    url: 'https://pick-n-joy.com/privacy/',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-8">
          <header>
            <h1 className="text-4xl font-extrabold mb-3">개인정보 처리방침 (Privacy Policy)</h1>
            <p className="text-stone-600 leading-relaxed">
              픽앤조이(pick-n-joy.com)는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을 준수합니다.
              본 페이지는 서비스 이용 중 처리되는 정보와 광고 제공 과정에서의 쿠키 사용에 대해 안내합니다.
            </p>
          </header>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">1. 수집하는 정보 및 이용 목적</h2>
            <p className="text-stone-600 leading-relaxed mb-3">
              본 사이트는 회원가입 없이 대부분의 콘텐츠를 이용할 수 있습니다. 서비스 운영 과정에서 아래 정보를 수집할 수 있으며,
              사이트 운영·개선 및 통계 분석 목적으로 사용합니다.
            </p>
            <ul className="list-disc pl-6 text-stone-600 leading-relaxed space-y-2">
              <li>방문 기록(접속 일시, 브라우저 정보, 이용 페이지, 리퍼러 등)</li>
              <li>쿠키 및 유사 기술을 통한 이용 패턴 정보</li>
              <li>이메일 등 이용자가 자발적으로 제공한 정보(문의·제보·제휴 요청 시)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">2. 쿠키 사용 및 Google AdSense 안내</h2>
            <p className="text-stone-600 leading-relaxed mb-3">
              본 사이트는 Google AdSense를 포함한 제3자 광고 서비스를 사용할 수 있으며, 광고 제공업체는 쿠키를 이용해
              이용자의 이전 방문 이력을 기반으로 광고를 제공할 수 있습니다.
            </p>
            <ul className="list-disc pl-6 text-stone-600 leading-relaxed space-y-2">
              <li>Google 및 제3자 제공업체는 쿠키를 사용하여 맞춤형 광고를 표시할 수 있습니다.</li>
              <li>Google은 DART 쿠키를 사용하여 본 사이트 및 다른 사이트 방문 기록을 기반으로 광고를 게재할 수 있습니다.</li>
              <li>광고 제공 방식은 Google 정책 변경에 따라 조정될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">3. 맞춤형 광고 거부 방법</h2>
            <p className="text-stone-600 leading-relaxed">
              이용자는 Google 광고 설정 페이지에서 맞춤형 광고를 제한하거나 해제할 수 있습니다.
              자세한 내용은 Google 광고 설정(https://adssettings.google.com/) 및
              www.aboutads.info를 통해 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-3 text-orange-600">4. 문의처</h2>
            <p className="text-stone-600 leading-relaxed">
              개인정보 처리방침 또는 사이트 운영 관련 문의는 아래 이메일로 접수해 주세요.
              <br />
              이메일: <a className="text-orange-500 hover:underline" href="mailto:roysshong@gmail.com">roysshong@gmail.com</a>
              <br />
              사이트 소개 페이지는 <a className="text-orange-500 hover:underline" href="/about">/about</a>에서 확인할 수 있습니다.
              <br />
              본 방침은 서비스 운영 정책 및 관련 법령 변경에 따라 업데이트될 수 있습니다.
            </p>
          </section>

          <p className="text-sm text-stone-500">시행일: 2026년 3월 31일</p>
        </article>
      </main>
    </div>
  );
}
