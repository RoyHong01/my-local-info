# Project Memory & Status

## ⛔ 수정 범위 최우선 규칙 (항상 첫 번째로 적용)

1. **특정 파일 단독 수정 원칙**: 사용자가 특정 파일을 지정해서 수정을 요청하면, **오직 그 파일 하나만** 수정한다. 다른 파일은 절대 건드리지 않는다.
2. **불명확 시 무조건 질문**: 수정 대상이나 요청 의도가 조금이라도 불확실하면, 임의로 진행하지 말고 반드시 먼저 질문한다.
3. **공통 파일 수정 금지**: `globals.css`, `layout.tsx` 등 공통 파일은 사용자가 명시적으로 지정하지 않는 한 절대 수정하지 않는다.
4. **확장 수정 사전 허락 원칙**: 요청 범위 밖 파일을 수정해야 할 필요가 생기면, 즉시 멈춘다. 설령 도움이 된다고 판단되더라도, **반드시 먼저 사용자에게 이유와 영향 파일 목록을 설명하고 허락을 받은 후에만 실행한다. 허락 전에는 어떤 파일도 수정하지 않는다.**

---

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

- 2026-04-17 인천 가정의달 포스트 간격 조정 + 복구 안전 규칙 고정
  - 대상 파일: `src/content/posts/2026-04-17-incheon-family-month-free-gift.md`
  - 조치: `신청 방법` 헤딩을 `##`에서 `###`으로 조정해 제목과 숫자 리스트(1~5)의 시각적 간격을 축소.
  - 범위 제약 준수: 공통 CSS는 수정하지 않고, 포스트 1개 파일만 수정.
  - 재발 방지: 파일 복구 시 셸 리다이렉트(`git show ... > file`) 덮어쓰기 금지.
  - 표준 복구 절차: `git checkout <commit> -- <file>` 또는 `git restore --source=<commit> <file>` 사용 후 파일 바이트 크기/`git diff`/`npm run build` 검증.
  - 사고 후속: 실제 0바이트 손상 파일들을 git 내장 복구 방식으로 되살린 뒤 빌드 성공을 재확인.
  - 운영 강화: 단일 수정 요청은 대상 파일 1개 원칙으로 처리하고, 추가 파일 수정이 필요할 경우 사유/영향 파일을 먼저 보고 후 진행.
  - 자동 가드 도입: `scripts/check-worktree-safety.ps1`와 `scripts/install-git-hooks.ps1`를 추가해 pre-push 단계에서 `check:worktree:strict` 검증을 강제.
  - 훅 2단계 적용: pre-commit은 `check:worktree:commit`(경량), pre-push는 `check:worktree:strict`(엄격)로 분리 운영.

- 2026-04-15 사이드바 폭 회귀 수정
  - 원인: `src/app/globals.css`의 `.sticky-sidebar { width: 100% }`가 2컬럼 레이아웃을 깨뜨려 본문 카드가 hidden 판정.
  - 조치: `.sticky-sidebar` 폭을 `15rem` 고정(`flex: 0 0 15rem`)으로 복구.
  - 검증: `npm run test:e2e` 통과, `npm run build` 성공.

- 2026-04-15 사이드바 구조 단순화(단일 aside sticky)
  - 배경: 이중 래퍼 + 보정 로직에서 회귀가 반복되어 사이드바 미노출이 모든 페이지에서 재현.
  - 조치: `src/components/StickySidebar.tsx`를 단일 `aside` sticky 구조로 변경하고 JS 보정 로직 제거.
  - CSS: `src/app/globals.css`를 `.sticky-sidebar` 단일 클래스 기반으로 정리.
  - 효과: sticky 동작 경로를 최소화해 브라우저별 차이와 회귀 표면을 축소.

- 2026-04-15 사이드바 미노출 재보정
  - 문제: 순수 sticky 복원 후에도 일부 환경에서 사이드바가 스크롤 중 우측에서 사라지는 현상이 잔존.
  - 조치: `src/components/StickySidebar.tsx`에 `ResizeObserver`를 추가해 래퍼 높이를 부모 높이에 동기화하고, sticky 이동 범위를 확보.
  - CSS: `src/app/globals.css`의 `.sticky-sidebar-shell`에 `align-self: stretch`, `min-height: 100%`를 보강.

- 2026-04-15 사이드바 최종 안정화(순수 sticky)
  - 회귀: JS 기반 footer 도킹 전환으로 사이드바가 중간 구간에서 화면 밖으로 빠지는 현상 확인.
  - 최종 조치: `src/components/StickySidebar.tsx`의 위치 계산 로직을 제거하고 순수 CSS sticky 구조로 복원.
  - CSS 정리: `src/app/globals.css`에서 absolute 모드 분기 규칙 제거, `-webkit-sticky` 기반 기본 동작 유지.
  - 기대 효과: 스크롤 중간 구간에서도 사이드바가 끊김 없이 추종하고, Safari에서 점프/떨림 회귀를 줄임.

