'use client';

import { useEffect } from 'react';

export default function AdBanner() {
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    if (adsenseId && adsenseId !== '나중에_입력') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        // ignore
      }
    }
  }, [adsenseId]);

  if (!adsenseId || adsenseId === '나중에_입력') {
    return null;
  }

  return (
    <div className="my-8 flex justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adsenseId}
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
