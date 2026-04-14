'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import CoupangBanner from '@/components/CoupangBanner';
import ProductSidebarBanner from '@/components/ProductSidebarBanner';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';

const CHOICE_PRODUCT = {
  href: 'https://link.coupang.com/a/eekIni',
  imageSrc: 'https://image8.coupangcdn.com/image/affiliate/banner/dfeead4a9e1ae83d77687d2fb051e86b@2x.jpg',
  alt: '뉴트리디데이 프리미엄 루테인 오메가3 골드, 90정, 2개',
};

export default function LifeSidebarAds() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');

  const isChoiceContext = pathname === '/life/choice' || (pathname === '/life' && tab === 'choice');

  return (
    <div className="flex flex-col gap-6">
      <TaeheoAdBanner />
      {isChoiceContext ? (
        <ProductSidebarBanner
          href={CHOICE_PRODUCT.href}
          imageSrc={CHOICE_PRODUCT.imageSrc}
          alt={CHOICE_PRODUCT.alt}
          title="픽앤조이 초이스"
        />
      ) : (
        <CoupangBanner bannerId="coupang-sidebar-life" />
      )}
    </div>
  );
}
