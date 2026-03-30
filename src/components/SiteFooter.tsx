import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>데이터 분석 기반 프리미엄 라이프스타일 큐레이션</span>
            <span className="text-gray-600">|</span>
            <Link href="/about" className="hover:text-orange-400 transition-colors">소개</Link>
          </div>
          <p className="text-sm text-gray-400">© 2026 픽앤조이. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
