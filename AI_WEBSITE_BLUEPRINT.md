# AI 협업 무인 자동화 수익형 웹사이트 구축 범용 매뉴얼

> **사용법**: 새 프로젝트 시작 시 AI에게 이 파일을 전달하고 다음 프롬프트를 사용한다.
> "이 매뉴얼을 기반으로 [XXXX 프로젝트]의 플랜, 폴더 구조, 진행 순서 및 단계별 계획을 세워라."
>
> **작성 기준**: 픽앤조이(pick-n-joy.com) 프로젝트 실전 경험 기반 (2026-04-20)
> **대상 독자**: 이 문서를 읽는 AI 또는 개발 작업자

---

## 목차

- [Part A] 범용 원칙 — 어떤 프로젝트에나 적용
- [Part B] 프로젝트 부트스트랩 — Day 1 실행 순서
- [Part C] 아키텍처 결정 가이드 — 언제 무엇을 선택하나
- [Part D] 실행 템플릿 — 복사해서 바로 쓰는 코드/설정
- [Part E] AI 프롬프트 원문 — 실제로 동작하는 프롬프트
- [Part F] 수익화 장치 구현 — 광고/제휴 수익 최적화
- [Part G] 자동화 파이프라인 — GitHub Actions 운영
- [Part H] SEO 완전 체크리스트
- [Part I] 품질 관리 & 트러블슈팅 레퍼런스
- [Part J] 픽앤조이 케이스 스터디 — 실전 예시 레퍼런스

---

## [Part A] 범용 원칙

### A-1. 프로젝트 성공의 3대 전제조건

**전제 1: 수익 모델을 먼저 확정한다**

개발 시작 전 반드시 결정해야 할 것:
- 1차 수익: 무엇으로 돈을 버는가? (쿠팡 파트너스 / Google AdSense / 직접 판매)
- 2차 수익: 트래픽이 쌓이면 어떻게 전환하는가?
- 수익 발생 최소 조건: 예) AdSense = 블로그 15편 이상, 쿠팡 파트너스 = 즉시 적용 가능

**전제 2: 타겟 페르소나를 3개 이하로 좁힌다**

페르소나를 좁힐수록 AI가 생성하는 콘텐츠의 톤앤매너가 일관된다.
- 예: "2030 육아맘 + 주말 여행러 + 스마트 소비자" (픽앤조이 기준)
- 페르소나가 결정되면 → 컬러, 문체, 키워드, 카테고리가 자동으로 따라온다

**전제 3: 비용 0원 방어선을 미리 설계한다**

- Cloudflare Pages 무료 플랜: 파일 20,000개 한도 → SSG 페이지 수 계획 필수
- Google Places API: 결제 한도 알림 15,000원 설정 필수
- Supabase 무료 플랜: 500MB 한도 → 수집 데이터 규모 미리 계산

### A-2. 브랜드 아이덴티티 설계 원칙

카테고리별 컬러 코딩은 사용자가 무의식적으로 현재 위치를 인지하게 만든다.
심리적 신뢰도가 높아지면 광고 클릭 거부감이 낮아진다.

```
카테고리 컬러 선택 기준:
- 정보/공공 계열  → Deep Blue   (신뢰, 전문성)
- 경제/혜택 계열  → Amber/Gold  (활기, 이익)
- 여행/문화 계열  → Rose/Coral  (설렘, 즐거움)
- 라이프스타일    → Green/Teal  (건강, 여유)
- 커머스/제품     → Orange      (행동, 클릭 유도)
```

Tailwind CSS 컬러 조합 패턴:
```
bg-[color]-50  text-[color]-600   ← 카드 배지
bg-[color]-600 text-white         ← 버튼, 강조
border-[color]-200                ← 카드 테두리
```

### A-3. 4단계 무결성 검증 프로세스 (배포 전 필수)

모든 작업 완료 후, 배포 전에 아래 4단계를 순서대로 실행한다.
이 중 하나라도 실패하면 배포하지 않는다.

```bash
# 1. 정적 코드 분석 (0 errors, 0 warnings 필수)
npm run lint

# 2. 빌드 무결성 (전체 페이지 정상 렌더링 확인)
npm run build

# 3. E2E 통합 테스트 (핵심 UX 흐름 검증)
npm run test:e2e

# 4. 데이터 무결성 (API 데이터 구조 검증)
npm run verify:data
```

> **Tip**: 콘텐츠 자동 생성 프로젝트는 `build` 스크립트 자체에 품질 게이트를 체이닝한다.
> 예: `"build": "npm run check:choice-quality && npm run test:choice-single-pick && next build"`
> 자세한 패턴은 [Part K-4] 참조. `verify:data` 스크립트 본문은 [Part K-5] 참조.

### A-4. ESLint 이중 관리 원칙

Next.js 앱 코어(`src/`)와 자동화 스크립트(`scripts/`)는 JavaScript 환경이 다르다.
같은 규칙을 적용하면 `scripts/`의 CommonJS require()가 ESLint 경고를 쏟아낸다.

**원칙: src는 엄격하게, scripts는 완화하게**

→ [Part D-5]의 eslint.config.mjs 템플릿 참조

### A-5. 콘텐츠 만료 처리 원칙

만료된 콘텐츠는 삭제하지 않는다. SEO 점수(도메인 authority)가 손실되기 때문이다.

```
처리 방법:
1. frontmatter에 expired: true 마킹
2. 목록 페이지에서 expired 항목 필터링 (안 보이게)
3. 상세 페이지에서 "종료된 이벤트" 배너 표시
4. sitemap.xml에서는 제거 (크롤링 낭비 방지)
```

### A-6. 단일 호흡 배포 원칙 (Single-Breath Deploy)

**한 작업 단위는 반드시 하나의 호흡(= 단일 commit + 단일 push)으로 끝낸다.**

이 원칙은 [A-3] 4단계 무결성 검증 통과 직후 적용되는 배포 규칙이며,
프로젝트 초기에 반드시 `.github/copilot-instructions.md`(또는 `AGENTS.md`)에 못박아야
시간이 흐르면서 무너지지 않는다.

**고정 7단계 종료 루틴 (순서 절대 불변)**

```
1. 코드 수정
2. npm run build 성공 (= [A-3] 4단계 검증)
3. 문서/메모리 동기화 (WORK_LOG.md, copilot-instructions.md, 메모리 파일)
4. git add (코드 + 문서를 한 번에)
5. 단일 commit  (예: "fix(xxx): ... + docs sync")
6. 단일 push
7. CI 결과 확인
```

**왜 이 순서가 중요한가 (실전에서 무너지는 패턴)**

- 흔한 실패 패턴: `코드 commit → push → 문서 sync commit → push` (총 push 2회)
- GitHub Actions는 동일 워크플로우의 동일 ref에 대해 `concurrency` 그룹으로
  **이전 in-progress run을 자동 취소**한다.
  - 취소 메시지: `Canceling since a higher priority waiting request for ... exists`
  - 결과: CI 히스토리에 ⚠️ (auto-cancel) 가 누적되고, 빌드 시간이 낭비된다.
- 따라서 "build → 문서 동기화 → commit → push" 순서로 고정해야
  **구조적으로 단일 push만 가능**해진다.

**자주 발생하는 회귀 원인**

규칙 7번이 `build → commit/push → 문서 동기화` 순서로 적혀 있으면, AI/사람 모두
자연스럽게 "코드 push 1회 → 문서 push 1회" 2회 푸시 패턴으로 흘러간다.
규칙 문구 자체에서 **문서 동기화를 commit 이전에 명시**해야 단일 호흡이 강제된다.

**예외 (유일하게 허용되는 분리 push)**

- 코드 push 후 CI에서 별도 이슈가 발견되어 추가 패치가 필요한 경우
- 이 경우에도 신규 패치는 다시 단일 호흡(코드 + 문서 sync)으로 묶는다

**AI 협업 시 강제 규칙**

- AI는 사용자에게 별도 확인 질문 없이 자동으로 코드와 문서 sync를 단일 커밋으로 묶는다
- "코드만 먼저 push 할까요?" 같은 분리 제안 자체를 금지한다
- 작업 완료 보고는 7단계 모두 끝난 시점에서만 한다

**CI 실패 아이콘 트리아지 룰 (이 원칙이 있으면 자동 적용된다)**

- ❌ 메시지가 `Canceling since a higher priority...` → **무시** (자동 취소, 단일 호흡 위반의 흔적)
- ❌ 메시지가 `Process completed with exit code 1` / `Module not found` / `npm ERR!` → **실제 실패, 즉시 재패치**
- ⚠️ `continue-on-error` 단계 실패 → 이후 커밋이 고쳤는지 확인 후 처리

---

## [Part B] 프로젝트 부트스트랩

### B-1. Day 0: 인프라 세팅 체크리스트

아래 항목을 모두 완료한 후 코드 작업을 시작한다.

**도메인 & 보안**
- [ ] 도메인 구매 (Cloudflare Registrar 또는 외부 후 Cloudflare 연결)
- [ ] Cloudflare DNS 설정 완료
- [ ] www → non-www 301 리다이렉트 설정 (Page Rules)
  - `www.example.com/*` → `https://example.com/$1` (301 Permanent Redirect)
- [ ] 관리자 페이지 보호: Cloudflare Zero Trust Access → 이메일 OTP 설정
  - 대상 경로: `/admin/*`
- [ ] HTTPS 강제 활성화

