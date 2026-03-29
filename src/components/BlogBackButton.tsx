'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function BlogBackButton({
  fallbackHref = '/blog',
}: {
  fallbackHref?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = () => {
    const from = searchParams.get('from');
    const returnTo = searchParams.get('returnTo');

    if (from === 'life' && returnTo) {
      router.push(returnTo);
      return;
    }

    const savedCategory = sessionStorage.getItem('blogCategory');
    if (savedCategory) {
      router.push(`/blog?category=${savedCategory}`);
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      onClick={handleBack}
      data-testid="blog-back-button"
      className="text-orange-600 hover:underline mb-8 inline-block"
    >
      &larr; 목록으로 돌아가기
    </button>
  );
}
