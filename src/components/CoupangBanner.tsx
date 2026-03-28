'use client';
// 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
// 사이드바 세로형 배너 (240x600)
import Script from 'next/script';

export default function CoupangBanner({ id = 'coupang-sidebar' }: { id?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: '10px',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '6px',
          letterSpacing: '0.03em',
        }}
      >
        🛒 쿠팡 추천 상품
      </div>
      <div
        id={id}
        style={{
          width: '240px',
          minHeight: '600px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#f9fafb',
          border: '1px solid #f3f4f6',
        }}
      />
      <Script
        src="https://ads-partners.coupang.com/g.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            // @ts-ignore
            new window.PartnersCoupang.G({
              id: 976088,
              template: 'carousel',
              trackingCode: 'AF5831775',
              width: '240',
              height: '600',
              tsource: '',
              container: id,
            });
          } catch (e) {
            console.warn('Coupang banner error:', e);
          }
        }}
      />
      <p
        style={{
          fontSize: '9px',
          color: '#d1d5db',
          textAlign: 'center',
          marginTop: '6px',
          lineHeight: '1.4',
        }}
      >
        쿠팡 파트너스 활동을 통해
        <br />
        수수료를 제공받습니다.
      </p>
    </div>
  );
}
