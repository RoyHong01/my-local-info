'use client';
// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    PartnersCoupang: any;
  }
}

export default function CoupangBanner({ bannerId = 'coupang-sidebar' }: { bannerId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    const container = containerRef.current;

    const initBanner = () => {
      if (!window.PartnersCoupang) return;
      try {
        const s = document.createElement('script');
        s.textContent = `
          (function() {
            var el = document.getElementById('${bannerId}');
            if (!el) return;
            new PartnersCoupang.G({
              "id": 976088,
              "template": "carousel",
              "trackingCode": "AF5831775",
              "width": "240",
              "height": "600",
              "tsource": ""
            });
          })();
        `;
        container.appendChild(s);
      } catch (e) {
        console.warn('Coupang init error:', e);
      }
    };

    // g.js가 이미 로드됐으면 바로 실행
    if (window.PartnersCoupang) {
      initBanner();
      return;
    }

    // g.js 로드
    const existing = document.querySelector('script[src="https://ads-partners.coupang.com/g.js"]');
    if (existing) {
      // 이미 로드 중이면 잠시 후 시도
      setTimeout(initBanner, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://ads-partners.coupang.com/g.js';
    script.async = true;
    script.onload = initBanner;
    document.head.appendChild(script);
  }, [bannerId]);

  return (
    <div>
      <div style={{
        fontSize: '10px', color: '#9ca3af',
        textAlign: 'center', marginBottom: '6px',
      }}>
        🛒 쿠팡 추천 상품
      </div>
      <div
        id={bannerId}
        ref={containerRef}
        style={{
          width: '240px',
          minHeight: '600px',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#f9fafb',
          border: '1px solid #f3f4f6',
        }}
      />
      <p style={{
        fontSize: '9px', color: '#d1d5db',
        textAlign: 'center', marginTop: '6px', lineHeight: '1.4',
      }}>
        쿠팡 파트너스 활동을 통해<br />수수료를 제공받습니다.
      </p>
    </div>
  );
}
