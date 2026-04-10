import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import PageContentShell from '@/components/PageContentShell';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://pick-n-joy.com"),
  title: "픽앤조이 | 인천·전국 행사·축제·보조금 정보",
  description: "인천 보조금부터 전국 축제까지, 복잡한 공공 데이터를 AI가 분석하여 시민 눈높이로 알려드리는 픽앤조이입니다. 공공데이터포털 정식 API 활용, 매일 자동 업데이트.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "픽앤조이 | 인천·전국 행사·축제·보조금 정보",
    description: "공공데이터 기반 복지 큐레이션과 데이터 분석 기반 라이프스타일 큐레이션으로 시민 체감형 생활정보를 전달합니다.",
    url: "https://pick-n-joy.com",
    siteName: "픽앤조이",
    type: "website",
    images: [{ url: "https://pick-n-joy.com/images/default-og.svg", width: 1200, height: 630, alt: "픽앤조이" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "픽앤조이",
    alternateName: "Pick-n-Joy",
    url: "https://pick-n-joy.com",
    description: "인천 보조금부터 전국 축제까지, 복잡한 공공 데이터를 AI가 분석하여 시민 눈높이로 알려드리는 생활정보 서비스. 공공데이터포털 정식 API 활용, 매일 자동 업데이트.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://pick-n-joy.com/blog?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "픽앤조이",
    url: "https://pick-n-joy.com",
    logo: "https://pick-n-joy.com/favicon.svg",
    description: "공공데이터포털 정식 API를 활용해 복지·보조금·축제 정보를 AI가 시민 관점으로 재구성하는 공공데이터 기반 생활정보 서비스. 데이터 투명성과 공익적 정보 접근성 개선을 핵심 운영 원칙으로 합니다.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "royshong01@gmail.com",
      contactType: "customer service",
    },
    sameAs: ["https://github.com/RoyHong01/my-local-info"],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "홈",
        item: "https://pick-n-joy.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "블로그",
        item: "https://pick-n-joy.com/blog",
      },
    ],
  };

  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const showAdsense = adsenseId && adsenseId !== '나중에_입력';

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const showGA = gaId && gaId !== '나중에_입력';

  return (
    <html lang="ko">
      <head>
        <meta name="naver-site-verification" content="e64f4446ce00f3d310e0c0fddce06498be24e86a" />
        {/* LCP 최적화: 벚꽃 배경 WebP preload (홈 제외 전 페이지 공통 배경) */}
        <link
          rel="preload"
          href="/images/bg-cherry-blossom.webp"
          as="image"
          type="image/webp"
        />
        {showAdsense && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
          />
        )}
        {showGA && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`,
              }}
            />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <SiteHeader />
        <PageContentShell>{children}</PageContentShell>
        <SiteFooter />
      </body>
    </html>
  );
}
