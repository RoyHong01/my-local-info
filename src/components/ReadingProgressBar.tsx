'use client';

import { useEffect, useState } from 'react';

/**
 * 읽기 진행률 바
 * - 모든 포스팅 상세 페이지 공통 적용
 * - 브랜드 Point Orange(orange-500) 색상
 * - 헤더(h-16 모바일 / h-20 데스크톱) 바로 아래 fixed 고정
 * - 데스크톱 + 모바일 공통 표시
 */
export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min(100, Math.round((scrollTop / docHeight) * 100));
      setProgress(pct);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="fixed top-16 md:top-20 left-0 right-0 z-30 h-[3px] bg-stone-200/60"
      aria-hidden="true"
    >
      <div
        className="h-full bg-orange-500 transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
