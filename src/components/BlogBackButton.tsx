'use client';

import { useRouter } from 'next/navigation';

export default function BlogBackButton() {
  const router = useRouter();

  const handleBack = () => {
    const savedCategory = sessionStorage.getItem('blogCategory');
    if (savedCategory) {
      router.push(`/blog?category=${savedCategory}`);
    } else {
      router.push('/blog');
    }
  };

  return (
    <button
      onClick={handleBack}
      className="text-orange-600 hover:underline mb-8 inline-block"
    >
      &larr; 목록으로 돌아가기
    </button>
  );
}
