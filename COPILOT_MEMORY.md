# COPILOT_MEMORY.md — 픽앤조이 작업 메모

이 파일은 GitHub Copilot 작업 기준의 운영 메모입니다.
Copilot 기준 문서는 `.github/copilot-instructions.md`와 `WORK_LOG.md`를 함께 관리합니다.

## 시작 전 체크리스트

1. `.github/copilot-instructions.md` 확인
2. 이 파일(`COPILOT_MEMORY.md`) 확인
3. 최근 작업 이력(`WORK_LOG.md`) 확인

## 운영 규칙

- 세션 시작 시 위 3개 파일의 최신 상태를 확인한다.
- 세션 종료 전 사용자 확인 여부와 관계없이, 작업 이력이 있으면 문서/메모리 동기화를 수행한다.
- 업데이트 시 최소 `WORK_LOG.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`를 함께 반영한다.
- 코드 변경 후에는 반드시 `npm run build`로 검증한다.
- 코드 작업 완료 시 반드시 `git add → git commit → git push`를 수행한다.
- **작업 종료 체크리스트(필수)**: build 성공 + commit/push 완료 + 3개 문서 동기화

## 핵심 프로젝트 요약

- 사이트: 픽앤조이 (`https://pick-n-joy.com`)
- 스택: Next.js 16 App Router + TypeScript + Tailwind CSS v4
- 배포: Cloudflare Pages + GitHub Actions(매일 04:00 KST)
- 데이터 소스: 공공데이터포털 + 한국관광공사 TourAPI + Claude API(claude-haiku-4-5)

## 최근 변경 요약 (압축판)

- 상세 이력은 `WORK_LOG.md`를 기준 문서로 사용하고, 이 파일은 작업 규칙과 최신 상태만 유지한다.
- 2026-04-03 핵심 반영:
  - **GitHub Actions 스케줄 04:00 KST로 변경** (`0 19 * * *`)
  - **admin/admin/runs 배경 bg-cherry-blossom 통일** (gradient → 꽃무늬 배경)  - **홈페이지 히어로 리디자인**: 진한 orange 그라데이션 → 흰색→오렌지 소프트 그라데이션 + 어두운 텍스트 (눈 피로 감소)
  - **콘텐츠 배경 체계 정리**:
    - `bg-cherry-blossom`: 페이지 전체 배경 → 원본 벚꽃 이미지 유지
    - `bg-content-floral`: 메인 콘텐츠 컨테이너 → 새 개나리 꽃 이미지 (`bg-content.png`)
    - 적용 9곳: 상세 4개(incheon/subsidy/festival/blog) + about + privacy + life/choice(2곳) + life/restaurant  - **맛집 파이프라인 3지역 분리**: 기존 2지역(`incheon-gyeongin`, `seoul-gyeonggi`) → 3지역(`incheon`, `seoul`, `gyeonggi`)
    - collect: 지역당 8개 검색어, MAX_ITEMS_PER_REGION 30, GOOGLE_PRE_FILTER_SIZE 50
    - generate: `gyeonggi-other` → `gyeonggi` 통일, 3지역 regionLabel/areaTag 매핑
    - frontend: `LifeRegionTab` 3지역 타입, RestaurantExplorer 3탭, restaurant/page.tsx 3지역 로드
    - 수집 결과: 인천 30, 서울 30, 경기 30 (총 90개 후보), 월 1회 수집으로 충분
  - **맛집 후보 자동 재수집**: 빈 버킷 감지 시 `collect-life-restaurants.mjs` 자동 호출
  - **텔레그램 리포트 4건 수정**: 경기 포스트 미생성 해결, 테이블 CSS nowrap, deploy.yml 리포트 후 재배포
