import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pick-n-joy.com"),
  title: "픽앤조이 | 인천·전국 행사·축제·보조금 정보",
  description: "인천 및 전국의 최신 행사, 축제, 보조금, 여행 정보를 매일 업데이트합니다.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "픽앤조이 | 인천·전국 행사·축제·보조금 정보",
    description: "인천 및 전국의 최신 행사, 축제, 보조금, 여행 정보를 매일 업데이트합니다.",
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
    url: "https://pick-n-joy.com",
    description: "인천 및 전국의 최신 행사, 축제, 보조금, 여행 정보를 매일 업데이트합니다.",
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <SiteHeader />
        <div className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