**API 키 발급 (프로젝트에 맞게 선택)**
- [ ] 한국관광공사 TourAPI (축제/여행 데이터)
- [ ] 공공데이터포털 (보조금, 지역 정보)
- [ ] 카카오 로컬 API
  - 주의: 카카오 디벨로퍼스에서 실제 도메인 + `http://localhost:3000` 모두 등록
- [ ] Google Places API (New) → 결제 수단 등록 + 한도 알림 15,000원 설정
- [ ] Gemini API (콘텐츠 생성용)
- [ ] Anthropic Claude API (데이터 요약/설명 생성용)
- [ ] 쿠팡 파트너스 가입 → 파트너ID 발급

**계정 생성**
- [ ] GitHub 저장소 생성 (public 또는 private)
- [ ] Cloudflare Pages 프로젝트 생성 → GitHub 연결
- [ ] Supabase 프로젝트 생성 (동적 데이터 필요 시)
- [ ] Google Search Console 속성 추가 (도메인 소유 인증)
- [ ] Google Analytics 속성 생성 → GA4 Measurement ID 확보

### B-2. Day 1: 프로젝트 초기화 명령어 시퀀스

```bash
# 1. Next.js 프로젝트 생성
npx create-next-app@latest my-project --typescript --tailwind --app --src-dir --import-alias "@/*"

cd my-project

# 2. 필수 패키지 설치
npm install gray-matter remark remark-html react-markdown
npm install --save-dev @playwright/test

# 3. 개발 의존성 (필요 시)
npm install @supabase/supabase-js

# 4. 환경변수 파일 생성
cp .env.example .env.local   # 또는 직접 생성

# 5. .gitignore에 민감 파일 확인
echo ".env.local" >> .gitignore
echo ".env" >> .gitignore

# 6. 첫 커밋
git add .
git commit -m "init: Next.js project with TypeScript + Tailwind"
git push origin main
```

### B-3. .env.local 표준 템플릿

```bash
# AI API
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# 공공 데이터
PUBLIC_DATA_API_KEY=...
TOUR_API_KEY=...

# 카카오
KAKAO_API_KEY=...
KAKAO_REST_API_KEY=...

# 수익화
NEXT_PUBLIC_COUPANG_PARTNER_ID=AF...
NEXT_PUBLIC_ADSENSE_ID=ca-pub-...

# 분석
NEXT_PUBLIC_GA_ID=G-...

# DB (필요 시)
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버 사이드 전용, NEXT_PUBLIC 금지

# 알림 (선택)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

### B-4. GitHub Actions Secrets 등록 목록

GitHub 저장소 → Settings → Secrets and variables → Actions에서 등록:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PUBLIC_DATA_API_KEY
TOUR_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
KAKAO_REST_API_KEY
TELEGRAM_BOT_TOKEN       (선택)
TELEGRAM_CHAT_ID         (선택)
SUPABASE_SERVICE_ROLE_KEY (선택)
```

### B-5. next.config.ts 기본 설정

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",           // 정적 HTML 내보내기 (Cloudflare Pages용)
  trailingSlash: true,        // /page/ 형식 URL (SEO 일관성)
  images: {
    unoptimized: true,        // output: export 시 필수
    remotePatterns: [
      // 허용할 외부 이미지 도메인 추가
      { protocol: "https", hostname: "tong.visitkorea.or.kr" },
    ],
  },
};

export default nextConfig;
```

---

## [Part C] 아키텍처 결정 가이드

### C-1. SSG vs CSR 선택 기준

```
질문 1: 이 데이터가 구글 검색에 노출되어야 하는가?
  YES → SSG (정적 빌드)
  NO  → CSR (클라이언트 렌더링)

질문 2: 데이터 항목이 총 몇 개인가?
  < 3,000개  → 전부 SSG 가능
  > 3,000개  → 핵심 Top N만 SSG, 나머지는 CSR

질문 3: Cloudflare Pages 무료 플랜을 쓰는가?
  YES → SSG 페이지 총합 < 18,000개 유지 (여유 버퍼 포함)
  NO  → 제한 없음
```

**하이브리드 패턴 (권장)**

```
SSG: 목록 페이지 + 상위 N개 상세 페이지 → SEO 확보
CSR: /view?id=... 단일 공용 뷰 페이지 → 나머지 데이터 처리

예시:
- /festival/          ← SSG (목록)
- /festival/[id]/     ← SSG (상위 100개만)
- /view?id=fest_0101  ← CSR (Supabase 실시간 조회)
```

### C-2. 데이터 저장 전략

```
JSON 파일 (public/data/*.json)
  ✓ 데이터가 < 10,000건
  ✓ 하루 1회 이하 업데이트
  ✓ 정적 배포 환경
  ✗ 실시간 조회/검색 필요 시

Supabase DB
  ✓ 데이터 > 10,000건
  ✓ 실시간 업데이트 필요
  ✓ 사용자별 맞춤 데이터 (즐겨찾기 등)
  ✓ API 응답 캐싱 필요

혼용 (권장)
  JSON: 배치 수집 후 정적 스냅샷 저장
  Supabase: 평점/캐시 등 동적 보조 데이터만
```

### C-3. 콘텐츠 생성 파이프라인 선택

```
수동 생성:   초기 테스트용 / 특수 포스팅
반자동:      작업자가 데이터를 넣으면 AI가 초안 생성
완전자동:    GitHub Actions cron → 데이터 수집 → AI 생성 → 커밋 → 배포
```

완전자동 기준 일일 생성량 설정:
```
카테고리당 1~2편이 적정 (구글 스팸 필터 회피)
예: 인천 1편 + 보조금 2편 + 축제 1편 = 하루 4편
주 28편 = 월 ~120편 누적
```

---

## [Part D] 실행 템플릿

### D-1. 민낯 page.tsx 템플릿 (카테고리 목록 페이지)

새 카테고리 추가 시 이 템플릿을 복사해서 시작한다.
불필요한 import가 없는 "민낯 상태"가 기준이다.

```typescript
// src/app/[category]/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "카테고리명 | 사이트명",
  description: "카테고리 설명 (150자 이내)",
  openGraph: {
    title: "카테고리명 | 사이트명",
    description: "카테고리 설명",
    url: "https://example.com/category/",
    type: "website",
  },
  alternates: {
    canonical: "https://example.com/category/",
  },
};

// 데이터 로드
async function getData() {
  // JSON 파일 또는 Supabase에서 데이터 로드
  return [];
}

export default async function CategoryPage() {
  const data = await getData();
  const activeData = data.filter((item) => !item.expired);

  return (
    <main className="max-w-6xl mx-auto px-4 pt-12 pb-16">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">카테고리명</h1>
      {/* 카드 리스트 컴포넌트 */}
    </main>
  );
}
```

### D-2. 민낯 [id]/page.tsx 템플릿 (상세 페이지)

```typescript
// src/app/[category]/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // id로 데이터 조회
  const item = await getItemById(id);
  if (!item) return { title: "Not Found" };

  return {
    title: `${item.title} | 사이트명`,
    description: item.description?.slice(0, 150),
    openGraph: {
      title: item.title,
      description: item.description?.slice(0, 150),
      images: item.image ? [{ url: item.image }] : [],
    },
    alternates: {
      canonical: `https://example.com/category/${id}/`,
    },
  };
}

export async function generateStaticParams() {
  const allItems = await getAllItems();
  // Top N만 SSG, 나머지는 CSR fallback
  return allItems.slice(0, 500).map((item) => ({ id: item.id }));
}

export default async function DetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) notFound();

  return (
    <main>
      {/* 상세 내용 */}
    </main>
  );
}

async function getItemById(id: string) {
  // 구현
  return null;
}

async function getAllItems() {
  // 구현
  return [];
}
```

### D-3. ReadingProgressBar 컴포넌트

모든 상세 페이지에 삽입. 네비게이션 바 바로 아래 고정.

```typescript
// src/components/ReadingProgressBar.tsx
"use client";

import { useEffect, useState } from "react";

export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, percent)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="fixed top-16 md:top-20 left-0 z-30 h-[3px] bg-orange-500 transition-all duration-100"
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}
```

사용 위치 (레이아웃 또는 각 상세 페이지):
```typescript
// 헤더 컴포넌트 바로 아래에 삽입
<Header />
<ReadingProgressBar />
<main>...</main>
```

### D-4. StickyBottomCTA 컴포넌트

모바일 전용. 특정 카테고리(쿠팡 제휴 등) 상세 페이지에만 적용.

```typescript
// src/components/StickyBottomCTA.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  link: string;
  label?: string;
}

