'use client';
// 쿠팡 파트너스 활동을 통해 수수료를 제공받습니다.
import { useEffect, useRef } from 'react';

export default function CoupangBottomBanner({ bannerId = 'coupang-bottom' }: { bannerId?: string }) {
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
            new PartnersCoupang.G({
              "id": 976089,
              "template": "carousel",
              "trackingCode": "AF5831775",
              "width": "680",
              "height": "300",
              "tsource": ""
            });
          })();
        `;
        container.appendChild(s);
      } catch (e) {
        console.warn('Coupang bottom error:', e);
      }
    };

    if (window.PartnersCoupang) { initBanner(); return; }

    const existing = document.querySelector('script[src="https://ads-partners.coupang.com/g.js"]');
    if (existing) { setTimeout(initBanner, 500); return; }

    const script = document.createElement('script');
    script.src = 'https://ads-partners.coupang.com/g.js';
    script.async = true;
    script.onload = initBanner;
    document.head.appendChild(script);
  }, [bannerId]);

  return (
    <div style={{ margin: '40px auto', textAlign: 'center', width: '100%', maxWidth: '680px' }}>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px' }}>
        🛒 쿠팡 추천 상품
      </div>
      <div
        id={bannerId}
        ref={containerRef}
        style={{
          width: '100%', maxWidth: '680px', minHeight: '300px',
          borderRadius: '12px', overflow: 'hidden',
          background: '#f9fafb', border: '1px solid #f3f4f6', margin: '0 auto',
        }}
      />
    </div>
  );
}
