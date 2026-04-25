import type { Metadata } from 'next';

// 레거시 client-side 상세 페이지(/subsidy/view?id=...)는 SSG 라우트(/subsidy/[id]/)로
// 통일되었습니다. 검색엔진에 인덱싱되지 않도록 noindex 처리합니다.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SubsidyViewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
