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
- 배포: Cloudflare Pages + GitHub Actions(매일 07:00 KST)
- 데이터 소스: 공공데이터포털 + 한국관광공사 TourAPI + Claude API(claude-haiku-4-5)

## 최근 변경 요약 (압축판)

- 상세 이력은 `WORK_LOG.md`를 기준 문서로 사용하고, 이 파일은 작업 규칙과 최신 상태만 유지한다.
- 2026-03-31 핵심 반영:
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

- [ ] GitHub Actions → Telegram 실행 결과 알림 (비용 + 생성 건수)
- [ ] Google AdSense 설정
- [x] Admin 수동 트리거 (Cloudflare Worker + GitHub Actions workflow_dispatch API)
- [ ] 맛집 포스트 이미지 소스 전략 고도화
