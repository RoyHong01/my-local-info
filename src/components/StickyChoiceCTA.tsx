'use client';

import { useEffect, useState } from 'react';

interface StickyChoiceCTAProps {
  href: string;
  label?: string;
}

/**
 * 픽앤조이 초이스 상세 페이지 - 모바일 전용 하단 고정 CTA 버튼
 * - md 이상(태블릿/데스크톱)에서는 숨김
 * - 스크롤이 200px 이상 내려가면 나타남
 * - 쿠팡 파트너스 최저가 확인 버튼
 */
export default function StickyChoiceCTA({ href, label = '쿠팡에서 최저가 확인하기 🛒' }: StickyChoiceCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 200);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!href) return null;

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'transition-transform duration-300 ease-in-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      {/* 배경 블러 컨테이너 */}
      <div className="bg-white/90 backdrop-blur-sm border-t border-orange-100 px-4 py-3 pb-safe">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block w-full text-center bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-base rounded-xl py-3.5 shadow-lg transition-colors duration-150"
        >
          {label}
        </a>
        <p className="text-center text-[10px] text-stone-400 mt-1.5">
          이 링크는 쿠팡 파트너스 제휴 링크로, 구매 시 소정의 수수료가 발생합니다.
        </p>
      </div>
    </div>
  );
}