- 2026-04-15 Safari 사이드바 중간 구간 추종 불안정 재수정
  - 증상: 사이드바가 스크롤 중간에는 움직임이 둔하고, 하단 푸터 근처에서만 갑자기 위치를 찾는 점프 현상.
  - 원인 보정: 사이드바 래퍼 높이가 메인 콘텐츠 구간과 충분히 동기화되지 않아 sticky 이동 여유가 부족했던 구조를 보완.
  - 조치: `src/components/StickySidebar.tsx`에서 래퍼 `minHeight`를 부모 높이에 맞춰 동기화하고, 도킹 판정을 `contentRect.bottom >= footerTop - gap`으로 단순화.
  - CSS 보정: `src/app/globals.css`에서 sticky 관련 과도한 렌더링 속성 제거 및 `self-stretch` 기반 레이아웃 정렬 적용.

- 2026-04-15 blog latest 완전일치 다중 후보 타이브레이커
  - 목적: 동일 행사명(연도/회차 중복) 상황에서 수동 생성 대상이 실행마다 흔들리지 않도록 결정 규칙 고정.
  - 규칙: `최신 일정 > 이미지 보유 > 조회수`.
  - 적용: `scripts/generate-blog-post.js`의 `exact-first`/`exact-only` 경로에서 완전일치 후보 집합 정렬 후 사용.

- 2026-04-15 blog latest 키워드 완전일치 우선 강화
  - 요청사항: `keyword`와 제목(`서비스명/title/name`)이 100% 일치하는 API 결과가 있으면 해당 데이터 우선 사용.
  - 반영: `scripts/generate-blog-post.js`의 `exact-first`에서 완전일치 발견 시 비완전일치 후보를 무시하고 즉시 해당 집합만 생성 대상으로 확정.
  - 자동 분기: `scripts/run-blog-latest.js`는 `keywordMatchMode` 미지정 시 행사 카테고리는 `exact-first`, 나머지는 `contains`를 기본 적용.

- 2026-04-15 blog latest 키워드 정밀화(exact-first)
  - 목적: 특정 행사명 수동 생성 시 불필요한 유사 항목 매칭을 줄이고 정확도를 높이기 위함.
  - 반영: `scripts/generate-blog-post.js`에 키워드 매칭 모드(`exact-first`, `exact-only`, `contains`) 추가.
  - 기본값: `scripts/run-blog-latest.js` + `scripts/blog-input.latest.json`에서 `keywordMatchMode=exact-first` 사용.
  - 동작: 완전일치 후보가 있으면 해당 후보만 사용, 없으면 포함 매칭으로 자동 fallback.

- 2026-04-14 고정입력 수동 생성 체계 도입
  - 목적: Choice/Blog 수동 생성 시 입력 파일명/명령어 변형으로 인한 반복 실수를 줄이고 생성 속도를 높이기 위함.
  - 추가 파일: `scripts/choice-input.latest.json`, `scripts/blog-input.latest.json`, `scripts/run-choice-latest.js`, `scripts/run-blog-latest.js`
  - 명령 추가: `npm run generate:choice:latest`, `npm run generate:blog:latest`
  - blog 래퍼는 입력 JSON의 `category`, `keyword`를 환경변수(`BLOG_ONLY_CATEGORY`, `BLOG_ONLY_KEYWORD`)로 주입해 기존 `generate-blog-post.js` 본체를 재사용.
  - 결과: Choice와 Blog 모두 "입력값 수정 -> 고정 명령 실행"의 동일 UX로 운영 가능.

- 2026-04-14 초이스 시나리오 소제목 라벨 정책 수정
  - 배경: 수동 생성본에 `Before:`/`After:` 라벨형 소제목이 노출되어 톤 일관성이 깨지는 문제 확인.
  - 조치: `scripts/generate-choice-post.js`의 시나리오 섹션 프롬프트를 자연어 전환 규칙으로 변경하고, 라벨형 표기를 금지.
  - 적용: 당일 생성된 초이스 2건(`...shafran...`, `...2080-doctor-clinic...`)의 소제목을 자연어 제목으로 즉시 보정.
  - 검증: `npm run build` 성공.

- 2026-04-14 픽앤조이 초이스 수동 포스트 추가 (2080 닥터크리닉 미백 치약)
  - 파일: `src/content/life/2026-04-14-choice-2080-doctor-clinic-whitening.md`
  - 이미지: `public/images/choice/clinic-hero.png`, `public/images/choice/clinic-middle.png`
  - 규칙 반영: 쿠팡 제휴 링크/배너 메타데이터, 시나리오형 라이팅 구조, 본문 CTA 연결.