- 2026-04-02 핵심 반영:
  - **한글 파일명 인코딩 버그 수정 (write-daily-report.mjs)**:
    - `git log`에 `-c core.quotePath=false` 추가 → 한글 블로그/맛집 파일명 정상 인식
    - 근본 원인: Git 기본 `core.quotePath=true`가 한글을 octal 이스케이프 → 패턴 매칭 실패
    - 이 수정으로 앞으로 모든 일일 리포트에서 정확한 블로그/맛집 카운트 보장
  - **텔레그램 알림 데이터 수집 결과 추가**:
    - 수집 스크립트 3개에 `GITHUB_OUTPUT` collect_summary 출력 추가
    - deploy.yml → write-daily-report.mjs → notify-telegram.mjs 데이터 흐름 구축
    - 3개 신규 라인: 📡 수집 단계 아이콘, 📋 항목별 건수, 📂 변경 파일
  - **맛집 포스트 제목 규칙 개선**: 음식 장르/특색 필수 포함 (기존: 상황 위주)
  - **admin/runs 4/2 데이터 보정**: generatedBlogPosts 1→3건, 한글 파일명 복원
  - **초이스 포스트 본문 배너 금지 규칙**: 3편 일괄 제거 + 생성기/copilot 규칙 명문화
  - **종료일 지난 항목 블로그 생성 방지**: `isEndDatePassed()` 날짜 필터 추가 (축제 YYYYMMDD / 인천·보조금 YYYY-MM-DD). `expired` 플래그만으로 부족한 시점 차이 해결
- 2026-04-01 핵심 반영:
  - **Cloudflare Worker `pick-n-joy-trigger` 배포 완료**:
    - URL: `https://pick-n-joy-trigger.royshong01.workers.dev`
    - 코드: `workers/trigger/index.js` + `workers/trigger/wrangler.toml`
    - Secrets: `ADMIN_SECRET`, `GITHUB_TOKEN` (wrangler secret put 설정)
    - `/admin/runs/` 수동 트리거 버튼 정상 작동 확인
  - **Admin 페이지 UI 수정**:
    - admin/runs + admin 메인 상단 여백 `pt-20 pb-10` 적용
    - admin 메인 "수동 실행 트리거" 플레이스홀더 카드 제거
  - **블로그/맛집 카테고리 썸네일 이미지 교체**:
    - 블로그: 인천(`incheon-thumbnail.jpg`), 보조금(`subsidy-thumbnail.png`) 커스텀 일러스트 적용
    - 맛집: 인천/서울/경기 3개 지역 모두 커스텀 일러스트 적용
    - `BlogFilter.tsx`의 `CATEGORY_THUMBNAIL_IMAGES`, `LifeFilterClient.tsx`의 `RESTAURANT_THUMBNAIL_IMAGES` 매핑 구조
    - 이미지 없는 카테고리는 기존 그라데이션 fallback 유지
  - **정책/소개 페이지 UI 마감 보정**:
    - `src/app/privacy/page.tsx` 상단 설명문과 1번 섹션 간격 확대
    - `src/app/about/page.tsx` 우측 사이드 배너(태허/쿠팡) 제거
  - **문의 이메일 프로젝트 계정으로 교체**:
    - `roysshong@gmail.com` → `royshong01@gmail.com`
    - 반영 위치: `about`, `privacy`
  - **Figma MCP 충돌 원인 정리**:
    - SethFord WebSocket 확장과 Copilot MCP 혼용 시 연결 실패
    - 충돌 확장 제거 후 `.vscode/mcp.json` 단일 경로 사용
    - `.gitignore`에 `.vscode/mcp.json` 유지(토큰 비커밋)
