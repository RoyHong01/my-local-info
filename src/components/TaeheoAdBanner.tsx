import Image from 'next/image';

// 추후 Google AdSense 또는 쿠팡 파트너스 배너도 추가 예정
export default function TaeheoAdBanner() {
  return (
    <a
      href="https://www.taeheo.co.kr"
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
      className="hover:opacity-90 transition-opacity"
    >
      <div style={{
        background: 'linear-gradient(135deg, #1a2e4a 0%, #243b5e 50%, #1a2e4a 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(212,175,55,0.3)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        {/* 왼쪽: 도장 로고 */}
        <div style={{
          flexShrink: 0,
          width: '68px',
          height: '68px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid rgba(212,175,55,0.2)',
        }}>
          <Image
            src="/images/taeheo-logo.png"
            alt="태허철학관"
            width={68}
            height={68}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
        {/* 오른쪽: 텍스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(212,175,55,0.12)',
            border: '1px solid rgba(212,175,55,0.35)',
            borderRadius: '20px',
            padding: '2px 8px',
            fontSize: '9px',
            color: '#d4af37',
            marginBottom: '5px',
            letterSpacing: '0.04em',
          }}>
            ✦ 추천 서비스
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#d4af37',
            lineHeight: '1.2',
            marginBottom: '3px',
          }}>
            태허철학관
          </div>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.75)',
            marginBottom: '8px',
          }}>
            사주 · 운세 · 작명 상담
          </div>
          <div style={{
            display: 'inline-block',
            background: '#d4af37',
            color: '#1a2e4a',
            fontSize: '11px',
            fontWeight: '700',
            padding: '5px 14px',
            borderRadius: '20px',
          }}>
            지금 상담받기 →
          </div>
        </div>
      </div>
    </a>
  );
}
