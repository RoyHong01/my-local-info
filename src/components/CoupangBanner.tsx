// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
// same-origin iframe 방식: public/coupang-sidebar.html에서 g.js 실행
// 외부 URL iframe은 쿠팡 서버의 X-Frame-Options로 차단되므로 이 방식 사용

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
        src="/coupang-sidebar.html"
        width={240}
        height={600}
        frameBorder={0}
        scrolling="no"
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
