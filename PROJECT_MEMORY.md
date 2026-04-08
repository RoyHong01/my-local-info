# Project Memory & Status

이 파일은 프로젝트의 과거 작업 이력, 현재 상태, 그리고 앞으로 해야 할 작업들을 기록하여 AI 어시스턴트가 프로젝트의 전체 컨텍스트를 빠르고 정확하게 파악할 수 있도록 돕는 핵심 메모리 파일입니다.

## 운영 원칙 (Operational Rules)

- 코드 변경 작업이 끝나면 반드시 `npm run build`를 먼저 통과시킨다.
- 빌드 성공 후 반드시 `git add → git commit → git push` 순서로 반영한다.
- 작업 이력은 항상 `CLAUDE.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md` 4개 문서에 동기화한다.
- 위 3개 항목(build/commit/문서동기화)이 모두 완료되어야 작업 완료로 간주한다.

## 1. 현재 프로젝트 상태 (Current Status)

- **기술 스택**: Next.js 16 App Router, Tailwind CSS v4, TypeScript
- **환경 기반**: 정적 HTML 배포 (`next.config.ts`의 `output: "export"` 적용)
- **배포 플랫폼**: Cloudflare Pages (GitHub Actions `deploy.yml` 통해 자동 배포)
- **핵심 기능**: 공공데이터포털 API 연동, Claude API(claude-haiku-4-5)를 활용한 블로그 포스트(.md) 자동 생성 스크립트

## 2. 최근 완료한 주요 작업 (Recently Completed)

- 상세 이력은 `WORK_LOG.md`를 기준으로 관리하고, 본 문서는 현재 상태 중심으로 유지한다.

### 2026-04-08 기준 핵심 요약

- 일상의 즐거움 카드 노출 제한 제거
  - `src/app/life/page.tsx`의 초이스/맛집 하드캡 제거
  - `src/lib/life-choice.ts` 기본 limit 상향(`1000`)
- 정책/신뢰도 보강
  - `src/app/about/page.tsx` E-E-A-T 중심 소개 섹션 확장 + AboutPage JSON-LD
  - `src/app/layout.tsx` 전역 메타 설명 및 `WebSite`/`Organization` schema 강화
- 이용약관 페이지 추가
  - `src/app/terms/page.tsx` 신규 생성 (목적/서비스 내용/면책/저작권/문의)
- 푸터 신뢰도 링크 세트 완성
  - `src/components/SiteFooter.tsx`에 `소개 | 개인정보 처리방침 | 이용약관 | 문의하기(mailto)` 반영
  - 보조 문구 색상을 메인 문구와 동일 톤으로 통일
- 네이버 URL 검사 대응
  - `src/app/page.tsx` 홈 `description`과 `openGraph.description`을 80자 이내 권장 길이로 축약
- 네이버 크롤링 보강
  - `scripts/generate-sitemap.js`에 `/privacy/`, `/terms/` 정적 경로를 추가해 정책 페이지 탐색성 강화
- 홈 히어로 하단 통계 정렬 보정
  - `src/app/page.tsx`에서 중앙 지표 고정, 좌우 지표 간격 확장으로 CTA 버튼 하단 균형 개선
  - 추가 조정: 통계 영역 최대 폭을 CTA 묶음 폭 수준으로 줄여 시각적 과확장 해소
- 홈 CTA 버튼 동일 폭 정렬
  - `src/app/page.tsx`의 CTA 3개를 동일 폭 grid로 통일하고, 버튼 문구를 더 구체적인 정보 범위 표현으로 조정
  - 추가 조정: CTA 내부 정렬을 통일하고 통계 요소를 각 카드 중심축 아래로 재배치, 히어로 내부 스크롤 제거
  - 여백 조정: 설명 문단과 CTA 카드 사이 간격을 확대해 시각적 숨구멍 확보
  - Problem 카드 정리: 중앙 정렬 카드로 통일하고 1번 제목을 더 짧고 직관적인 질문형 문구로 교체
  - 추가 단순화: 숫자 배지를 제거하고 텍스트 중심 구조로 바꿔 가독성 강화
  - 전환 강조: `✅ 픽앤조이가 하는 일` 섹션 상단에 옅은 그라디언트 구분선을 추가해 문제 제기/해결책 단계 분리를 명확화
  - 하단 마무리 개선: 마지막 CTA 문구와 푸터 사이 여백을 확대하고(`pb-16 sm:pb-20`), 푸터에 옅은 상단 구분선과 상단 패딩을 적용해 시각적 압박을 완화
  - 문서 품질 정리: `WORK_LOG.md`의 markdownlint 경고(MD036/MD032) 유발 구문을 표준 헤딩/리스트 간격 형태로 정리해 경고 0 상태로 복원
  - 홈 가독성 마감: 마지막 안내 문구의 모바일 줄바꿈을 안전하게 조정하고, 카테고리 헤더 3번째 줄 및 카드 본문/메타 텍스트 선명도를 높여 정보 인지성을 개선
  - 맛집 탐방 페이지 개선: 상단 히어로 타이포를 미세 조정하고, 카드별 카카오맵 링크 아래에 관련 블로그 링크를 조건부 추가해 더 깊은 정보를 바로 탐색할 수 있게 연결
  - 맛집 데이터/포스트 매칭 점검: 현재 스냅샷 기준 전체 식당이 블로그 글을 가지는 구조는 아니며, 89개 중 26개만 매칭되어 카드 링크는 조건부 표시가 적절함

### 2026-04-07 기준 핵심 요약

- 픽앤조이 초이스 수동 포스트 1건 추가 (Panasonic ES-148 눈썹 바리깡)
  - `src/content/life/2026-04-07-choice-panasonic-es148-eyebrow-trimmer.md`
