import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-gray-400">공공데이터 활용 가이드라인을 준수하며, 시민들의 정보 접근성을 혁신합니다.</p>
            <p className="text-xs text-gray-300">공공데이터포털 정식 API 활용 · 매일 자동 업데이트 · AI 기반 맞춤형 큐레이션</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white transition-colors">개인정보 처리방침</Link>
            <span aria-hidden="true">|</span>
            <Link href="/about" className="hover:text-white transition-colors">사이트 소개</Link>
            <span aria-hidden="true">|</span>
            <p>© 2026 픽앤조이. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
