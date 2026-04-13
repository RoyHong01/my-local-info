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
