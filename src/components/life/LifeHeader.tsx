import Link from 'next/link';

export default function LifeHeader() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
        <nav>
          <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
            <li><Link href="/incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
            <li><Link href="/subsidy" className="hover:text-amber-600 transition">전국 보조금·복지 정책</Link></li>
            <li><Link href="/festival" className="hover:text-rose-600 transition">전국 축제·여행 정보</Link></li>
            <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
            <li><Link href="/life" className="text-orange-500 font-bold">일상의 즐거움</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