export default function StickyBottomCTA({
  link,
  label = "최저가 확인하기 🛒",
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center py-3 px-4 font-semibold text-sm"
      >
        {label}
      </a>
    </div>
  );
}
```

### D-5. eslint.config.mjs (이중 관리 설정)

```javascript
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // scripts 폴더: CommonJS 환경이므로 완화 적용
  {
    files: ["scripts/**/*.js", "scripts/**/*.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-unused-vars": "warn",           // error → warn으로 완화
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },

  // workers 폴더: anonymous export 허용
  {
    files: ["workers/**/*.js"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
```

### D-6. GitHub Actions deploy.yml 뼈대

```yaml
# .github/workflows/deploy.yml
name: Daily Auto Deploy

on:
  push:
    branches: [main]
  schedule:
    - cron: "0 19 * * *"   # 매일 04:00 KST (UTC 19:00)
  workflow_dispatch:         # 수동 실행 허용

# 동시 실행 제어 — 단일 호흡 배포(A-6) 위반 시 이전 run을 자동 취소한다.
# 단, A-6 원칙을 지키면 이 섹션은 거의 발동되지 않는다.
concurrency:
  group: daily-deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: write   # 자동 커밋용 (auto: daily content update)

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      # ── 1단계: 데이터 수집 ──────────────────────────────
      - name: [1단계] 데이터 수집
        env:
          PUBLIC_DATA_API_KEY: ${{ secrets.PUBLIC_DATA_API_KEY }}
          TOUR_API_KEY: ${{ secrets.TOUR_API_KEY }}
        run: |
          node scripts/collect-data.js
        continue-on-error: false   # 수집 실패 시 중단

      # ── 2단계: 콘텐츠 생성 ──────────────────────────────
      - name: [2단계] AI 블로그 생성
        id: generate_blog
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          node scripts/generate-blog-post.js
        continue-on-error: true    # 생성 실패해도 배포는 진행

      # ── 3단계: 수익형 콘텐츠 생성 (선택) ────────────────
      - name: [3단계] 제휴 포스트 생성
        id: generate_choice
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          node scripts/generate-choice-posts-auto.js
        continue-on-error: true    # 실패해도 다음 단계 진행

      # ── 커밋: 생성된 콘텐츠 저장 ──────────────────────
      - name: 변경사항 커밋 & 푸시
        run: |
          git config --global user.name "GitHub Actions Bot"
          git config --global user.email "actions@github.com"
          git add .
          git diff --staged --quiet || git commit -m "auto: daily content update $(date +'%Y-%m-%d')"
          git push

      # ── 4단계: 빌드 & 배포 ──────────────────────────────
      - name: [4단계] 빌드
        run: npm run build

      - name: [4단계] Cloudflare Pages 배포
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy out --project-name=my-project

      # ── 5단계: 알림 ──────────────────────────────────
      - name: [5단계] 텔레그램 알림
        if: always()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: node scripts/notify-telegram.mjs
```

### D-7. 기본 폴더 구조 (복사용)

```
my-project/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 루트 레이아웃 (네비, 푸터, GA)
│   │   ├── page.tsx             # 메인 홈
│   │   ├── globals.css          # 전역 스타일
│   │   ├── robots.txt/          # robots.txt (route.ts)
│   │   ├── sitemap.xml/         # sitemap (route.ts 또는 postbuild 스크립트)
│   │   ├── rss.xml/             # RSS 피드 (route.ts)
│   │   ├── [category]/
│   │   │   ├── page.tsx         # 목록 페이지
│   │   │   └── [id]/
│   │   │       └── page.tsx     # 상세 페이지
│   │   └── blog/
│   │       ├── page.tsx         # 블로그 목록
│   │       └── [slug]/
│   │           └── page.tsx     # 블로그 상세
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ReadingProgressBar.tsx
│   │   ├── StickyBottomCTA.tsx
│   │   ├── CoupangSidebarBanner.tsx
│   │   ├── CoupangBottomBanner.tsx
│   │   └── AdBanner.tsx
│   ├── lib/
│   │   ├── posts.ts             # 블로그 마크다운 파싱
│   │   └── [category]-utils.ts  # 카테고리별 데이터 유틸
│   └── content/
│       └── posts/               # 마크다운 블로그 파일들
├── public/
│   ├── data/                    # JSON 데이터 파일들
│   ├── images/                  # OG 이미지, 썸네일
│   ├── robots.txt
│   └── ads.txt                  # AdSense용
├── scripts/
│   ├── lib/                     # 공유 유틸 (api helpers 등)
│   ├── collect-[category].js    # 데이터 수집 스크립트
│   ├── generate-blog-post.js    # 블로그 AI 생성
│   ├── generate-choice-posts-auto.js # 제휴 포스트 자동 생성
│   ├── cleanup-expired.js       # 만료 처리
│   ├── generate-sitemap.js      # sitemap 생성
│   └── notify-telegram.mjs      # 텔레그램 알림
├── e2e/
│   └── basic.spec.ts            # E2E 테스트
├── .github/
│   └── workflows/
│       └── deploy.yml
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── playwright.config.ts
├── .env.local                   # gitignore 대상
├── CLAUDE.md                    # AI 작업 가이드 (이 파일과 함께 관리)
└── WORK_LOG.md                  # 작업 이력
```

---

## [Part E] AI 프롬프트 원문

### E-1. 블로그 포스트 생성 프롬프트 (정보성 글 범용)

```
중요: 모든 응답은 인사말 없이 오직 하나의 마크다운(Markdown) 코드 블록 내에 출력한다.

당신은 [사이트명]의 30대 초반 [카테고리] 전문 에디터입니다.
타겟 독자: [페르소나 설명]

--- 작성 지침 ---

[필수]
- 종결어미: 경어체 (~해요/~거든요/~입니다) 100% 유지, 평어체 절대 금지
- 제목: 연도/완전정복/총정리 금지. 독자의 페인포인트를 담은 스토리텔링형
- 분량: 800~1200자 (모바일 독자 기준)
- 소제목: 숫자형(1. 2. 3.) 금지, 감성적 문장형 소제목 2~4개 사용
- 줄 바꿈: 최대 2~3문장마다 강제 줄 바꿈 적용

[스타일]
- 서론: 독자가 공감할 일상의 장면/감정으로 시작 (정보 나열 금지)
- 본문: 감각적 묘사 → 정보 → 실용적 팁 순서
- 결말: "함께 가면 좋은 사람 추천" 공식 문구 금지, 작가 주관적 한 줄 평으로 끝내기

[금지어]
결론적으로 / 다양한 / 인상적인 / 포착한 / 대명사가 됐다 / 추천합니다 (단독 사용)

[frontmatter 형식]
---
title: "제목"
date: "YYYY-MM-DD"
slug: "영문-slug"
description: "검색 노출용 설명 150자 이내"
category: "[카테고리명]"
tags: ["태그1", "태그2", "태그3", "태그4", "태그5"]
image: "/images/[파일명].jpg"
---

--- 입력 데이터 ---
[여기에 원천 데이터 삽입]
```

### E-2. 쿠팡 파트너스 제휴 포스트 프롬프트 (초이스/리뷰 글)

```
중요: 모든 응답은 인사말 없이 오직 하나의 마크다운(Markdown) 코드 블록 내에 출력한다.

당신은 [사이트명]의 프리미엄 라이프스타일 큐레이터입니다.
독자를 "무엇을 할지 몰라 헤매는 사람"으로 가정하지 말고, "감각적인 상품을 찾는 세련된 소비자"로 대우한다.

--- 4단계 서사 구조 (필수 준수) ---

[The Hook] - 일상적 페인포인트(Before 상황)로 공감 유도
  예: "매일 아침 신발장 앞에서 이것부터 챙기나요?"
  금지: "~이 고민이시죠?", "~때문에 막막하셨나요?"

[Investigation] - 이 상품을 선택한 데이터 근거 제시
  예: "구글 평점 4.5 이상 + 리뷰 1,000개 이상 필터링"
  목적: 픽앤조이/[사이트명]만의 큐레이션 신뢰도 구축

[The Choice] - 상품 정보 삽입 위치
  아래 쿠팡 HTML을 원본 그대로 삽입:
  [쿠팡 블로그형 HTML 태그 삽입]

[Curation] - 추천 포인트 3가지 + 솔직한 단점 1가지
  포인트는 스펙 나열 금지. 사용 전후 체감 변화 중심으로 서술.

--- 작성 규칙 ---

[필수]
- frontmatter: title, date, slug("choice-{영문명}"), description, category("Choice"), 
  tags(5개), rating(4.5~4.9), image(제품 이미지 src 자동 추출), coupang_link(제품 URL)
- 쿠팡 파트너스 대가성 문구 고정 삽입 (글 하단):
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
- AI 활용 명시 (글 하단): "이 콘텐츠는 AI의 도움을 받아 작성되었습니다."

[금지]
- "공공데이터포털" 단어 사용 금지
- 숫자형 소제목 (1. 2. 3.) 금지
- "추천합니다", "좋은 제품입니다" 등 상투적 마무리 금지
- 상품 수량 기계적 나열 ("추천 상품은 3개입니다" 등) 금지

[종결어미]
~해요 / ~거든요 / ~더라고요 / ~답니다 강제 적용

--- 입력 데이터 ---
상품명: [상품명]
쿠팡 링크: [URL]
가격: [가격]
평점: [평점]
리뷰수: [리뷰수]
```

### E-3. 데이터 description 생성 프롬프트 (Claude용)

짧고 빠른 설명 생성. 상세 페이지 본문이 없을 때 fallback으로 사용.

```
당신은 한국어 정보 요약 전문가입니다.
아래 데이터를 바탕으로 정보성 마크다운 설명문을 작성하세요.

규칙:
- 길이: 300~500자
- 형식: 마크다운 (소제목 2~3개, 표 1개 선택적 사용)
- 톤: 정확하고 친절한 안내 문체
- 금지: "~입니다." 단독 마무리, 영어 용어 남발

입력 데이터:
[JSON 데이터 삽입]

출력: 마크다운 텍스트만 출력. 코드 블록 없이.
```

---

## [Part F] 수익화 장치 구현

### F-1. 쿠팡 파트너스 배너 구현 (공식 iframe 방식)

쿠팡 파트너스 공식 방식은 iframe URL을 직접 삽입하는 것이다.
JavaScript 위젯 방식은 CSP(Content Security Policy) 충돌 가능성이 있으므로 비권장.

```typescript
// src/components/CoupangSidebarBanner.tsx
"use client";

interface Props {
  partnerId: string;   // 예: "AF5831775"
  widgetId: string;    // 쿠팡 파트너스에서 발급받은 위젯 ID
  width?: number;
  height?: number;
}

export default function CoupangSidebarBanner({
  partnerId,
  widgetId,
  width = 240,
  height = 600,
}: Props) {
  const src = `https://ads-partners.coupang.com/widgets.html?id=${widgetId}&template=carousel&trackingCode=${partnerId}&subId=&width=${width}&height=${height}&tsource=`;

  return (
    <div className="hidden lg:block sticky top-24 self-start">
      <iframe
        src={src}
        width={width}
        height={height}
        frameBorder="0"
        scrolling="no"
        referrerPolicy="unsafe-url"    // 필수: 트래킹 정상 동작
        title="추천 상품"
      />
    </div>
  );
}
```

**중요 주의사항:**
- `referrerPolicy="unsafe-url"` 없으면 쿠팡 트래킹이 동작하지 않아 수수료가 누락된다
- `"use client"` 선언 필수 (Hydration mismatch 방지)
- Safari에서 sticky 사이드바가 작동하지 않는 경우 → [Part I-1] 참조

### F-2. 데스크톱 사이드바 + 모바일 하단 배너 레이아웃

```typescript
// 상세 페이지 레이아웃 구조
export default function DetailLayout({ children }: { children: React.ReactNode }) {
  return (
    // overflow-x: clip 사용 (hidden 금지 - Safari sticky 버그 유발)
    <div className="max-w-6xl mx-auto px-4 py-8 overflow-x-clip">
      <div className="flex gap-8 items-stretch">
        {/* 본문 */}
        <article className="flex-1 min-w-0">
          {children}
        </article>

        {/* 데스크톱 사이드바 (모바일 숨김) */}
        {/* self-stretch 래퍼로 sticky 트랙 생성 */}
        <aside className="hidden lg:block w-64 self-stretch">
          <div className="sticky top-24">
            <CoupangSidebarBanner
              partnerId={process.env.NEXT_PUBLIC_COUPANG_PARTNER_ID!}
              widgetId="YOUR_WIDGET_ID"
            />
          </div>
        </aside>
      </div>

      {/* 모바일 하단 배너 (데스크톱 숨김) */}
      <div className="lg:hidden mt-8">
        <CoupangBottomBanner
          partnerId={process.env.NEXT_PUBLIC_COUPANG_PARTNER_ID!}
          widgetId="YOUR_BOTTOM_WIDGET_ID"
          width={320}
          height={100}
        />
      </div>
    </div>
  );
}
```

### F-3. 썸네일 이미지 Fallback 전략

```typescript
// 이미지 유무 판별 함수
function hasRealImage(imageUrl: string | undefined): boolean {
  if (!imageUrl) return false;
  if (imageUrl.trim() === "") return false;
  if (imageUrl.includes("placeholder")) return false;
  return true;
}

// 카테고리별 기본 SVG 경로 매핑
const DEFAULT_THUMBNAILS: Record<string, string> = {
  festival: "/images/default-festival.svg",
  incheon: "/images/default-incheon.svg",
  subsidy: "/images/default-subsidy.svg",
  restaurant: "/images/default-restaurant.svg",
};

// 사용 예시
const thumbnailSrc = hasRealImage(item.image)
  ? item.image
  : (DEFAULT_THUMBNAILS[category] ?? "/images/default.svg");
```

카드 이미지 비율 (21:9 극와이드 권장):
```
aspect-[21/9]   ← 개방감 있는 파노라마 비율
aspect-video    ← 16:9 일반 비율
aspect-[4/3]    ← 4:3 전통 비율 (답답하게 느껴질 수 있음)
```

### F-3-1. 지역 랜드마크 히어로 이미지 자동 매칭 (TourAPI)

정책/보조금/지역정보처럼 **자체 이미지가 없는 카테고리**의 블로그 글에는, 한국관광공사 TourAPI(`KorService2/searchKeyword2`)에서 해당 지역 대표 랜드마크 사진을 자동 매칭해 히어로 이미지로 사용한다.

**핵심 원칙: 광역(시·도) 단위만 사용한다.**

구(區) 단위로 검색하면 "지역명 + 시설명" 식으로 태깅된 의미 없는 사진(테니스장, 임의 공원 등)이 뽑힌다. 따라서 모든 구는 부모 광역으로 흡수한다.

```
✅ 올바른 매칭
  "인천 연수구 출산지원"  →  키워드: "인천"
  "서울 강북구 청년정책"  →  키워드: "서울"
  "부산 해운대구 노인복지" → 키워드: "부산"
  "광주광역시 동구 복지"   →  키워드: "광주"
  "경기 광주시 신혼부부"   →  키워드: "경기"   (광주 모호성 해결)
  "군산시 장애인 평생교육" → 키워드: "군산"   (광역 정보 없음 → 시·군 폴백)

❌ 피해야 할 매칭
  "인천 연수구 출산지원"  →  키워드: "연수구"  (테니스장·아무 시설 등 노이즈)
  "서울 강북구"          →  키워드: "강북구"  (소규모 공원/시설)
```

**광주 모호성 처리 규칙**:
- "경기 광주시" / "경기도 광주시" → `경기` (광주 단어 무시)
- "광주광역시" / 단독 "광주" → `광주`
- 광역 정보 없이 단독으로 "광주시"만 있는 경우는 모호하므로 폴백 풀 사용

**도(道) 풀네임 매핑** (TourAPI 호환을 위해 약칭으로 변환):
```
경상남도 → 경남,  경상북도 → 경북
충청남도 → 충남,  충청북도 → 충북
전라남도 → 전남,  전라북도 → 전북
강원특별자치도 → 강원,  제주특별자치도 → 제주
경기도 → 경기
```

**시도 우선순위 큐 (fallback 순서)**:
1. 텍스트에서 추출한 광역 (시·도)
2. 카테고리 기본 광역 (예: 인천 카테고리 → 인천 강제 보강)
3. 전국 대표 랜드마크 풀 (서울/부산/제주/경주/강릉/전주/여수/안동/경기 등 9곳)
4. 모두 실패 시 내부 안전 폴백 이미지 (다른 블로그와 공유되지 않는 전용 이미지 3종)

**구현 핵심 함수** (`scripts/lib/landmark-engine.js`):
```javascript
// 광역(시·도) 단위만 추출. 구(區) 토큰은 모두 무시.
function extractMetroFromText(text) {
  // 1순위: 광역시/특별시/특별자치시 풀네임
  // 2순위: 도 풀네임 (PROVINCE_FULL_TO_SHORT 매핑 적용)
  // 3순위: 약칭 단어 경계 매칭 (광주 모호성 처리 포함)
  // 4순위(폴백): 광역 정보 자체가 없을 때만 독립 시·군 추출
}
```

**TourAPI 호출 시 주의사항**:
- 행정구역 접미사(`시/군/구/광역시/특별시/특별자치도`)를 포함해 검색하면 0건 반환
  - 예: `군산시` → 0건 / `군산` → 5건
  - 예: `서울특별시` → 0건 / `서울` → 5건
- 따라서 키워드 후보 리스트는 `[원본, 접미사 제거 variant]` 두 개를 순차 시도
- `arrange=Q`(인기순), `contentTypeId=12`(관광지) 권장

**내부 안전 폴백 이미지 풀 운영 규칙**:
- 폴백 이미지는 **블로그 본문 이미지로는 절대 사용하지 않는** 전용 이미지여야 함
- 한 이미지가 폴백과 본문 양쪽에서 사용되면 "여러 블로그가 같은 사진을 쓰는" 재사용 이슈 발생
- 폴백은 가급적 일반적·중립적 이미지 (예: 궁궐, 풍경) + 카테고리 통일 SVG 우선

**일괄 백필 스크립트 운영** (`scripts/fix-post-images.js`):
```bash
node scripts/fix-post-images.js                       # 기본: 카테고리 SVG만 가진 글 처리
FORCE_RECHECK=1 node scripts/fix-post-images.js       # 추가: 레거시 폴백 이미지 사용 글 재처리
FORCE_RECHECK_ALL=1 node scripts/fix-post-images.js   # 추가: 정책 변경 후 인천/보조금 카테고리에서
                                                      # TourAPI 이미지 쓰는 모든 글 재계산
```

### F-3-2. 맛집 포스트 이미지: 네이버 검색 API + 2장 구성

맛집 포스트는 **장소-사진 매칭 정확도**가 핵심이라 일반 랜드마크 API와는 다른 전략을 쓴다.

**전략 변경 이력**:
- 이전: Google Places API → 사진 비용 + 매칭 정확도 한계
- 현재: **네이버 검색 API(이미지)** → 비용 효율 + 한국 식당명 매칭 정확도 우수

**포스트 1편당 이미지 2장 구성**:
```
1. 히어로 이미지 (frontmatter의 image 필드)
   → 글 상단 + 목록 카드 썸네일에 동시 사용
   → 식당 외관/대표 메뉴 위주 선정

2. 본문 중간 이미지 (마크다운 본문 내 ![alt](url) 형태)
   → 첫 번째 소제목 다음, 본문 흐름이 전환되는 지점에 배치
   → 메뉴 디테일/내부 분위기 위주 선정
```

**구현 가이드**:
- 검색어: `"{식당명} {지역명}"` 조합 (예: "어니언 성수")
- 결과 후보 중 첫 2장을 [히어로, 중간] 순으로 배정
- 동일 식당의 두 장은 가능한 한 다른 각도/주제 (대표 외관 + 메뉴 디테일)
- 매칭 실패 시: 카테고리 SVG (`default-restaurant.svg`) + 본문 이미지 생략

**환경변수**:
```
NAVER_CLIENT_ID=xxxxxxxxxxxxxxx
NAVER_CLIENT_SECRET=xxxxxxxxxxxxxx
```

**네이버 API 호출 제약**:
- 일일 호출 한도(개발자센터 기본 25,000회/일)
- 응답에서 `link` 필드(원본 이미지 URL)를 사용 (썸네일 X)
- 한국어 식당명은 검색어에 그대로 사용 가능

**주의사항**:
- 외부 도메인 이미지는 `next.config.ts`의 `images.remotePatterns`에 추가 등록 필요
  - 예: `pstatic.net`, `naver.net` 등 네이버 이미지 CDN 도메인
- 정적 export(`output: "export"`) 환경에서는 `next/image` 대신 일반 `<img>` 태그 사용 권장
- 라이선스 이슈 회피: 외부 이미지는 직접 호스팅하지 않고 원본 URL 참조만 (재배포 X)

### F-4. 쿠팡 파트너스 중복 방지 알고리즘

자동 생성 시 같은 상품이 반복 노출되지 않도록 히스토리 기반 필터링 적용.

```javascript
// scripts/lib/coupang-dedup.js
const fs = require("fs");
const HISTORY_FILE = "./scripts/data/recommended-products.json";
const DEDUP_DAYS = 14;  // 최근 14일 이내 사용 상품 제외

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
}

function filterUsedProducts(candidates, history) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEDUP_DAYS);

  const recentlyUsed = new Set(
    history
      .filter((h) => new Date(h.date) > cutoff)
      .map((h) => h.productId)
  );

  return candidates.filter((p) => !recentlyUsed.has(p.productId));
}