- 픽앤조이 초이스 수동 포스트 1건 추가 (톰보 모노 제로 샤프형 지우개)
  - `src/content/life/2026-04-07-choice-tombo-mono-zero-eraser.md`
- 사용자 제공 다운로드 이미지 2종을 초이스 이미지 자산으로 반영
  - `public/images/choice/panasonic-es148-hero.png`
  - `public/images/choice/panasonic-es148-detail.png`
- 사용자 제공 다운로드 이미지 2종을 초이스 이미지 자산으로 반영
  - `public/images/choice/tombo-mono-zero-hero.png`
  - `public/images/choice/tombo-mono-zero-detail.png`
- 쿠팡 제휴 링크/배너 메타를 frontmatter에 반영하여 상세/사이드바 연동 유지
- 초이스 상세 중복 이미지 재발 방지 적용
  - `src/app/blog/[slug]/page.tsx`에서 본문 첫 이미지와 `frontmatter.image` 중복 시 자동 제거
  - `scripts/generate-choice-post.js` 이미지/CTA 규칙 문구 모순 보정
- 초이스 CTA 링크 중복 재발 방지 적용
  - 생성 프롬프트에서 CTA 링크를 본문 중간 1회로 강제
  - `dedupeAffiliateLinks()` 후처리로 동일 쿠팡 링크 중복 시 마지막 1개만 유지

### 2026-04-01 기준 핵심 요약

- 정책/소개 페이지 마감 보정
  - `src/app/privacy/page.tsx` 상단-본문 간격 확대
  - `src/app/about/page.tsx` 우측 사이드 광고 배너 제거
- 운영 문의 이메일 프로젝트 계정으로 통일
  - `royshong01@gmail.com`으로 교체 (`about`, `privacy`)
- Figma MCP 연결 정리
  - SethFord WebSocket 확장 제거
  - Copilot MCP 설정 파일(`.vscode/mcp.json`) 단일 사용

### 2026-03-31 기준 핵심 요약

- AdSense 심사 대응 마무리
  - `public/ads.txt` 배포 및 크롤러 접근 확인(200)
  - `src/app/layout.tsx`의 AdSense script 주입 로직 실서버 반영 확인
  - `.github/workflows/deploy.yml`의 빌드 env에 `NEXT_PUBLIC_ADSENSE_ID` 누락 문제 수정
- 개인정보 처리방침 페이지 신설 + Footer 링크 반영
  - `src/app/privacy/page.tsx`
  - `src/components/SiteFooter.tsx` (`/privacy`, `/about` 링크)
  - AdSense 심사 필수 항목(쿠키, DART, 광고설정, 수집정보/목적) 문구 반영

### 2026-03-30 기준 핵심 요약

- `픽앤조이 초이스` 카테고리 신설 및 목록/카드/필터 반영
  - `src/lib/life-choice.ts`
  - `src/app/life/choice/page.tsx`
  - `src/components/life/ChoiceArticleCard.tsx`
- 초이스 수동 리뷰 포스트 2편 작성 및 히어로 이미지 로컬화
  - `src/content/life/2026-03-30-choice-*.md`
  - `public/images/choice-*.jpg`
- 블로그 상세 초이스 UI/문구 개선
  - `src/app/blog/[slug]/page.tsx` (`object-contain`, 간격 조정, 고지문 정리)
- 맛집 자동화 안정화
  - 지역 버킷 분배(서울/인천/경기기타)
  - Google Places 평점 필터(4.2+)
  - slug 정규화로 상세 404 복구
- 품질/배포 안정화
  - Playwright E2E 게이트
  - 생성 재시도 로직 및 SEO/JSON-LD 강화

### 고정 운영 사실

- 쿠팡 파트너ID: `AF5831775`
- 사이드바 배너: `976244`, 하단 배너: `976089`
- 쿠팡 배너는 공식 iframe URL + `referrerPolicy="unsafe-url"` 유지

## 3. 앞으로 해결해야 할 과제 / 백로그 (Backlog & Next Steps)

- [x] 블로그 상세 페이지 구조화된 JSON-LD 데이터 추가 및 Meta 데이터(OpenGraph 등) 확충 작업
- [x] 사이트맵(`sitemap.xml`) 및 웹 로봇(`robots.txt`) 추가하여 신규 글들에 대한 크롤링 최적화 진행
- [x] Google Analytics (NEXT_PUBLIC_GA_ID) 설정 ✅ 2026-03-28
- [x] 쿠팡 파트너스 배너 구현 ✅ 2026-03-28
- [x] Google AdSense (NEXT_PUBLIC_ADSENSE_ID) 설정 및 ads.txt/CI 반영 ✅ 2026-03-31 (심사 진행 중)
- [ ] 에러 핸들링 및 자동화 모니터링: 스크립트 실행 오류 시 알림 채널 검토
- [x] 2단계: 전국 맛집 기능 1차 구축 (카카오 API + Gemini 스냅샷 + 맛집 포스트 자동 생성)
- [ ] 맛집 포스트 이미지 전략 고도화 (검증 가능한 이미지 소스 확보 후 다중 이미지 적용)

## 4. 쿠팡 자동화 메모 (압축)

- 현재 상태: `src/lib/coupang-partners-config.ts`에 정책/검증 유틸 정리 완료(Phase 1)
- 다음 단계:
  - [ ] 쿠팡 API 발급 후 실제 엔드포인트/인증값으로 설정 확정
  - [ ] 수집/생성 스크립트(`collect-coupang-products.mjs`, `generate-coupang-posts.mjs`) 구현
  - [ ] 워크플로우 통합 및 링크 무결성(파트너 ID 포함) 자동 검증