- 2026-03-31 핵심 반영:
  - **AdSense 검증 경로 안정화**:
    - `public/ads.txt` 배포 및 실서버 접근/크롤러 접근(200) 확인
    - `deploy.yml` 모든 Next.js build 단계에 `NEXT_PUBLIC_ADSENSE_ID='ca-pub-5984189992308575'` 주입
    - 원인 요약: 로컬 `.env.local`에는 값이 있었지만 CI build env에 값이 없어 배포 HTML에서 스크립트 누락 가능
  - **개인정보 처리방침 페이지 신설**: `src/app/privacy/page.tsx`
    - 쿠키 고지, DART 쿠키, 맞춤광고 거부 안내, 수집 정보/목적 포함
  - **Footer 심사 대응 링크 추가**: `src/components/SiteFooter.tsx`
    - `/privacy`, `/about` 링크 추가로 심사 봇 탐색성 강화
  - **서울 타깃 자동 생성 경로 추가**: `generate-blog-post.js`에 `BLOG_ONLY_KEYWORD` 필터 추가 (title/name/addr1/overview 기반)
  - **검증 완료**: `BLOG_ONLY_CATEGORY="전국 축제·여행"` + `BLOG_ONLY_KEYWORD="서울"`로 1건 자동 생성 성공 (`source_id: 2540520`)
  - **Gemini 키 로딩 복구**: `scripts/generate-choice-post.js`에서 `.env` 플레이스홀더 키가 `.env.local` 실키를 가리는 문제 수정 (`.env.local` override 우선)
  - **재검증 완료**: CJ 입력 파일로 자동 생성 성공 + 빌드 성공
  - **초이스 생성기 품질 보강**: `scripts/generate-choice-post.js`에 과장형 제목 금지, 비근거 수치/비교 결과 생성 금지, `outputFileName` 지원, `.env/.env.local` 자동 로드 추가
  - **CJ 바이오코어 포스트 재작성**: `src/content/life/2026-03-31-choice-cj-biocore-probiotics.md`를 캐츠랑 포스트와 같은 자연어형 초이스 톤으로 정리
  - **CJ 전용 입력 파일 추가**: `scripts/choice-input.cj-biocore.json`
  - **캐츠랑 20kg 초이스 포스트 추가**: `src/content/life/2026-03-31-choice-catsrang-20kg.md` 생성, 상단 전면 이미지와 본문 중간 후면 QR 이미지를 로컬 파일로 연결
  - **초이스 수동 생성 자동화 추가**: `scripts/generate-choice-post.js` 신설 + `scripts/choice-input.example.json` 추가 + `package.json`의 `generate:choice` 명령 등록
    - 현재는 API 연동 전 단계로, 수동 입력 JSON 기반으로 초이스 포스트를 즉시 생성 가능
    - 입력 필수값: `title`, `englishName`, `summary`, `coupangUrl`, `coupangHtml`
  - **sitemap 확장**: `scripts/generate-sitemap.js`를 전체 섹션/상세 페이지 포함 구조로 고도화 (`/incheon`, `/subsidy`, `/festival`, `/life`, `/life/choice`, `/life/restaurant`, `/rss.xml` 포함)
  - **사이트 목적 문구 SEO 반영**: `layout.tsx` 전역 metadata/OG/JSON-LD(WebSite+Organization), `page.tsx` 홈 metadata, `about/page.tsx` 운영 목적 문구 업데이트
  - **블로그 목록 정리**: 블로그 페이지에서 맛집 글 제외, 맛집 글은 `일상의 즐거움` 영역 중심으로 노출
  - **네비 UX 보정**: `일상의 즐거움` 메뉴를 `블로그` 앞에 배치, 검색 아이콘 크기 소폭 확대
  - **초이스 포스트 운영 보정**: CJ 바이오코어 포스트 추가 후 상단 이미지 로컬 교체, 본문 중복 이미지 제거, 단계형 헤딩 제거, 인코딩 복구
  - **초이스 Product JSON-LD 강화**: `aggregateRating`/`offers`를 frontmatter 값(`rating_value`, `review_count`, `coupang_link`)으로 자동 생성
  - **admin 수동 트리거**: `AdminTriggerPanel` 추가. `/admin/runs` 상단에서 Cloudflare Worker를 통해 GitHub Actions `deploy.yml`를 `full` 또는 `deploy_only` 모드로 즉시 실행 가능
  - **Cloudflare Worker 연동 방식 고정**: Worker URL `https://pick-n-joy-trigger.royshong01.workers.dev`, 헤더 `X-Admin-Secret`, 시크릿 `GITHUB_TOKEN` + `ADMIN_SECRET` 검증
  - **admin runs 상세 패널**: `RunsDetailPanel` 클라이언트 컴포넌트 신규 생성. 날짜 행 클릭 시 accordion으로 단계별 결과·커밋·파일 상세 표시. `[date]` 동적 라우트 방식은 `output: export` 제약으로 불가 → accordion 전환
  - **`getDailyRunReport(date)`**: `daily-runs.ts`에 단건 조회 함수 추가
  - **Gemini 비용 가드**: 모델 `gemini-2.5-flash-lite` 전환, 예산 500원 상한, maxOutputTokens 8192, 호출 간 5초 지연, API 호출 10회 캡
  - **admin 접근 보호**: Cloudflare Zero Trust OTP 인증, path `/admin/*`, 세션 24h
  - **Cloudflare Zero Trust UI 경로** (2025-11 이후): Login methods → `Integrations → Identity providers` / Access Apps → `Access controls → Applications`
  - **모바일 네비**: MobileNav 햄버거 메뉴 + 검색 버튼 추가 (`lg:hidden`, 드롭다운 5개 링크)
  - **블로그 보완**: 왕가의 산책 포스트 잘린 본문 완성 (source_id: 2433596)
  - **사이트 전체 검색**: Fuse.js 기반 퍼지 검색 (빌드타임 인덱스 377건, SearchOverlay + SearchButton + SiteHeader 통합)
  - **CTA 스타일 통일**: 보조금 CTA를 축제/맛집과 동일 glass-morphism 스타일로 변경 + 텍스트 축소(`whitespace-nowrap`) + 맛집 제목 1줄 처리
  - **히어로 맛집 CTA 추가**: 3번째 CTA `🍽️ 요즘 뜨는 맛집 보러가기` → `/life/restaurant` 추가
  - **히어로 상단 여백 축소**: `min-h-[85vh]` → `min-h-[70vh]` (네비↔배지 간격 35% 감소)
  - **글로벌 네비/푸터 적용**: SiteHeader 그라디언트 리디자인 + SiteFooter 신규 + layout.tsx 전역 반영
  - 10개 페이지 개별 헤더/푸터 제거 (중복 제거)
  - 소개("/about") 메뉴 네비/푸터에서 제거
  - 홈페이지 전면 개편: 태허 철학관 참고 디자인 기반 `page.tsx` 완전 재작성
  - copy.md 카피 적용 (Problem 섹션, CTA, 히어로 부제, 카테고리 상세)
  - Features + CTA를 주황색 그라데이션 단일 섹션으로 통합
  - 블로그 목록에서 초이스 포스트 필터링 + 썸네일 50% 축소
  - 깨진 블로그 글 6편 삭제 (3/28 Gemini API 인코딩 오류분)
  - 로고 이미지 적용 (홈 네비+푸터, `next/image` 컴포넌트)
  - 벚꽃 배경 이미지 적용 (홈 제외 전 페이지 `bg-cherry-blossom`)
  - 목록 페이지 카드 높이 통일 (`min-h-[220px]` → `h-full`, 블로그 방식)
  - copilot-instructions.md에 미승인 수정 금지 규칙 추가
