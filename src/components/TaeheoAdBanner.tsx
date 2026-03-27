// 추후 Google AdSense 또는 쿠팡 파트너스 배너도 추가 예정

export default function TaeheoAdBanner() {
  return (
    <a
      href="https://www.taeheo.co.kr"
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5282 60%, #1a3a5c 100%)',
        padding: '20px 16px',
        textAlign: 'center',
        border: '1px solid #2d5282',
        borderRadius: '12px',
      }}>
        {/* 상단 뱃지 */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(212,175,55,0.15)',
          border: '1px solid rgba(212,175,55,0.4)',
          borderRadius: '20px',
          padding: '3px 10px',
          fontSize: '10px',
          color: '#d4af37',
          marginBottom: '10px',
          letterSpacing: '0.05em',
        }}>
          ✦ 추천 서비스
        </div>
        {/* 메인 타이틀 */}
        <div style={{
          fontSize: '17px',
          fontWeight: '700',
          color: '#d4af37',
          marginBottom: '6px',
          lineHeight: '1.3',
        }}>
          태허철학관
        </div>
        {/* 서브타이틀 */}
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.85)',
          marginBottom: '4px',
        }}>
          사주 · 운세 · 작명 상담
        </div>
        <div style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.55)',
          marginBottom: '14px',
        }}>
          당신의 인생 흐름을 읽어드립니다
        </div>
        {/* CTA 버튼 */}
        <div style={{
          background: '#d4af37',
          color: '#1e3a5f',
          fontSize: '12px',
          fontWeight: '700',
          padding: '7px 20px',
          borderRadius: '20px',
          display: 'inline-block',
        }}>
          지금 상담받기 →
        </div>
      </div>
    </a>
  );
}
