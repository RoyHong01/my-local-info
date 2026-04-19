import Image from 'next/image';

type ProductSidebarBannerProps = {
  href: string;
  imageSrc: string;
  alt: string;
  title?: string;
};

export default function ProductSidebarBanner({
  href,
  imageSrc,
  alt,
  title = '추천 상품',
}: ProductSidebarBannerProps) {
  return (
    <div>
      <div className="mb-1.5 text-center text-sm font-bold leading-5 text-stone-500">
        🛒 {title}
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="unsafe-url" title={alt}>
        <Image
          src={imageSrc}
          alt={alt}
          width={240}
          height={480}
          className="mx-auto block h-auto w-[240px] rounded-lg border border-gray-100"
        />
      </a>
      <p className="mt-1.5 text-center text-[9px] leading-[1.4] text-gray-300">
        쿠팡 파트너스 활동을 통해
        <br />
        수수료를 제공받습니다.
      </p>
    </div>
  );
}