function recordUsedProducts(productIds, publishedBy = "auto") {
  const history = loadHistory();
  const today = new Date().toISOString().split("T")[0];
  productIds.forEach((id) => {
    history.push({ productId: id, date: today, publishedBy });
  });
  // 60일 이상 된 기록은 삭제
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cleaned = history.filter((h) => new Date(h.date) > cutoff);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(cleaned, null, 2));
}

module.exports = { filterUsedProducts, recordUsedProducts };
```

쿠팡 Search API 호출 제한:
```
단일 호출당 최대 10개 (limit > 10 허용 안 됨)
→ 여러 키워드로 10개씩 나눠 수집 후 합산 (~50개 후보풀 구성)
품질 필터: rating >= 4.5, reviewCount >= 100, outOfStock = false
```

---

## [Part G] 자동화 파이프라인

### G-1. 데이터 수집 스크립트 표준 패턴

```javascript
// scripts/collect-[category].js
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../public/data/[category].json");
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

async function collectData() {
  let allItems = [];
  
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(
      `https://api.example.com/data?page=${page}&perPage=${PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${process.env.API_KEY}` } }
    );
    
    if (!response.ok) break;
    const data = await response.json();
    
    if (!data.items?.length) break;  // 더 이상 데이터 없음
    allItems = [...allItems, ...data.items];
    
    if (data.items.length < PAGE_SIZE) break;  // 마지막 페이지
    
    // API 과부하 방지
    await new Promise((r) => setTimeout(r, 500));
  }
  
  // 기존 데이터 로드 (만료 상태 보존을 위해)
  let existing = [];
  if (fs.existsSync(DATA_FILE)) {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  }
  
  // 신규/업데이트 항목 병합 (기존 expired 상태 보존)
  const existingMap = new Map(existing.map((i) => [i.id, i]));
  const merged = allItems.map((item) => ({
    ...item,
    expired: existingMap.get(item.id)?.expired ?? false,
  }));
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(`수집 완료: ${merged.length}건`);
}

