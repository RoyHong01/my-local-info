// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
// 공식 iframe 방식 사용 / 블로그 글 하단 전용

export default function CoupangBottomBanner({ bannerId }: { bannerId?: string }) {
  return (
    <div style={{
      margin: '40px auto',
      textAlign: 'center',
      width: '100%',
      maxWidth: '680px',
    }}>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>
        🛒 쿠팡 추천 상품
      </div>
      <iframe
        src="https://ads-partners.coupang.com/widgets.html?id=976089&template=carousel&trackingCode=AF5831775&subId=&width=680&height=300&tsource="
        width={680}
        height={300}
        frameBorder={0}
        scrolling="no"
        referrerPolicy="unsafe-url"
        style={{
          display: 'block',
          borderRadius: '12px',
          border: '1px solid #f3f4f6',
          margin: '0 auto',
          maxWidth: '100%',
        }}
        title="쿠팡 추천 상품"
      />
    </div>
  );
}
