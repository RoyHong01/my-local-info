import Link from 'next/link';
import Image from 'next/image';

export default function SiteHeader() {
  return (
    <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-purple-700 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center ml-10">
            <Image src="/images/logo-pick-n-joy.png" alt="픽앤조이" width={180} height={60} className="h-14 w-auto drop-shadow-md" priority />
          </Link>
          <nav className="hidden lg:flex items-center gap-1 mr-10">
            {[
              { label: '인천시 정보', href: '/incheon' },
              { label: '전국 보조금·복지 정책', href: '/subsidy' },
              { label: '전국 축제·여행 정보', href: '/festival' },
              { label: '블로그', href: '/blog' },
              { label: '일상의 즐거움', href: '/life' },
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-base font-medium rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
