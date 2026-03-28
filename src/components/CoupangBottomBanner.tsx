'use client';
// 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
// 본문 하단 가로형 배너 (680x300)
import Script from 'next/script';

export default function CoupangBottomBanner({ id = 'coupang-bottom' }: { id?: string }) {
  return (
    <div
      style={{
        margin: '40px auto',
        textAlign: 'center',
        width: '100%',
        maxWidth: '680px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: '#9ca3af',
          marginBottom: '8px',
          letterSpacing: '0.03em',
        }}
      >
        🛒 쿠팡 추천 상품
      </div>
      <div
        id={id}
        style={{
          width: '100%',
          maxWidth: '680px',
          minHeight: '300px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#f9fafb',
          border: '1px solid #f3f4f6',
          margin: '0 auto',
        }}
      />
      <Script
        src="https://ads-partners.coupang.com/g.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            // @ts-ignore
            new window.PartnersCoupang.G({
              id: 976089,
              template: 'carousel',
              trackingCode: 'AF5831775',
              width: '680',
              height: '300',
              tsource: '',
              container: id,
            });
          } catch (e) {
            console.warn('Coupang bottom banner error:', e);
          }
        }}
      />
    </div>
  );
}
