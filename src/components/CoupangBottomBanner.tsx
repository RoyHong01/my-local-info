'use client';
// 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
// 본문 하단 가로형 배너 (680x300) - 반응형

import { useEffect, useRef } from 'react';

export default function CoupangBottomBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    const libScript = document.createElement('script');
    libScript.src = 'https://ads-partners.coupang.com/g.js';
    libScript.async = true;

    libScript.onload = () => {
      const initScript = document.createElement('script');
      initScript.innerHTML = `
        try {
          new PartnersCoupang.G({
            "id": 976089,
            "template": "carousel",
            "trackingCode": "AF5831775",
            "width": "680",
            "height": "300",
            "tsource": ""
          });
        } catch(e) { console.warn('Coupang bottom banner init failed', e); }
      `;
      if (containerRef.current) {
        containerRef.current.appendChild(initScript);
      }
    };

    containerRef.current.appendChild(libScript);
  }, []);

  return (
    <div style={{
      margin: '40px auto',
      textAlign: 'center',
      width: '100%',
      maxWidth: '680px',
      overflow: 'hidden',
    }}>
      <div style={{
        fontSize: '10px',
        color: '#9ca3af',
        marginBottom: '8px',
        letterSpacing: '0.03em',
      }}>
        🛒 쿠팡 추천 상품
      </div>
      <div
        ref={containerRef}
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
    </div>
  );
}
