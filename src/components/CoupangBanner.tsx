// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
// 공식 iframe 방식 사용 (output: "export" 환경에서 가장 안정적)

export default function CoupangBanner({ bannerId }: { bannerId?: string }) {
  return (
    <div>
      <div style={{
        fontSize: '10px',
        color: '#9ca3af',
        textAlign: 'center',
        marginBottom: '6px',
      }}>
        🛒 쿠팡 추천 상품
      </div>
      <iframe
        src="https://ads-partners.coupang.com/widgets.html?id=976088&template=carousel&trackingCode=AF5831775&subId=&width=240&height=600&tsource="
        width={240}
        height={600}
        frameBorder={0}
        scrolling="no"
        referrerPolicy="unsafe-url"
        style={{
          display: 'block',
          borderRadius: '8px',
          border: '1px solid #f3f4f6',
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