collectData().catch(console.error);
```

### G-2. 블로그 자동 생성 로직 핵심 패턴

중복 방지 3단계:

```javascript
// 중복 체크 함수
function isDuplicate(candidate, existingPosts) {
  // 1단계: source_id 정확 매칭
  if (existingPosts.some((p) => p.source_id === candidate.id)) return true;
  
  // 2단계: 제목 유사도 (70% 이상 유사하면 중복으로 판정)
  const similarity = calcTitleSimilarity(candidate.title, existingPosts.map(p => p.title));
  if (similarity > 0.7) return true;
  
  // 3단계: 스냅샷 키 (제목+일정+주소 조합)
  const snapshotKey = `${candidate.title}_${candidate.startDate}_${candidate.address}`;
  if (existingPosts.some((p) => p.snapshot_key === snapshotKey)) return true;
  
  return false;
}

// 덮어쓰기 안전장치
const ALLOW_OVERWRITE = process.env.ALLOW_EXISTING_POST_OVERWRITE === "true";
if (!ALLOW_OVERWRITE && postFileExists) {
  console.log(`스킵: 기존 포스트 존재 (${slug})`);
  continue;
}
```

우선순위 정렬 기준 (공통):
```javascript
candidates.sort((a, b) => {
  // 1순위: 마감 임박 (유효 종료일이 있고 더 가까운 것 우선)
  const aDeadline = a.endDate ? new Date(a.endDate) : null;
  const bDeadline = b.endDate ? new Date(b.endDate) : null;
  if (aDeadline && bDeadline) return aDeadline - bDeadline;
  if (aDeadline) return -1;
  if (bDeadline) return 1;
  
  // 2순위: 조회수 높은 것 우선
  if ((b.viewCount ?? 0) !== (a.viewCount ?? 0)) {
    return (b.viewCount ?? 0) - (a.viewCount ?? 0);
  }
  
  // 3순위: 최근 수정 우선
  return new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0);
});
```

### G-3. 텔레그램 알림 메시지 구조

```javascript
// scripts/notify-telegram.mjs
async function sendReport(report) {
  const lines = [
    `📊 *일일 리포트 ${report.date}*`,
    ``,
    `📋 *단계별 결과*`,
    `• 데이터 수집: ${report.collectStatus}`,
    `• 블로그 생성: ${report.blogStatus}`,
    `• 제휴 포스트: ${report.choiceStatus}`,
    `• 배포: ${report.deployStatus}`,
    ``,
    `📝 *생성 현황*`,
    ...report.categories.map(
      (c) => `• ${c.name}: ${c.generated}편 생성 / ${c.pending}편 대기`
    ),
    ``,
    `📰 *오늘 생성된 글*`,
    ...report.posts.map((p) => `• [${p.category}] ${p.title}`),
  ];
  
  const message = lines.join("\n");
  
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    }
  );
}
```

---

## [Part H] SEO 완전 체크리스트

### H-1. 페이지별 필수 SEO 요소

```typescript
// 모든 페이지에 적용할 metadata 패턴
export const metadata: Metadata = {
  metadataBase: new URL("https://example.com"),  // 루트 layout.tsx에만 설정
  title: {
    default: "사이트명 | 슬로건",
    template: "%s | 사이트명",
  },
  description: "사이트 설명 150자",
  openGraph: {
    title: "페이지 제목",
    description: "페이지 설명",
    url: "https://example.com/page/",
    siteName: "사이트명",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "https://example.com/page/",
  },
};
```

### H-2. JSON-LD 구조화 데이터 패턴

블로그 포스트용:
```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: post.title,
  description: post.description,
  author: {
    "@type": "Person",
    name: "에디터명",
  },
  publisher: {
    "@type": "Organization",
    name: "사이트명",
    logo: { "@type": "ImageObject", url: "https://example.com/logo.png" },
  },
  datePublished: post.date,
  image: post.image,
  url: `https://example.com/blog/${post.slug}/`,
};

// layout.tsx 또는 page.tsx에 삽입
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

리뷰/제품 포스트용 (쿠팡 파트너스 글):
```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Review",
  itemReviewed: {
    "@type": "Product",
    name: post.productName,
    image: post.image,
  },
  reviewRating: {
    "@type": "Rating",
    ratingValue: post.rating,
    bestRating: "5",
    worstRating: "1",
  },
  author: { "@type": "Person", name: "에디터명" },
  publisher: { "@type": "Organization", name: "사이트명" },
  reviewBody: post.description,
};
```

### H-3. sitemap.xml 자동 생성 스크립트