- 2026-04-14 픽앤조이 초이스 수동 포스트 추가 (샤프란 실내건조)
  - 파일: `src/content/life/2026-04-14-choice-shafran-romantic-cotton.md`
  - 이미지: `public/images/choice/shafran-hero.png`, `public/images/choice/shafran-middle.png`
  - 규칙 반영: 쿠팡 제휴 링크/배너 메타데이터, 시나리오형 라이팅 구조, 본문 CTA 연결.

- 2026-04-14 인천관광공사 관광사진 API003 연동
  - 이벤트성 인천 데이터(행사/축제)에 대해 키워드 기반 사진 자동 매칭을 수집 단계에 추가.
  - 매칭 실패 시 인천 랜드마크 사진 랜덤 fallback 적용.
  - 생성 포스트 frontmatter에 `image_source`, `image_source_note`를 포함하고 상세 페이지 히어로 하단에 출처 문구를 노출.
  - CI 수집 단계 env에 `INCHEON_PHOTO_TOKEN` 시크릿을 추가해 자동화에 동일 적용.

- 2026-04-14 인천 목록 만료 카드 제거 및 자동화 보강
  - 현상: 종료된 `2026 인천 봄꽃 축제` 카드가 인천 목록에 잔존.
  - 원인: `cleanup-expired`가 `incheon.json`을 처리하지 않아 `expired` 상태가 갱신되지 않음.
  - 조치: `scripts/cleanup-expired.js`에 인천 데이터 만료 처리 패스 추가 (`endDate`/`신청기한` 기반, KST 비교).
  - 즉시 반영: `public/data/incheon.json`의 해당 항목 `expired: true` 처리.

- 2026-04-14 초이스 포스트 라이팅 고도화
  - 배경: 자동 생성 글이 스펙/포인트 나열형으로 고정되는 경향을 줄이고, 사용자 체감 중심 시나리오 몰입도를 강화.
  - 조치: `scripts/generate-choice-post.js` 프롬프트를 Context 우선 + Before/After 대비 구조로 재작성.
  - 추가 규칙: 감각 묘사 언어 강화, 데이터 기반 신뢰 문장(입력 데이터 있을 때만) 삽입, `큐레이션 포인트 3가지` 번호형 섹션 금지.
  - 운영 동기화: `.github/copilot-instructions.md`의 초이스 규칙 섹션에도 동일 정책 반영.

- 2026-04-14 Safari 우측 사이드바 겹침 수정
  - 재현: 맥북 Safari 스크롤 시 우측 광고/상품 사이드바가 메인 콘텐츠 및 footer와 겹치는 현상.
  - 조치: `src/components/StickySidebar.tsx`를 도입해 scroll/resize 시 footer 위치를 계산하고 `sticky -> absolute` 전환.
  - 연결 조건: `src/components/SiteFooter.tsx`의 `id="site-footer"`, 각 페이지 부모 `overflow-visible`, `src/app/globals.css`의 `-webkit-sticky` 보강.
  - 향후 우측 사이드바 수정은 공용 컴포넌트 기준으로 진행해야 Safari 회귀를 막을 수 있음.

- 2026-04-14 맛집 스크립트 로컬 env 로더 추가
  - 배경: 수동 복구 실행에서 터미널 세션 미주입 시 `Missing GEMINI_API_KEY` 오류 발생 가능.
  - 조치: `scripts/generate-life-restaurant-posts.mjs`에 `.env.local` 자동 로더를 추가해 local/manual 실행 안정성 강화.
  - 주의: 이미 주입된 환경변수는 유지(override 없음)하도록 구현해 CI 환경과 충돌 방지.

- 2026-04-14 초이스 썸네일 누락 복구
  - 원인: 생성된 초이스 포스트 frontmatter `image`가 `/images/choice/living-2026-04-14.jpg`를 가리켰으나 실제 파일이 없어서 카드 썸네일 깨짐.
  - 조치: `src/lib/life-choice.ts`에서 로컬 이미지 존재 여부 체크 후 없으면 `coupangBannerImage`로 자동 대체.
  - 생성기 보강: `scripts/generate-choice-post.js`에서 `image` 계산 시 배너 이미지 fallback을 추가해 동일 이슈 재발 방지.
  - 즉시 보정: `src/content/life/2026-04-14-choice-living-2026-04-14.md` frontmatter `image`를 유효한 배너 이미지 URL로 수정.

