'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BlogScrollRestorer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const savedCategory = sessionStorage.getItem('blogCategory');
    const savedScrollY = sessionStorage.getItem('blogScrollY');
    const currentCategory = searchParams.get('category');

    // URL에 카테고리 없는데 저장된 카테고리 있으면 → URL 복원 후 재마운트에서 스크롤 복원
    if (savedCategory && !currentCategory) {
      sessionStorage.removeItem('blogCategory');
      // blogScrollY는 유지 → 리디렉션 후 다시 마운트될 때 복원
      router.replace(`/blog?category=${savedCategory}`);
      return;
    }

    sessionStorage.removeItem('blogCategory');
    sessionStorage.removeItem('blogScrollY');

    if (savedScrollY) {
      const y = parseInt(savedScrollY, 10);
      if (!isNaN(y)) {
        setTimeout(() => window.scrollTo(0, y), 50);
      }
    }
    // Intentionally run once on mount to restore category/scroll state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
