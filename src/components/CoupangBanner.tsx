// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
// 쿠팡 파트너스 제공 iframe URL 직접 사용 (가장 안정적)

'use client';

export default function CoupangBanner({ bannerId }: { bannerId?: string }) {
  void bannerId;

  return (
    <div>
      <div style={{
        fontSize: '10px',
        color: '#4b5563',
        textAlign: 'center',
        marginBottom: '6px',
      }}>
        🛒 쿠팡 추천 상품
      </div>
      <iframe
        src="https://ads-partners.coupang.com/widgets.html?id=976244&template=carousel&trackingCode=AF5831775&subId=&width=240&height=600&tsource="
        width="240"
        height="600"
        frameBorder="0"
        scrolling="no"
        referrerPolicy="unsafe-url"
        loading="eager"
        style={{
          display: 'block',
          borderRadius: '8px',
          border: '1px solid #f3f4f6',
          margin: '0 auto',
          zIndex: 50,
        }}
        title="쿠팡 추천 상품"
      />
      <p style={{
        fontSize: '9px',
        color: '#d1d5db',
        textAlign: 'center',
        marginTop: '6px',
        lineHeight: '1.4',
      }}>
        쿠팡 파트너스 활동을 통해<br />수수료를 제공받습니다.
      </p>
    </div>
  );
}