```javascript
// scripts/generate-sitemap.js (postbuild 훅으로 실행)
const fs = require("fs");
const path = require("path");

const DOMAIN = "https://example.com";
const OUT_DIR = path.join(__dirname, "../out");

function generateSitemap() {
  const pages = [
    { url: "/", priority: "1.0", changefreq: "daily" },
    { url: "/blog/", priority: "0.9", changefreq: "daily" },
    // 카테고리 목록 페이지들
  ];
  
  // 블로그 포스트들 추가
  const postsDir = path.join(__dirname, "../src/content/posts");
  if (fs.existsSync(postsDir)) {
    fs.readdirSync(postsDir).forEach((file) => {
      if (file.endsWith(".md")) {
        const slug = file.replace(/\.md$/, "");
        pages.push({
          url: `/blog/${slug}/`,
          priority: "0.7",
          changefreq: "monthly",
        });
      }
    });
  }
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${DOMAIN}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </url>`).join("\n")}
</urlset>`;
  
  fs.writeFileSync(path.join(OUT_DIR, "sitemap.xml"), xml);
  console.log(`sitemap.xml 생성 완료: ${pages.length}개 URL`);
}

generateSitemap();
```

package.json에 postbuild 훅 추가:
```json
{
  "scripts": {
    "build": "next build",
    "postbuild": "node scripts/generate-sitemap.js"
  }
}
```

### H-4. robots.txt

```
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml

# 관리자 페이지 크롤링 차단
Disallow: /admin/
```

### H-5. AdSense 승인 전략

```
승인 전 필수 조건:
1. 블로그 글 15편 이상 (자동화로 누적)
2. Footer에 개인정보처리방침(Privacy Policy) 링크
3. Footer에 문의처 이메일 명시
4. About 페이지 존재
5. 모든 페이지에 canonical URL 설정

Cloudflare 주의사항:
- AdSense 심사 기간 동안 Bot Fight Mode 비활성화
  (Cloudflare Security → Bots → Bot Fight Mode: OFF)
- 심사 완료 후 재활성화
```

---

## [Part I] 품질 관리 & 트러블슈팅 레퍼런스

### I-1. Safari/iOS Sticky 사이드바 버그 (가장 흔한 버그)

**증상**: Safari에서 position: sticky 사이드바가 스크롤을 따라오지 않고 고정된 채 멈춤

**원인**: 조상 요소에 `overflow-x: hidden` 또는 `overflow-y: auto`가 있으면 새로운 스크롤 컨텍스트가 생성되어 sticky를 무력화

**해결**:
```css
/* 수정 전 (버그 발생) */
.layout-wrapper {
  overflow-x: hidden;  /* ← 이 속성이 sticky를 죽임 */
}

/* 수정 후 (해결) */
.layout-wrapper {
  overflow-x: clip;    /* ← 스크롤 흐름은 유지하면서 삐져나온 요소만 자름 */
}
```

Tailwind 적용:
```typescript
// 수정 전
<div className="overflow-x-hidden">

// 수정 후
<div className="overflow-x-clip">
```

추가로 사이드바를 `self-stretch` 부모 래퍼로 감싸야 sticky 트랙이 제대로 생성됨:
```typescript
<aside className="self-stretch">
  <div className="sticky top-24">
    {/* 배너 내용 */}
  </div>
</aside>
```

### I-2. Cloudflare Pages 20,000 파일 제한 초과

**증상**: 배포 시 "exceeded maximum asset count" 에러

**해결**: 하이브리드 렌더링 전환

```typescript
// generateStaticParams에서 SSG 페이지 수 제한
export async function generateStaticParams() {
  const all = await getAllItems();
  
  // 전체를 SSG로 굽지 않고 Top N만 선택
  const TOP_N = 500;  // 프로젝트에 맞게 조정
  return all
    .filter(item => !item.expired)
    .slice(0, TOP_N)
    .map(item => ({ id: item.id }));
}

// 나머지는 /view?id=... CSR 페이지에서 처리
// next.config.ts에서 dynamicParams 설정
```

### I-3. ESLint 경고 누적 방지 규칙

린트 경고가 49개까지 누적된 주요 원인:

1. **Dead Code 누적**: 아키텍처 변경 후 불필요해진 import를 제거하지 않음
   - `Link`, `redirect`, `getField()` 등이 대표적
   - 예방: 카테고리 페이지 추가 시 민낯 템플릿(D-1)에서 시작

2. **scripts vs src 환경 충돌**: scripts의 CommonJS require()가 TypeScript ESLint와 충돌
   - 예방: eslint.config.mjs에 scripts 완화 규칙 적용 (D-5 참조)

3. **img 태그 사용**: `<img>` 대신 Next.js `<Image>` 사용 강제
   - 예방: ESLint 규칙 `@next/next/no-img-element` 유지

### I-4. 마크다운 파일 인코딩 문제 (Windows 환경)

**절대 금지**: 셸 리다이렉트로 파일 복구 (`git show > file`)
```bash
# 금지 (한글 깨짐 위험)
git show HEAD~1:src/content/posts/my-post.md > src/content/posts/my-post.md

# 올바른 방법
git checkout HEAD~1 -- src/content/posts/my-post.md
# 또는
git restore --source=HEAD~1 src/content/posts/my-post.md
```

복구 후 반드시 검증:
```bash
git diff -- src/content/posts/my-post.md  # 변경 내용 확인
npm run build                               # 빌드 성공 확인
```

### I-5. 카카오 로컬 API KOE006 에러

**원인**: 등록되지 않은 도메인에서 API 호출

**해결**: 카카오 디벨로퍼스 → 내 애플리케이션 → 플랫폼 → Web에 추가:
```
https://example.com
http://localhost:3000    ← 로컬 개발/자동화 스크립트 테스트용 필수
```

---

## [Part J] 픽앤조이 케이스 스터디

실제 프로젝트에서 위 원칙들이 어떻게 적용되었는지 확인하는 레퍼런스.

### J-1. 프로젝트 개요

```
사이트명: 픽앤조이 (pick-n-joy.com)
슬로건: "당신의 일상을 Pick, 당신의 주말을 Enjoy!"
타겟: 2030 육아맘 + 주말 여행러 + 스마트 소비자
수익 모델: 쿠팡 파트너스 + Google AdSense (준비 중)
자동화: GitHub Actions 매일 04:00 KST
```

### J-2. 카테고리별 컬러 적용 예시

```
인천 지역 정보: Deep Blue (#1E40AF) → bg-blue-50 text-blue-600
전국 보조금·복지: Amber Orange (#D97706) → bg-amber-50 text-amber-600
전국 축제·여행: Rose Pink (#E11D48) → bg-rose-50 text-rose-600
픽앤조이 초이스: Orange (#F97316) → bg-orange-50 text-orange-600
```

### J-3. 실제 일일 자동화 결과 예시

```
[2026-04-19 04:00 KST 실행 결과]
데이터 수집: 인천 238건 / 보조금 7,388건 / 축제 143건
블로그 생성: 인천 1편 / 보조금 2편 / 축제 1편 = 4편
초이스 생성: 1편 (건강 테마)
맛집 포스트: 2편 (서울/경기)
총 신규 포스트: 7편
빌드: 1,347 static pages (0 errors)
배포: Cloudflare Pages 성공
```

### J-4. 초이스 카테고리 요일별 테마 (참고용)

```json
{
  "monday":    { "theme": "건강", "keywords": ["vitamin", "protein", "massage"] },
  "tuesday":   { "theme": "생활", "keywords": ["storage", "organizer", "cleaning"] },
  "wednesday": { "theme": "주방", "keywords": ["cookware", "kitchen tools"] },
  "thursday":  { "theme": "디지털", "keywords": ["desk setup", "cable", "hub"] },
  "friday":    { "theme": "반려 생활", "keywords": ["pet food", "pet toys"] },
  "saturday":  { "theme": "뷰티·패션", "keywords": ["skincare", "fashion"] },
  "sunday":    { "theme": "가전·가구", "keywords": ["appliance", "furniture"] }
}
```

### J-5. 실제 발생한 주요 Pitfalls 목록

| 번호 | 문제 | 원인 | 해결 |
|------|------|------|------|
| 1 | Cloudflare 배포 실패 | 파일 20,000개 초과 | SSG Top N + CSR 하이브리드 |
| 2 | Safari sticky 미작동 | overflow-x: hidden | overflow-x: clip 교체 |
| 3 | 쿠팡 배너 트래킹 누락 | referrerPolicy 미설정 | referrerPolicy="unsafe-url" 추가 |
| 4 | ESLint 경고 49개 누적 | 규칙 강제 안 함 | eslint.config.mjs 이중 관리 |
| 5 | 한글 마크다운 파일 깨짐 | 셸 리다이렉트 사용 | git checkout으로만 복구 |
| 6 | 카카오 API KOE006 | 도메인 미등록 | localhost:3000 추가 등록 |
| 7 | 초이스 생성 0개 실패 | 쿠팡 API limit>10 오류 | 단일 호출 max 10개 제한 준수 |
| 8 | GFM 테이블 렌더링 깨짐 | 행 사이 빈줄 삽입 | tableLines 단일 블록으로 관리 |

---

## Part K — 운영 안전망 & 보강 패턴 (실전 운영 필수)

> Parts A~J가 "사이트를 만드는 방법"이라면, Part K는 "사이트를 사고 없이 운영하는 방법"이다.
> 픽앤조이 운영 중 누적된 사고/재발 패턴을 일반화한 가드레일 모음이다.

---

### K-1. AI 모델 티어 정책 (Gemini / Claude)

| 용도 | 모델 | 환경변수 | 비고 |
|---|---|---|---|
| 블로그 본문 생성 (메인) | `gemini-2.5-pro` | `GEMINI_MODEL` | `ALLOW_GEMINI_PRO=true` 가드 필수 |
| 단독 초이스 / 맛집 본문 | `gemini-2.5-flash-lite` | `GEMINI_MODEL` | 비용 1/10, 품질 충분 |
| 후보 평점 필터링 (글생성 X) | `gemini-1.5-flash` | `RESTAURANT_GEMINI_MODEL_FALLBACK` | 카카오 → 평점 정제 전용 |
| 데이터 description_markdown | `claude-haiku-4-5` | (코드 상수) | 행정용 설명문, JSON 파편 적합 |

