# 프로젝트: pick-n-joy.com — 인천/전국 생활정보 수익형 웹사이트

## 사이트 슬로건
"당신의 일상을 Pick, 당신의 주말을 Enjoy!"

## 목표
공공데이터포털 API, 한국관광공사 TourAPI, 카카오 로컬 API에서 정보를 자동 수집하고,
Claude AI가 매일 블로그 글을 자동 작성하며, Google AdSense + 쿠팡 파트너스로
수익화하는 독립 웹사이트. 기반 지역은 인천광역시.

## 기술 스택
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Anthropic Claude API (블로그 글 자동 생성)
- 공공데이터포털 API, 한국관광공사 TourAPI, 카카오 로컬 API (데이터 수집)
- GitHub Actions (매일 07:00 KST 자동 실행)
- Cloudflare Pages (무료 호스팅, 도메인: pick-n-joy.com)

## 콘텐츠 카테고리 (4개)

### 카테고리 1 — 인천 지역 정보
- 소스: 공공데이터포털 API (행사정보, 축제정보, 문화행사)
- 대상: 인천광역시 내 행사, 축제, 지역 기획 프로그램, 지역 보조금
- 업데이트: 매일 07:00 자동 수집
- 만료 처리: endDate 기준 → expired: true 마킹, 목록에서 제외, 페이지 유지

### 카테고리 2 — 전국 보조금 · 복지 정책
- 소스: 공공데이터포털 API (복지 보조금, 정부 지원 정책)
- 대상: 청년지원, 출산지원, 주거지원, 노인복지 등 전국 단위 정책
- 업데이트: 매일 07:00 자동 수집
- 만료 처리: endDate 기준 → expired: true 마킹

### 카테고리 3 — 전국 축제 · 여행 정보
- 소스: 한국관광공사 TourAPI (국문 관광정보)
- 대상: 전국 축제, 관광지, 여행 추천, 계절 이벤트
- 업데이트: 매일 07:00 자동 수집
- 만료 처리: endDate 기준 → expired: true 마킹

### 카테고리 4 — 전국 맛집 정보 (2단계, 추후 구현)
- 소스: 카카오 로컬 API
- 대상: 지역별 맛집, 카페, 음식점 정보
- 업데이트: 주 1회 (상시 유효, 만료 없음)
- 상태: 현재 미구현 — 1~3 카테고리 안정화 후 추가

## 폴더 구조 (목표)

```
my-local-info/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 루트 레이아웃 (AdSense, GA 포함)
│   │   ├── page.tsx                    # 메인 페이지
│   │   ├── incheon/                    # 카테고리 1 — 인천 지역 정보
│   │   │   ├── page.tsx                # 목록 페이지
│   │   │   └── [slug]/page.tsx         # 상세 페이지
│   │   ├── subsidy/                    # 카테고리 2 — 전국 보조금·복지 정책
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── festival/                   # 카테고리 3 — 전국 축제·여행
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── blog/                       # AI 자동 생성 블로그
│   │       ├── page.tsx
│   │       └── [slug]/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── cards/
│   │   │   ├── EventCard.tsx
│   │   │   ├── SubsidyCard.tsx
│   │   │   └── FestivalCard.tsx
│   │   └── ads/
│   │       └── AdSenseBanner.tsx
│   └── lib/
│       ├── api/
│       │   ├── publicData.ts           # 공공데이터포털 API 클라이언트
│       │   ├── tourApi.ts              # 한국관광공사 TourAPI 클라이언트
│       │   └── kakaoLocal.ts           # 카카오 로컬 API 클라이언트 (추후)
│       ├── claude.ts                   # Anthropic Claude API 블로그 생성
│       └── utils/
│           └── expiry.ts               # 만료 처리 유틸리티
├── scripts/
│   ├── collect-incheon.ts              # 인천 지역 정보 수집
│   ├── collect-subsidy.ts              # 보조금·복지 정책 수집
│   ├── collect-festival.ts             # 축제·여행 정보 수집
│   └── generate-blog.ts               # AI 블로그 글 자동 생성
├── public/
│   └── data/
│       ├── incheon.json                # 수집된 인천 지역 정보
│       ├── subsidy.json                # 수집된 보조금 정보
│       ├── festival.json               # 수집된 축제 정보
│       └── blog.json                   # 생성된 블로그 글 목록
├── .github/
│   └── workflows/
│       └── daily.yml                   # 매일 07:00 KST 자동화 워크플로우
├── PROJECT_PLAN.md
├── PROJECT_MEMORY.md
├── next.config.ts
├── wrangler.toml                       # Cloudflare Pages 설정
└── package.json
```

## 환경변수

| 변수명 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI 블로그 자동 생성 |
| `PUBLIC_DATA_API_KEY` | 공공데이터포털 API 인증 |
| `TOUR_API_KEY` | 한국관광공사 TourAPI 인증 |
| `KAKAO_API_KEY` | 카카오 로컬 API 인증 (추후) |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense |
| `NEXT_PUBLIC_GA_ID` | Google Analytics |

## 자동화 흐름 (GitHub Actions — 매일 07:00 KST)

1. 공공데이터포털 API → 인천 지역 정보 수집 → `public/data/incheon.json` 갱신
2. 공공데이터포털 API → 보조금·복지 정책 수집 → `public/data/subsidy.json` 갱신
3. 한국관광공사 TourAPI → 축제·여행 정보 수집 → `public/data/festival.json` 갱신
4. 만료 항목 → `expired: true` 마킹 (페이지 유지, 목록에서 제외)
5. Claude AI → 오늘의 블로그 글 자동 생성 → `public/data/blog.json` 추가
6. Git 커밋 & 푸시 → Cloudflare Pages 자동 배포

## 수익화

- **Google AdSense**: 메인, 목록, 상세, 블로그 페이지에 광고 배치
- **쿠팡 파트너스**: 블로그 글 하단 배너

## 구현 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 1단계 | 프로젝트 세팅, Cloudflare 배포, GA/AdSense 연동 | 완료 |
| 2단계 | 카테고리 1~3 데이터 수집 스크립트 + 페이지 구현 | 진행 중 |
| 3단계 | Claude AI 블로그 자동 생성 | 예정 |
| 4단계 | 카테고리 4 (맛집) 카카오 API 연동 | 추후 |
