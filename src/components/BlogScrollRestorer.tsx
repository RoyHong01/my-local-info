'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __blogEnsureVisible?: (indexOrCount: number) => void;
  }
}

export default function BlogScrollRestorer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const savedCategory = sessionStorage.getItem('blogCategory');
    const savedScrollY = sessionStorage.getItem('blogScrollY');
    const savedVisibleCount = sessionStorage.getItem('blogVisibleCount');
    const currentCategory = searchParams.get('category');

    // URL에 카테고리 없는데 저장된 카테고리 있으면 → URL 복원 후 재마운트에서 스크롤 복원
    if (savedCategory && !currentCategory) {
      router.replace(`/blog?category=${savedCategory}`);
      return;
    }

    const parsedVisibleCount = Number(savedVisibleCount || 0);
    if (Number.isFinite(parsedVisibleCount) && parsedVisibleCount > 0) {
      sessionStorage.setItem('blogPendingVisibleCount', String(parsedVisibleCount));
      window.dispatchEvent(new CustomEvent('blog:ensure-visible', {
        detail: { count: parsedVisibleCount },
      }));
    }

    if (savedScrollY) {
      const y = parseInt(savedScrollY, 10);
      if (!isNaN(y)) {
        setTimeout(() => window.scrollTo(0, y), 80);
      }
    }

    sessionStorage.removeItem('blogCategory');
    sessionStorage.removeItem('blogScrollY');
    sessionStorage.removeItem('blogVisibleCount');

    // Intentionally run once on mount to restore category/scroll state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span aria-hidden="true" className="hidden" data-testid="blog-scroll-restorer" />;
}