- 이전(~03-30) 핵심:
  - 초이스 카테고리 신설 + 수동 리뷰 포스트 2편
  - 맛집 자동화 고도화 / 블로그·배포 안정화

## 고정 운영 사실 (반복 참조용)

- 쿠팡 파트너스: `AF5831775`
- 사이드바 배너: `976244` / 하단 배너: `976089`
- 쿠팡 iframe은 공식 URL 직접 사용 + `referrerPolicy="unsafe-url"` 유지
- `CoupangBanner.tsx`는 `'use client'` 유지 (Hydration mismatch 방지)

## Cloudflare Zero Trust 운영 참조

- `/admin/*` 보호: `pick-n-joy-admin` Application (Zero Trust → Access controls → Applications)
- OTP 설정 위치: Zero Trust → Integrations → Identity providers → One-time PIN
- 세션: 24시간, 로그인 이메일: 본인 계정
- 2025-11월 이후 UI 개편으로 구 경로(Settings → Authentication) 폐지

## Gemini API 비용 관리 (2026-03-31 기준)

- 모델: `gemini-2.5-flash-lite` (2.0-flash/1.5-flash는 이 계정에서 404)
- 일일 예산 상한: 500원 (`BLOG_DAILY_BUDGET_KRW`)
- maxOutputTokens: 8192 (`GEMINI_MAX_OUTPUT_TOKENS`)
- API 호출 캡: 10회 (`BLOG_MAX_API_CALLS`)
- 호출 간 최소 지연: 5000ms (`BLOG_GEMINI_MIN_DELAY_MS`)

## 유지 백로그 (요약)

- [x] GitHub Actions → Telegram 실행 결과 알림 (비용 + 생성 건수 + 데이터 수집 결과)
- [ ] Google AdSense 설정
- [x] Admin 수동 트리거 (Cloudflare Worker + GitHub Actions workflow_dispatch API)
- [ ] 맛집 포스트 이미지 소스 전략 고도화