**핵심 규칙**:
- Pro 모델은 명시적 `ALLOW_GEMINI_PRO=true` 없으면 차단되도록 스크립트에 가드 코드 삽입한다.
- CI에서는 env로 모델을 명시 주입하고, 로컬 fallback 차이는 의도적으로 둔다(비용 통제).
- 모델 변경 시 반드시 `WORK_LOG.md`에 변경 이유와 비용 영향을 기록한다.

```javascript
// scripts/lib/gemini-guard.js
function resolveGeminiModel(envKey, defaultModel) {
  const requested = process.env[envKey] || defaultModel;
  if (requested.includes('pro') && process.env.ALLOW_GEMINI_PRO !== 'true') {
    console.warn(`[GeminiGuard] Pro model requested without ALLOW_GEMINI_PRO=true. Falling back to flash-lite.`);
    return 'gemini-2.5-flash-lite';
  }
  return requested;
}
module.exports = { resolveGeminiModel };
```

---

### K-2. Git Hooks 2단계 표준 절차 (재발 방지)

0바이트 파일/한글 깨짐/광범위 변경을 사전 차단하는 2단계 가드.

**파일 구조**:
```
scripts/
  check-worktree-safety.ps1    # 0바이트·인코딩·범위 점검
  install-git-hooks.ps1        # .git/hooks 자동 배치
package.json scripts:
  "check:worktree": "powershell -File scripts/check-worktree-safety.ps1"
  "check:worktree:commit": "... -Mode commit"     # 커밋 직전: 변경 파일만 검사
  "check:worktree:strict": "... -Mode strict"     # push 직전: 전체 강제
  "hooks:install": "powershell -File scripts/install-git-hooks.ps1"
```

**동작 원리**:
- pre-commit 훅: `npm run check:worktree:commit` → 0바이트·BOM 깨짐·대량 변경(예: 30개 초과) 감지 시 커밋 차단.
- pre-push 훅: `npm run check:worktree:strict` → 전체 워킹트리에서 손상 파일 0건 보장.
- 신규 클론/머신 변경 시: `npm run hooks:install` 1회 실행으로 훅 복구.