- 2026-04-14 수동 복구 배포 (초이스 1 + 맛집 3)
  - 배경: 당일 schedule run(#495)에서 초이스 실패 및 맛집 단계 skip으로 발행 누락 발생
  - 조치: `generate-choice-posts-auto.js`(화요일 생활 테마) 1건 + `generate-life-restaurant-posts.mjs` 3건을 수동 실행해 누락분 복구
  - 결과 파일:
    - `src/content/life/2026-04-14-choice-living-2026-04-14.md`
    - `src/content/life/2026-04-14-seongsu-restaurant-23279805.md`
    - `src/content/life/2026-04-14-songdo-restaurant-1045132880.md`
    - `src/content/life/2026-04-14-pangyo-restaurant-1370916394.md`
  - 검증: `npm run build` 성공(547 pages / sitemap 542 / search-index 482)

- 2026-04-14 스케줄 실패 RCA + 재발 방지
  - 원인: `generate_choice`에서 품질/중복 필터 통과 후보 0개로 실패했고, 기존 워크플로우 구조상 이후 3단계가 연쇄 `skipped`
  - 조치1: `.github/workflows/deploy.yml`의 `generate_choice`를 `continue-on-error: true`로 설정해 초이스 실패와 맛집 단계를 분리
  - 조치2: `scripts/generate-choice-posts-auto.js`에 테마별 백업 키워드 병합 재시도(1회) 로직 추가

- 2026-04-14 초이스 자동화 복구
  - 쿠팡 Search API는 `limit > 10`에서 `rCode: 400`, `limit is out of range`를 반환하므로 단일 호출 Top 50 수집은 사용할 수 없음
  - `scripts/lib/coupang-api.js` limit 상한을 10으로 고정하고, `scripts/generate-choice-post.js`에서 다중 영어 키워드로 최대 50개 안팎 후보풀을 모으도록 변경
  - 품질 메타데이터가 충분한 상품을 우선 사용하되, 부족할 때는 `rank <= 10` bestseller를 보충 후보로 허용해 생활 테마 로컬 생성 성공 확인

- 2026-04-13 초이스 산출물 보존 강화
  - `.github/workflows/deploy.yml`에 초이스 생성 직후 전용 커밋 단계를 추가해 `src/content/life`, `scripts/data/recommended-products.json`을 즉시 보존
  - 이후 3단계 실패 시에도 초이스 글/히스토리와 git log 기반 리포트 데이터가 유지되도록 워크플로우 순서를 강화

- 2026-04-13 텔레그램 리포트 확장
  - `scripts/notify-telegram.mjs`에서 초이스를 맛집과 분리해 `초이스 포스트 n건`으로 표기
  - 초이스 생성 파일이 있으면 제목 목록을 별도 블록으로 노출
  - `choiceFallback` 지표(발동 횟수/적용 하한)를 텔레그램 본문에 추가
  - 과거 리포트 JSON(초이스 필드 없음)도 fallback 0건/0회로 안전 처리

- 2026-04-13 리포트 고도화 + 빌드 경고 해소
  - `src/lib/posts.ts` 스캔 경로를 고정형으로 정리해 Turbopack 광범위 패턴 경고 제거
  - `scripts/generate-choice-post.js`가 GitHub Actions output으로 fallback 관련 지표(`applied_min_rating`, `relaxed_fallback_applied_count`)를 배출
  - `scripts/write-daily-report.mjs`에서 `published_by(auto/manual/unknown)`를 전체/카테고리별(블로그/초이스/맛집)로 집계해 Markdown/JSON 리포트에 표시
  - `.github/workflows/deploy.yml`에서 초이스 step output을 리포트 단계 env로 전달해 fallback 발동 빈도 추적 가능

- 2026-04-13 초이스 fallback 완화 + published_by 확장
  - 초이스 자동 선정은 1차 fallback(대체 키워드 확장) 후에도 부족하면 2차 fallback으로 평점 기준을 `4.5 -> 4.3 -> 4.0` 순으로 완화해 재평가
  - 다만 `reviewCount >= 100`, 품절 제외, 최근 14일 중복 제외는 유지해 품질 하한을 보존
  - `published_by` frontmatter를 초이스/일반 블로그/맛집 자동 생성본에 공통 도입해 향후 통계 집계 기반 마련

- 2026-04-13 초이스 무인 엔진 운영성 개선
  - 요일별 테마 설정을 `scripts/data/choice-daily-themes.json`로 외부화해 운영자가 키워드/대체 키워드를 직접 조정 가능하도록 변경
  - `scripts/data/recommended-products.json` 히스토리에 `publishedBy(auto/manual)` 필드 추가
  - 중복 정책은 기본 global 유지, `CHOICE_DEDUP_SCOPE=same-publisher`로 자동/수동 이력 분리 운영 지원
  - 1차 키워드로 3개를 못 채우면 fallback 키워드까지 자동 확장 검색하도록 `scripts/generate-choice-post.js` 보강
  - 기존 `scripts/choice-auto-topics.json` 제거로 설정 경로를 단일화

- 2026-04-13 초이스 무인 엔진 고도화(중복 방지 강화)
  - `scripts/generate-choice-posts-auto.js`를 KST 요일 기반 7대 테마 자동 선택 구조로 개편
  - `scripts/lib/coupang-api.js` 검색 파라미터를 `sort=bestAsc` 지원 + 최대 20개 수집으로 확장
  - `scripts/generate-choice-post.js`에 최근 14일 `productId` 중복 제외, 품질 필터(`rating>=4.5`, `reviewCount>=100`, `outOfStock=false`), 브랜드 다양성(최소 2브랜드) 로직 통합
  - 발행 완료 시 사용 상품 3개의 `productId`/날짜/파일을 `scripts/data/recommended-products.json`에 기록
  - `.github/copilot-instructions.md`에 초이스 무인 엔진 정책을 명시해 자동화 기준 고정

- 2026-04-13 초이스 훅/소제목 다양성 규칙 통합
  - `scripts/generate-choice-post.js`에 4개 앵글 기반 다양화 전략을 반영하고, 실행마다 랜덤 1개를 선택해 서론/소제목 톤에 강제 적용
  - 앵글: 문제 해결형 / 트렌드 중심형 / 전문가 큐레이션 / 가성비·효율 강조
  - 소제목 규칙: 번호형 라벨(`1. 장점`, `2. 특징`) 금지, 질문형+감탄/강조형 혼합 사용
  - 적용 범위: 자동 생성(`generate-choice-posts-auto.js`)과 반자동 생성(입력 JSON 기반) 모두 동일 생성기를 사용하므로 공통 적용
  - 운영 문서 동기화: `.github/copilot-instructions.md`에 관련 정책 추가

- 2026-04-13 초이스 지침/시간대/환경변수 정합화
  - `.github/copilot-instructions.md` 10번 문구를 "본문 배너/위젯 금지 + 텍스트 CTA 링크 허용"으로 수정해 11번 정책과 충돌 제거
  - `scripts/generate-choice-post.js`의 날짜 함수(`todayIso`)를 KST(UTC+9) 기준으로 통일
  - `scripts/generate-choice-post.js` 프롬프트 본문 구조 지시문의 중복 1줄 제거
  - `scripts/lib/coupang-api.js`에서 `.env` 로딩을 제거하고 `.env.local`만 사용하도록 정리
  - 환경 점검: `.env` 파일 없음, `.env.local` 파일 존재, `COUPANG_ACCESS_KEY`/`COUPANG_SECRET_KEY` 등록 확인

- 2026-04-13 일상의 즐거움(life) 목록 썸네일 수정
  - `src/app/life/page.tsx`의 초이스 카드 이미지 매핑을 `c.image || c.coupangBannerImage`로 조정
  - `src/lib/life-choice.ts`의 `ChoiceArticle`에 `coupangBannerImage` 추가
  - blog 목록과 life 목록의 썸네일 fallback 정책을 동일하게 맞춤

- 2026-04-13 초이스 목록 썸네일 fallback 보강
  - `src/components/BlogFilter.tsx`에서 초이스 포스트 썸네일 우선순위를 `post.image -> post.coupangBannerImage -> 카테고리 기본`으로 조정
  - 히어로 비활성(`image: ""`)과 목록 썸네일 표시를 분리해 기본 썸네일 회귀 방지

- 2026-04-13 초이스 본문/사이드바 간격 조정
  - `src/app/globals.css`: `choice-post-prose h3` 마진 축소로 번호형 소제목 간격 개선
  - `src/app/blog/[slug]/page.tsx`: 태허철학관 배너 래퍼에 하단 여백(`mb-4`) 추가로 첫 상품 배너와 간격 확대

- 2026-04-13 사이드배너 1개 회귀 버그 수정
  - `src/app/blog/[slug]/page.tsx` 링크 추출 캡처 인덱스 오류(`match[1]`)를 URL 인덱스(`match[2]`)로 수정
  - 프로바이오틱스/푸드실러 포스트 모두 `images 3 / links 3 / pairs 3` 확인

- 2026-04-13 프로바이오틱스 사이드배너 3개 노출 보정
  - `src/app/blog/[slug]/page.tsx`: escaped 링크 텍스트가 포함된 CTA도 파싱하도록 링크 정규식 보강
  - 프로바이오틱스 포스트에서 제품 추출 수 3개 확인 후 사이드배너 3개 노출 보장
  - `src/components/ProductSidebarBanner.tsx`: 배너 상단 라벨을 제품명으로 변경하고 폰트 가독성 강화

- 2026-04-13 프로바이오틱스 초이스 후속 보정
  - `src/content/life/2026-04-13-choice-probiotics-api-curation.md`: 하단 2개 상품을 GFM 가로 비교 테이블로 교체, `오늘의 추천 장비` 문구 제거, 히어로 비노출(`image: ""`) 처리
  - `src/app/blog/[slug]/page.tsx`: 사이드바 제품 추출 정규식 보강(escaped alt 대응), CTA 링크를 `link.coupang.com/re/`로 제한해 제품 누락/오매칭 방지
  - `scripts/generate-choice-post.js`: legacy 세로 상품 블록을 제거 후 표준 Pick+비교 섹션 주입하도록 정규화 단계 추가

- 2026-04-13 초이스 상세/생성기 후속 수정
  - `src/app/blog/[slug]/page.tsx`: choice 멀티상품 글 히어로 숨김, 본문 첫 이미지 유지, 하단 중복 고지문 삭제
  - `scripts/generate-choice-post.js`: 본문 말미 고지문 자동 추가 제거, 용어 통일(오늘의 추천 상품), 비교 섹션 제목 4종 랜덤/연결 문구 반영
  - `src/content/life/2026-04-13-choice-kitchen-food-sealer.md`: 하단 2개 상품을 GFM 2열 비교 테이블로 변경, 중복 고지문 제거
  - 생성기 문법 오류(`Unexpected end of input`) 복구 및 실행/빌드 검증 완료

- 2026-04-13 초이스 섹션 제목 정책 보정
  - `scripts/generate-choice-post.js`에서 메인 1번 상품 제목은 `오늘의 픽 (Pick of the Day)`로 유지
  - 하단 2개 상품 섹션에만 4개 제목 랜덤 정책을 적용

- 2026-04-13 초이스 상세 사이드바 다중 배너 반영
  - `src/app/blog/[slug]/page.tsx`에서 본문 마크다운의 제품 이미지 + 쿠팡 링크를 추출해 사이드바에 순차 노출
  - 단일 배너 frontmatter 기반 렌더링은 fallback으로 유지
  - 자동 3상품 생성 포스트의 사이드바 형평성 개선(모든 제품 노출)

- 2026-04-14 초이스 포스트 레이아웃 개선
  - `scripts/generate-choice-post.js`: 멀티상품 포스트에서 히어로 중복 제거(`image=''`), Pick of the Day 블록(1번 상품), 비교 테이블(2·3번 상품) 삽입 로직으로 재구성
  - `src/app/globals.css`: `.choice-post-prose` 기반 본문 이미지 `max-width:220px`, 테이블 이미지 `max-width:160px` 적용
  - `src/app/blog/[slug]/page.tsx`: OG 이미지 fallback을 `post.image || post.coupangBannerImage`로 보강, choice 본문에 `choice-post-prose` 조건부 클래스 적용
  - `src/components/life/ChoiceArticleCard.tsx`: choice 본문에 `choice-post-prose` 클래스 적용

### 2026-04-08 기준 핵심 요약

- 2026-04-13 쿠팡 API 초이스 자동화 반영
  - `scripts/lib/coupang-api.js` 신규 추가: 쿠팡 파트너스 Search API HMAC 서명 + 상품 검색 정규화 구현
  - `scripts/generate-choice-post.js`에 `keywordHint` 기반 자동 상품 검색, 본문 상품 이미지/CTA 자동 주입, API 실패 fallback, 품질 검증/재시도 로직 추가
  - 금지 표현 자동 치환 + 키워드/상품 관련도 랭킹(신호 가중치 기반) 보강으로 자동 생성 안정성 향상
  - `scripts/generate-choice-posts-auto.js` + `scripts/choice-auto-topics.json` 추가로 일일 자동 발행 주제 로테이션 구성
  - `.github/workflows/deploy.yml` full 모드에 `[2.5단계] 픽앤조이 초이스 자동 생성` 통합
  - `scripts/write-daily-report.mjs`에 초이스 단계 결과 및 초이스/맛집 생성 분리 집계 반영
  - API 전용 샘플 입력 `scripts/choice-input.probiotics-api.json` 추가
  - 자동 생성 샘플 포스트 `src/content/life/2026-04-13-choice-probiotics-api-curation.md` 발행 및 build 검증 완료
  - 자동 생성 샘플 포스트 `src/content/life/2026-04-13-choice-kitchen-food-sealer.md` 추가 검증 완료

- 2026-04-13 지침 보강 반영
  - `.github/copilot-instructions.md`에 전역 정보 효용성 규칙 강화(인천/축제/맛집 공통 7일 선행 원칙)
  - 종료 임박/종료 데이터 원천 차단 및 예외 보고 의무 명시
  - 맛집 포스트 톤앤매너 재발 방지 규칙 추가(금지어/금지 패턴/스타일 로테이션/자가검수 재생성)

- 2026-04-13 자동화 스크립트 실반영
  - `scripts/generate-life-restaurant-posts.mjs` 프롬프트에서 동선/답/고민 유도 문구 및 예시 제거
  - 훅/소제목 전용 금지어/금지패턴 검증 추가, 위반 시 재생성 후 치명 이슈는 저장 차단
  - source_id 기반 스타일 키(Sensory/Discovery/Curation/Aesthetic) 주입으로 훅 톤 반복 완화
  - 생성 날짜를 KST 기준으로 통일(`getTodayKST`)

- 2026-04-12 초이스 발행 반영
  - 쿠팡 태그 기반 신규 포스트 생성: `2026-04-12-choice-lapomme-dual-coretex-airhole-pouch-6pack.md`
  - 사용자 제공 이미지 2종을 `public/images/choice/dual-core-hero.png`, `public/images/choice/dual-core-detail.png`로 반영
  - 생성 입력 파일 `scripts/choice-input.lapomme-dual-coretex.json` 추가
  - 생성본의 CTA 링크 누락을 후처리로 수정하고, 중간 이미지 1장 + CTA 1회 규칙으로 보정
  - `npm run build` 성공 및 커밋/푸시 완료 (원격 선행 커밋은 rebase 후 반영)

- 2026-04-11 후속 안정화 반영
  - 마크다운 렌더 보정: `바로가기` 링크가 문장에 붙는 경우 자동 줄바꿈, 숫자 목록 하위 불릿의 코드블록 오인식 보정 (`src/lib/markdown-utils.ts`)
  - 맛집 자동화 균형 강화: `unused 후보 수`뿐 아니라 `서울/인천/경기 버킷 누락`도 재수집 조건으로 확장 (`scripts/generate-life-restaurant-posts.mjs`, `scripts/ensure-life-restaurant-candidates.mjs`)
  - 축제/행사/여행 정보 헤딩 분기: 카테고리 내 콘텐츠 키워드에 따라 `한눈에 보는 축제 정보`/`행사 정보`/`여행 정보` 자동 선택 (`scripts/generate-blog-post.js`)
  - 벚꽃 배경 하이브리드 적용: 데스크톱 `fixed`, 모바일/태블릿 `scroll` + 연핑크 fallback 배경색 (`src/app/globals.css`)
  - 본문 가독성 개선: 블로그/일상의 즐거움 상세 공통(`.blog-prose`, `.prose`)에서 h2/h3 간 간격 확대, 첫 훅(h2)만 예외 처리

- 2026-04-10 긴급 안정화 반영
  - 만료 보조금 자동 감지 보강: `scripts/collect-subsidy.js`, `scripts/cleanup-expired.js`에서 `(YYYY.MM.DD.한)` 패턴을 파싱해 과거 기한 항목을 자동으로 `expired: true` 처리
  - 만료 항목 정리: `서비스ID 131200000013`(사회적기업 지방세 감면)을 `expired: true`로 수정, 연관 포스트 삭제
  - 맛집 생성 실패 방지: `scripts/generate-life-restaurant-posts.mjs`를 `GEMINI_MODEL` 환경변수 기반으로 전환(기본 `gemini-2.5-flash-lite`), GitHub Actions 3단계 수집/생성 env 모두 `gemini-2.5-flash-lite` 고정
  - 모델 하드코딩 재발 방지: 주요/보조 생성 스크립트에 `ALLOW_GEMINI_PRO` 가드 적용, 스크립트 전반의 Gemini 모델 참조를 env 기반으로 통일

- 맛집 후보 재수집 정책 조정
  - 04:00 자동화에서 매일 무조건 `collect-life-restaurants.mjs`를 실행하지 않도록 변경
  - 새 점검 스크립트 `scripts/ensure-life-restaurant-candidates.mjs`가 기존 스냅샷 후보와 기발행 포스트를 비교해 unused 후보가 10건 이상이면 생략, 10건 미만일 때만 재수집 수행
  - 리포트/텔레그램에서 오늘 재수집이 실제로 있었는지 `실행/생략`으로 확인 가능

- 맛집 발행 구조 유지 기준 명문화
  - 기본 구조: `Kakao 수집 -> Supabase 평점 캐시 -> restaurants.json -> 맛집 블로그 생성`
  - DB 직결 전환은 `restaurants_cache` 1,000건 이상, 스냅샷 성능 이슈, 동적 기능 요구가 확인될 때만 검토
- 절감 지표 모니터링 추가
  - 수집 단계에서 `cache_hit`, `cache_miss`, `google_called`를 집계
  - 일일 리포트 및 텔레그램 요약 메시지에 동일 지표를 노출해 비용 절감 효과를 수치로 추적

- Supabase 기반 맛집 평점 캐시 도입
  - `scripts/collect-life-restaurants.mjs`에 `@supabase/supabase-js` 연동
  - `restaurants_cache`에서 `kakao_id` 캐시 조회 후 hit면 Google Places 호출 생략
  - miss 시 Google 호출 후 결과(`place_id`, `rating`, `user_rating_count`)를 `upsert`
  - DB 통신 오류 시 try/catch로 로깅 후 기존 Google 호출 흐름으로 fallback 유지
- 환경변수 파일 운영 기준 통일
  - 로컬 민감키는 `.env.local` 단일 사용, `.env` 미사용 원칙
  - `.github/copilot-instructions.md`에 원칙 반영

- 맛집 수집 API 비용 최적화
  - `scripts/collect-life-restaurants.mjs`에서 Gemini 요약 모델을 환경변수 기반으로 전환 (`RESTAURANT_GEMINI_MODEL` -> `GEMINI_MODEL` -> `gemini-1.5-flash`)
  - Google Places Text Search FieldMask를 `places.id`, `places.rating`, `places.userRatingCount`만 요청하도록 최소화
  - 영업상태/가격/타입/영업시간 필드 조회 제거로 요청 payload 및 비용 부담 완화

- 관리자 GitHub Actions 로그 링크 로그인 경유 적용
  - `src/lib/github-auth-link.ts` 추가
  - `src/app/admin/page.tsx`, `src/app/admin/runs/page.tsx`에서 GitHub 로그 링크를 `https://github.com/login?return_to=...` 형태로 변경
- 관리자 보안 구조 점검 결론
  - 본 프로젝트는 정적 export 배포라 Next.js `middleware.ts`를 실보안 계층으로 사용할 수 없음
  - `/admin` 경로 보안은 Cloudflare Access 경로 정책(`/admin`, `/admin/`, `/admin/*`)을 정확히 묶어 관리하는 방식이 필요
- 네비 메뉴 설명 문구 고급화
  - `src/app/incheon/page.tsx`, `src/app/subsidy/page.tsx`, `src/app/festival/page.tsx`, `src/app/life/page.tsx`, `src/app/blog/page.tsx`
  - 설명을 "목록 안내"에서 "사용자 혜택/큐레이션" 중심 문장으로 교체
  - 제목-설명 간격 `mt-3`, 설명 텍스트 `text-gray-500`로 통일
- 상단 여백 배경 복구
  - `src/components/PageContentShell.tsx`에 `bg-cherry-blossom` 추가
  - 비홈 페이지 네비 아래 추가 여백의 흰색 노출 이슈 해소
- 공통 상단 여백(홈 제외) 일괄 적용
  - `src/components/PageContentShell.tsx` 신규 추가, `src/app/layout.tsx`에서 연결
  - 홈(`/`)은 기존 유지, 비홈 페이지는 `pt-8 md:pt-10` 상단 여백 추가
- 일상의 즐거움 탭 라벨 명확화
  - `src/components/LifeFilterClient.tsx`: `맛집 탐방` -> `서울·인천·경기 맛집 탐방`
- 인천 리스트 헤더 타이틀 미세 보정
  - `src/app/incheon/page.tsx`: 타이틀 아이콘과 텍스트 간격 `gap-2 -> gap-3`
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
  - 맛집 카드 카피 개선: 반복 템플릿형 summary를 감지해 `scenarioHint`/`vibeHint`/`cuisineHint`/평점 기반 상황형 문장으로 대체하는 보정 로직을 추가함

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

- 현재 상태:
  - `src/lib/coupang-partners-config.ts`에 정책/검증 유틸 정리 완료
  - `scripts/lib/coupang-api.js`와 `scripts/generate-choice-post.js`를 통해 키워드 기반 초이스 자동 생성 1차 구현 완료
- 다음 단계:
  - [x] 쿠팡 API 발급 후 실제 엔드포인트/인증값으로 설정 확정
  - [x] 초이스 생성 스크립트에 API 검색/본문 주입 통합
  - [ ] GitHub Actions 워크플로우에 초이스 자동 생성 단계 통합
  - [ ] 링크 무결성(파트너 ID/subId/URL 형식) 자동 검증 추가
  - [ ] 카테고리별 키워드 도출 정밀화 및 상품 관련도 랭킹 개선