**check-worktree-safety.ps1 핵심 로직 (PowerShell 7+)**:
```powershell
param([ValidateSet('full','commit','strict')]$Mode='full')
$targets = if ($Mode -eq 'commit') { git diff --cached --name-only } else { git ls-files }
$bad = @()
foreach ($f in $targets) {
  if (-not (Test-Path $f)) { continue }
  $size = (Get-Item $f).Length
  if ($size -eq 0) { $bad += "[ZERO] $f"; continue }
  if ($f -match '\.(md|json|ts|tsx|js)$' -and $size -gt 0) {
    $bytes = [IO.File]::ReadAllBytes($f) | Select-Object -First 3
    # UTF-8 BOM(EF BB BF)이 .md/.json에 들어가면 빌드 깨짐 가능
    if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF -and $f -match '\.json$') {
      $bad += "[BOM] $f"
    }
  }
}
if ($bad.Count -gt 0) { Write-Error ($bad -join "`n"); exit 1 }
exit 0
```

---

### K-3. 0바이트 파일 / 인코딩 깨짐 복구 안전 규칙

**금지**:
- `cmd /c git show <commit>:<path> > <path>` 같은 셸 리다이렉트 덮어쓰기 (Windows 인코딩 조합으로 0바이트 발생)
- `Out-File -Encoding utf8` (PowerShell이 BOM을 자동 삽입함)

**허용**:
- `git checkout <commit> -- <path>`
- `git restore --source=<commit> <path>`

**복구 후 필수 확인**:
1. `git diff -- <path>` (변경 정상 여부)
2. 파일 바이트 크기 `(Get-Item <path>).Length` (0이 아닌지)
3. `npm run build` (실제 빌드 통과)

---

### K-4. 콘텐츠 품질 검증 게이트 (Build Gate)

`package.json`의 `build` 스크립트가 **next build 직전에 품질 게이트를 강제**하는 패턴.

```json
{
  "scripts": {
    "build": "npm run check:choice-quality && npm run test:choice-single-pick && next build",
    "check:choice-quality": "node scripts/validate-choice-quality.js",
    "test:choice-single-pick": "node scripts/test-choice-single-pick.js",
    "verify:data": "node scripts/verify-data-json.js",
    "postbuild": "node scripts/generate-sitemap.js && node scripts/generate-search-index.js"
  }
}
```

**원칙**:
- 본문 구조/이미지 정책/금칙어 위반은 **빌드 단계에서 차단**한다 (런타임 오류로 미루지 않는다).
- 단위 회귀 테스트(`test-*.js`)는 핵심 변환 함수(예: `buildSinglePickBlock`)에 대해 1:1로 작성한다.
- 검증기를 우회하지 않고, 위반 시 **검증기를 약화시키는 것이 아니라 콘텐츠를 고친다**.

**validate-*.js 일반화 패턴**:
```javascript
// scripts/validate-choice-quality.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const errors = [];
const dir = path.join(__dirname, '..', 'src', 'content', 'life');
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const { data, content } = matter(raw);
  // 규칙 1: 단독 픽 헤딩 직하 구조
  if (data.isManualSinglePost) {
    const block = extractSinglePickBlock(content);
    if (!validateImagePosition(block)) errors.push(`[${file}] middle image not in correct position`);
  }
  // 규칙 2: 금칙어
  for (const word of ['동선', '고민 끝', '막막']) {
    if (content.includes(word)) errors.push(`[${file}] forbidden word: ${word}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
```

---

### K-5. verify:data 데이터 정합성 검증 스크립트

`postbuild` 또는 `predeploy` 단계에서 데이터 JSON의 4개 핵심 지표를 검증.

```javascript
// scripts/verify-data-json.js
const fs = require('fs');
const path = require('path');

const SCHEMAS = {
  'incheon.json': { required: ['id', 'title', 'category'], expiredField: 'expired' },
  'subsidy.json': { required: ['서비스ID', '서비스명'], expiredField: 'expired' },
  'festival.json': { required: ['contentid', 'title', 'eventstartdate'], expiredField: 'expired' },
};

const summary = {};
let hasError = false;
for (const [file, schema] of Object.entries(SCHEMAS)) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', file), 'utf8'));
  const total = data.length;
  const missing = data.filter(d => schema.required.some(k => !d[k])).length;
  const expired = data.filter(d => d[schema.expiredField] === true).length;
  const active = total - expired;
  summary[file] = { total, missing, expired, active };
  if (missing > 0) hasError = true;
  if (active === 0) hasError = true;   // 활성 0건이면 수집 실패
}
console.log(JSON.stringify(summary, null, 2));
if (hasError) process.exit(1);
```

**4지표 의미**:
- `total`: 전체 항목 수
- `missing`: 필수 필드 누락 항목 수 (>0이면 실패)
- `expired`: 만료 마킹 항목 수
- `active`: 노출 가능 항목 수 (=0이면 실패 — 수집 파이프라인 사고)

---

### K-6. 단일 생성 경로 통일 (Manual = Auto)

수동 생성과 자동 생성의 품질 편차를 제거하는 운영 원칙.

**원칙**: 사용자가 단독 콘텐츠를 요청해도 본문을 직접 수동 작성하지 않는다. 입력 JSON → 동일 생성기 → 동일 검증기 → 동일 빌드 게이트를 통과시킨다.

**표준 체인** (예: 단독 초이스):
```bash
# 1. 입력 JSON 작성
scripts/choice-input.latest.json

# 2. 생성 (자동/수동 동일 코드 경로)
npm run generate:choice:latest

# 3. 품질 게이트
npm run check:choice-quality

# 4. 빌드 통과 확인
npm run build
```

**효과**:
- 자동/수동 결과물 품질이 동일 (프롬프트·후처리·검증기 1세트만 유지)
- 사고 RCA 단순화 (생성 경로가 1개)
- 재발 시 검증기에 규칙 1개 추가하면 자동/수동 모두 보호됨

---

### K-7. 수정 범위 격리 원칙 (Single-File Discipline)

> "사용자가 단일 UI/문구/간격 수정을 요청한 경우, 기본 수정 범위는 대상 파일 1개로 제한한다."

**규칙**:
1. 명시 지정된 파일만 수정. "관련 있어 보여도" 다른 파일 수정 금지.
2. 범위 확장이 필요하면 **즉시 멈추고**, 이유 + 영향 파일 목록 + 사용자 승인 → 진행.
3. 작업 중 다음 신호 감지 시 즉시 중단 후 복구:
   - 0바이트 파일 발생
   - 인코딩 깨짐 (`�` 문자 또는 BOM 삽입)
   - 단일 요청에 10개 이상 파일 변경
4. 공통 파일(`globals.css`, `layout.tsx`, `eslint.config.mjs`)은 명시 지정 없이는 수정 금지.

---

### K-8. 원격 우선 동기화 규칙 (당일 자동화 콘텐츠 조회)

자동화 파이프라인이 04:00 KST에 GitHub push하므로, **로컬에는 당일 결과물이 없다**.

**규칙**:
- KST 08:00 이후 사용자가 "오늘 만든 포스트"를 묻는 즉시 → **`git pull` 선행** → 그 후 파일 검색.
- KST 08:00 이전 → "아직 자동화 실행 중일 수 있습니다" 안내.
- 이 규칙을 어기면 "파일 없음" 오답으로 사용자 신뢰 손상.

---

### K-9. 4문서 동기화 원칙 (운영 메모리)

모든 작업 종료 시 **하나의 호흡**으로 4개 문서를 동시 업데이트한다.

| 문서 | 역할 | 업데이트 내용 |
|---|---|---|
| `WORK_LOG.md` | 누적 이력 (append-only) | 날짜 + 작업 요약 + 영향 파일 |
| `.github/copilot-instructions.md` | AI 운영 규칙 (현행) | 신규 규칙 / 변경된 운영 정책 |
| `COPILOT_MEMORY.md` | 압축 운영 메모 | 최근 핵심 변경의 1~3줄 요약 |
| `PROJECT_MEMORY.md` | 마일스톤 / 구조 결정 | 아키텍처/카테고리 추가 같은 큰 변경 |

**금지 패턴**:
- 코드 푸시 → "나중에 문서 업데이트" → 절대 안 함 (다음 세션에서 잊혀짐)
- 문서만 수정하고 작업 완료 보고 → "작업 미이행" 간주

---

### K-10. CI 실패 트리아지 (Canceling vs 진짜 실패)

GitHub Actions 빨간 X가 무조건 실패는 아니다.

| 표시 | 원인 | 조치 |
|---|---|---|
| `Canceling since a higher priority...` | concurrency 그룹 충돌 (단일 호흡 위반) | A-6 단일 commit/push 준수, 무시 가능 |
| `Process completed with exit code 1` | 실제 실패 | 즉시 로그 확인 + 패치 |
| `continue-on-error: true` 단계의 빨간 X | 의도적 격리 (예: 초이스 0건 → 맛집 단계는 진행) | 무시 + 텔레그램 리포트 확인 |

**continue-on-error 적용 패턴**:
```yaml
- name: "[2.5단계] 픽앤조이 초이스 자동 생성"
  continue-on-error: true   # 초이스 실패가 후속 단계 차단하지 않음
  run: npm run generate:choice:auto

- name: "[2.5단계 보존] 초이스 결과물 즉시 커밋"
  if: always()              # 실패해도 부분 결과 보존
  run: |
    git add src/content/life scripts/data/recommended-products.json
    git commit -m "auto: choice partial results" || echo "no changes"
    git push || echo "push skipped"
```

---

### K-11. 텔레그램 일일 리포트 표준 구조

```javascript
// scripts/notify-telegram.mjs (핵심 구조)
const message = `
📊 픽앤조이 일일 리포트 (${kstDate})

[1단계] 데이터 수집: ${stage1.status}
- 인천: 총 ${stage1.incheon.total} / 활성 ${stage1.incheon.active} / description ${stage1.incheon.descGenerated}생성·${stage1.incheon.descPending}대기
- 보조금: ...
- 축제: ...

[2단계] 블로그 생성: ${stage2.status}
- 인천: ${stage2.incheon.count}편
  ${stage2.incheon.titles.map(t => `  • ${t}`).join('\n')}
- 보조금: ...
- 축제: ...

[2.5단계] 픽앤조이 초이스: ${stage25.status}
- 생성 ${stage25.count}편 / fallback 발동 ${stage25.fallbackCount}회 / 적용 평점 ${stage25.appliedMinRating}
- 캐시 hit ${stage25.cacheHit} / miss ${stage25.cacheMiss} / Google API 호출 ${stage25.googleCalled}

[3단계] 맛집: ${stage3.status} / 생성 ${stage3.count}편
`;
```

**원칙**:
- 단계별 status (success/partial/failed/skipped) 명시
- 카테고리별 제목 목록 포함 (전체 통합 목록은 중복이라 제거)
- fallback 발동 횟수와 적용 임계값(평점/조회수) 노출 → 운영 임계값 조정 근거
- API 비용 지표(cache_hit/miss/google_called) 노출 → 비용 추적

---

### K-12. 콘텐츠 라이팅 톤앤매너 일반 가이드

카테고리별 차별화된 4스타일 원칙. 동일 배치에서 반복 금지.

| 스타일 | 적용 카테고리 | 특징 |
|---|---|---|
| **Sensory** (감각 중심) | 맛집, 여행 | 조명/소리/온도/첫 점의 질감 우선 |
| **Discovery** (희소성·발견) | 축제, 숨은 명소 | 번잡함 너머의 발견, 의외성 강조 |
| **Curation** (취향 제안) | 초이스, 라이프스타일 | 특정 무드/취향에 맞춘 세련된 추천 |
| **Aesthetic** (직관적 찬사) | 디자인 강조 콘텐츠 | 공간 미학·완성도 직접 찬사 |

**공통 금지**:
- 절대 금지 단어: `동선`, `고민`, `막막`, `답`, `어디로 갈지`, `솔직히`, `진심으로`, `정답`
- 패턴 금지: "문제 제시 → 즉시 해결" 구조의 훅/소제목
- 라벨 금지: `Before:`, `After:`, `장점 1·2·3`, `큐레이션 포인트 3가지`

**필수**:
- 종결어미 경어체 (`~해요/~거든요/~입니다`), 평어체 금지
- 감성 묘사가 정보 나열보다 먼저
- 마무리는 "함께 가면 좋은 사람" 같은 공식 문구 금지 → 작가 주관 한 줄 평 또는 여운

**자기검수 체크리스트**:
- [ ] 훅에 금지 단어 0회
- [ ] 동일 배치 첫 문장 패턴 반복 0회
- [ ] 소제목이 정보 라벨이 아닌 매거진 헤드라인
- [ ] 사용 스타일(Sensory/Discovery/Curation/Aesthetic)을 로그에 기록

---

### K-13. 필수 영향도 분석 (Mandatory Impact Analysis)

모든 코드 수정 전 Plan 단계에서 다음 3가지를 분석/보고한다.

1. **데이터 연관성**: 수정 로직이 주요 데이터 JSON 구조에 미치는 영향
2. **컴포넌트 의존성**: 수정이 다른 UI/라우트/API 동작을 깨뜨릴 가능성
3. **예외 케이스**: 입력 누락/형식 오류/데이터 공백 등 잠재 오류 3가지

**방어적 구현**:
- 사용자 요청 A를 위해 B/C 선행이 필요하면 Plan에 포함해 먼저 제안
- A 이후 D 리스크가 예상되면 Plan에 포함해 먼저 알림
- 모든 생성/수정 후 기본 검증: `npm run build` (필요 시 JSON 스키마 + 핵심 스크립트 dry-run)

---

## 부록: 새 프로젝트 시작 시 AI에게 전달할 프롬프트

```
이 매뉴얼(AI_WEBSITE_BLUEPRINT.md)을 완전히 숙지했다고 가정하고 아래 프로젝트를 시작한다.

프로젝트명: [XXXX]
사이트 개념: [한 줄 설명]
타겟 페르소나: [2~3가지]
주요 카테고리: [카테고리 목록]
수익 모델: [쿠팡 파트너스 / AdSense / 기타]
데이터 소스: [사용할 API 목록]
특이사항: [픽앤조이와 다른 점]

요청:
1. 위 매뉴얼의 [Part B] 부트스트랩 체크리스트 기반으로 Day 0~1 실행 계획 수립
2. [Part D-7] 폴더 구조 템플릿을 이 프로젝트에 맞게 수정
3. [Part G-1] 데이터 수집 패턴을 이 프로젝트 API에 맞게 구현
4. 카테고리별 컬러 시스템 제안 ([Part A-2] 기준)
5. 월별 콘텐츠 누적 목표 및 수익화 타임라인 제안
6. [Part K-2] Git hooks 2단계 가드를 Day 0에 즉시 설치 (`npm run hooks:install`)
7. [Part K-9] 4문서(WORK_LOG/copilot-instructions/COPILOT_MEMORY/PROJECT_MEMORY) 동기화 원칙을 첫날부터 적용
8. [Part A-6] 단일 호흡 배포 7단계를 모든 작업 종료 루틴으로 고정
9. [Part K-1] AI 모델 티어 정책(Pro/Flash/Lite) 결정 + ALLOW_GEMINI_PRO 가드 코드 삽입
10. [Part K-4] 콘텐츠 품질 게이트(`validate-*.js`)를 `build` 스크립트에 처음부터 체이닝
```

### 부록 — 단일 호흡 배포 7단계 (A-6) 압축 카드

```
1. 코드 수정
2. npm run build (성공 확인)
3. 4문서 동기화 (WORK_LOG + copilot-instructions + COPILOT_MEMORY + PROJECT_MEMORY)
4. git add (코드 + 문서 한 번에)
5. 단일 commit  ← 분리하면 CI가 이전 run을 자동 취소함
6. 단일 push
7. CI 결과 확인 (Canceling 무시 / exit 1만 즉시 패치)
```

---

*이 매뉴얼은 픽앤조이(pick-n-joy.com) 프로젝트 실전 경험을 기반으로 작성되었습니다.*
*최종 업데이트: 2026-04-25 (완성본 v2 — Part K 운영 안전망 13개 항목 통합)*
