# 픽앤조이 (pick-n-joy.com) — Copilot 프로젝트 가이드

> GitHub Copilot이 이 프로젝트 작업 시 항상 먼저 읽어야 할 파일입니다.
> Claude Code는 CLAUDE.md를 사용합니다. 둘 중 어느 도구로 작업하든 양쪽 파일을 동기화 상태로 유지해주세요.

## 프로젝트 기본 정보
- 사이트명: 픽앤조이 (pick-n-joy.com)
- 슬로건: "당신의 일상을 Pick, 당신의 주말을 Enjoy!"
- GitHub: https://github.com/RoyHong01/my-local-info
- Cloudflare Pages URL: https://my-local-info-2gs.pages.dev
- 최종 도메인: https://pick-n-joy.com

## 기술 스택
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- 정적 HTML 배포 (`next.config.ts`의 `output: "export"`, `trailingSlash: true`)
- Gemini API (gemini-2.5-pro) — 블로그 글 자동 생성
- Claude API (claude-haiku-4-5) — 데이터 description_markdown 생성
- 공공데이터포털 API + 한국관광공사 TourAPI — 데이터 수집
- GitHub Actions — 매일 07:00 KST 자동 실행
- Cloudflare Pages — 호스팅 및 배포

## 환경변수 (.env.local)
- ANTHROPIC_API_KEY: Claude API 데이터 본문(description_markdown) 생성
- GEMINI_API_KEY: Gemini API 블로그 생성
- PUBLIC_DATA_API_KEY: 공공데이터포털 (보조금24, 인천 데이터)
- TOUR_API_KEY: 한국관광공사 TourAPI
- KAKAO_API_KEY: 카카오 로컬 API 호환용
- KAKAO_REST_API_KEY: 일상의 즐거움 맛집 수집용 카카오 로컬 API
- NEXT_PUBLIC_ADSENSE_ID: Google AdSense (미설정)
- NEXT_PUBLIC_GA_ID: Google Analytics (✅ G-6VNKGES4FW)
- NEXT_PUBLIC_COUPANG_PARTNER_ID: 쿠팡 파트너스 (✅ AF5831775)

## API 엔드포인트
- 보조금24: https://apis.data.go.kr/1741000/Subsidy24
- TourAPI (KorService2): https://apis.data.go.kr/B551011/KorService2
  - searchFestival2: 축제 목록 조회
  - detailCommon2: 축제 상세 설명(overview) 조회 (defaultYN, overviewYN 파라미터 사용 금지 — KorService2에서는 기본 포함)
- 카카오 로컬: https://dapi.kakao.com/v2/local/search/keyword.json

## 콘텐츠 카테고리 & 데이터 파일
1. 인천 지역 정보 → `public/data/incheon.json`
2. 전국 보조금·복지 → `public/data/subsidy.json`
3. 전국 축제·여행 → `public/data/festival.json`
4. 전국 맛집 → `src/app/life/restaurant/data/restaurants.json` (카카오 API + Gemini 스냅샷)

## 만료 처리 방식
- 파일 삭제 X (SEO 보존)
- frontmatter의 `expired: true` 마킹
- 목록 페이지에서 expired 항목 제외
- 상세 페이지에서 "종료된 행사" 배지 표시

## 핵심 폴더 구조
```
src/app/
  page.tsx            # 메인 (멀티카테고리)
  incheon/            # 인천 지역 정보 목록 + [id] 상세
  subsidy/            # 전국 보조금 목록 + [id] 상세
  festival/           # 전국 축제·여행 목록 + [id] 상세
  blog/               # AI 블로그 목록 + [slug] 상세
  rss.xml/            # RSS 피드 (route.ts)
  about/              # 소개 페이지
src/components/
  BlogFilter.tsx      # 블로그 카테고리 필터 (use client)
src/lib/
  posts.ts            # PostData 인터페이스, 블로그 파싱 (image 필드 포함)
src/content/posts/    # 블로그 마크다운 파일들
scripts/
  collect-incheon.js  # 인천 데이터 수집
  collect-subsidy.js  # 보조금 데이터 수집
  collect-festival.js # 축제 데이터 수집 (detailCommon2로 overview 포함)
  collect-life-restaurants.mjs # 일상의 즐거움 맛집 스냅샷 수집
  generate-life-restaurant-posts.mjs # 맛집 전용 블로그 포스트 생성
  generate-blog-post.js # Claude API 블로그 생성 (카테고리별 2편)
  cleanup-expired.js  # 만료 콘텐츠 처리
  generate-sitemap.js # sitemap.xml 생성 (postbuild)
.github/workflows/
  deploy.yml          # 매일 07:00 KST 자동화
public/images/        # 기본 OG 이미지 4종 (SVG)
```

## 작업 규칙
1. 작업 전 이 파일과 CLAUDE.md, PROJECT_MEMORY.md, COPILOT_MEMORY.md를 먼저 확인
2. 새 파일 생성 시 CLAUDE.md 폴더 구조 섹션 업데이트
3. 새 환경변수 추가 시 CLAUDE.md 환경변수 섹션 업데이트
4. `npm run build` 항상 마지막에 실행해서 빌드 오류 확인
5. 빌드 성공 후 `git add . → git commit → git push` 순서로 배포
6. 세션 종료 시 CLAUDE.md, PROJECT_MEMORY.md, COPILOT_MEMORY.md, 이 파일(copilot-instructions.md) 모두 업데이트
7. **항상 적용할 종료 루틴(필수)**
  - 코드 변경 작업 완료 후, 반드시 `build 성공 → commit/push → 문서/메모리 동기화` 순서를 수행
  - 문서/메모리 동기화 대상: `CLAUDE.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`
  - 위 루틴 미완료 상태에서는 작업 완료로 보지 않음

## 헤더/네비게이션 패턴
- 헤더는 10개 페이지에 동일 패턴 반복 (컴포넌트 미분리 상태)
- 로고: `text-3xl font-bold text-orange-500` "픽앤조이 🎯"
- 네비: `text-base font-medium text-stone-600`, 간격 `space-x-4 md:space-x-6`
- 메뉴명: 인천시 정보 | 전국 보조금·복지 정책 | 전국 축제·여행 정보 | 블로그

## SEO 현황
- ✅ `<html lang="ko">`, metadataBase, 전 페이지 OG/canonical
- ✅ sitemap.xml (postbuild 자동 생성, pick-n-joy.com 도메인)
- ✅ robots.txt, RSS 피드 (/rss.xml)
- ✅ JSON-LD (블로그 상세)
- ✅ 네이버 서치어드바이저 인증
- ✅ favicon (ico + svg)
- ✅ og:image 자동화 (TourAPI firstimage + 카테고리별 기본 SVG)

## 최근 동기화 메모 (2026-03-27)
- 축제 상세 설명 복구: `collect-festival.js` overview 절삭 제거로 원문 보존
- 오래된 샘플 3건(`festival-001~003`) 정리: API 원본 매핑/교체 + 매칭 실패 샘플 자동 제거
- `festival.json`은 API 기반 항목 중심으로 재정리 (중복 제거 포함)
- 상세 페이지 typography/prose 적용: `@tailwindcss/typography` 활성화 + 상세 4페이지 본문 가독성 강화
- 상세 페이지 폭 조정: `max-w-5xl → 7xl → 6xl`로 사용자 피드백 기반 미세 조정
- 블로그 구조 보정 고도화:
  - 훅(Hook) 우선 시작 규칙 + H1→H2 자동 보정(훅이 메인 제목보다 커 보이지 않게)
  - 번호 소제목(`1.` / `1️⃣`) 자동 헤딩화(`### 1.`) 및 설명 단락 분리
  - 들여쓰기 code block 오인 제거로 좌우 스크롤(`pre`) 이슈 해결
- 상세 콘텐츠 블로그형 전환:
  - `incheon/subsidy/festival` 상세 본문을 Markdown + prose 렌더링 방식으로 통일
  - `description_markdown` 우선 사용 + 기존 데이터 fallback markdown 생성으로 즉시 반영
  - 수집 스크립트에서 Anthropic으로 `description_markdown` 생성(해시 캐시 기반 재생성)
  - `DESCRIPTION_MARKDOWN_BATCH_LIMIT`로 실행당 생성 건수 제한(기본 10건)

### 2026-03-27 (2)

- **description_markdown 전체 백필 완료:**
  - incheon 103/103건, subsidy 103/103건, festival 107/107건 100% 완료
  - Anthropic Haiku 4.5 실측 단가: 입력 $1/MTok, 출력 $5/MTok
  - 10건 기준 실측 비용: ~$0.037 (1건당 ~$0.004, ₩5 수준)
  - 월 예산: 하루 10건 기준 ~$1.10/월 (예산 여유 충분)
  - 커벗: `1041ef9`

### 2026-03-27 (3)

- **카드 UI 전역 인터랙션 적용:**
  - 전역 스타일(`src/app/globals.css`)에 `.menu-card`, `.menu-card-icon` 추가
  - hover 시 미세 확대/배경 틴트/아이콘 톤다운을 인천·보조금·축제·블로그 카드에 공통 적용
  - 접근성 대응: `prefers-reduced-motion` 환경에서 애니메이션 비활성화
- **그리드 높이 조정 재수정:**
  - 인천/보조금 카드에 적용했던 `auto-rows-fr` + `h-full` 강제 높이 로직 제거
  - 카드 크기를 축제/블로그와 유사한 자연 높이로 복구
  - 긴 텍스트는 기존 `line-clamp` 범위 내에서만 노출

## 최근 동기화 메모 (2026-03-29)

- **쿠팡 파트너스 사이드바 배너 최종 확정**:
  - 사이드바 배너 ID: `976088` (미활성화) → `976244` 교체 (배너명: 픽앤조이_사이드바_여행_최종, 고객 관심 기반 추천)
  - `CoupangBanner.tsx`에 `'use client'` 추가 → Server Component에서 발생하던 Hydration mismatch(빈 흰 블록 현상) 해결
  - 하단 배너 ID 976089는 변경 없음 유지
- **블로그 생성 문체 가이드 전면 교체** (`generate-blog-post.js`):
  - 경어체 종결어미(`~해요/~거든요/~입니다`) 필수, 평어체(`~이다/~한다`) 절대 금지
  - AI 금지어 목록 추가, 마무리 공식 문구 폐지 → 작가 주관 한 줄 평으로 변경
  - `date` 필드 Node.js 변수로 직접 주입 (Gemini 임의 날짜 생성 버그 차단)

### 2026-03-29 (추가)

- **일상의 즐거움 맛집 자동화 추가**:
  - `collect-life-restaurants.mjs`: 카카오 로컬 API 정확도순 + 찐맛집/현지인/줄서는 식당 키워드로 지역별 15개 맛집 스냅샷 생성
  - `generate-life-restaurant-posts.mjs`: `픽앤조이 맛집 탐방` 카테고리 전용 포스트 생성 (문제 해결형 서사, 과장/환각 방지 규칙 포함)
  - `/life` 페이지 맛집 탭은 생성 포스트 우선, 없으면 카카오맵 카드 fallback
  - `deploy.yml`에 맛집 수집/포스트 생성 스케줄 단계 추가

- **실제 전국 축제·여행 포스트 2편 발행 완료**:
  - `2026-03-29-gangjin-jeollabyeongseong-festival.md`
  - `2026-03-29-jindo-canolaflower-festival.md`
- **SEO 강화** (`src/app/blog/[slug]/page.tsx`):
  - 메타 description을 본문 첫 문장으로 생성
  - JSON-LD를 카테고리 인지형(`articleSection/about/additionalType/keywords/inLanguage`)으로 확장
- **Playwright 도입 + 배포 전 자동 검증 연결**:
  - `playwright.config.ts`, `e2e/blog-filter.spec.ts` 신규
  - `BlogFilter.tsx`, `BlogBackButton.tsx`에 `data-testid` 추가
  - `deploy.yml`에 Playwright 설치 + 배포 전 E2E 테스트 단계 추가
- **블로그 생성 안정화** (`generate-blog-post.js`):
  - `maxOutputTokens: 4096` 상향
  - 불완전 응답 감지(`finishReason`, 본문 길이, 문장 종결, FILENAME 포함 여부) + 최대 3회 재시도
- **검증/반영 상태**:
  - `npm run build` 성공
  - `npm run test:e2e` 성공
  - 커밋/푸시: `da64479` (`main`)

## 쿠팡 파트너스 배너 현황 (2026-03-29 최종)
- 파트너ID: AF5831775
- 사이드바: id **976244** (고객 관심 기반 추천), 240×600, `CoupangBanner` (`'use client'` 포함)
  - src: `https://ads-partners.coupang.com/widgets.html?id=976244&template=carousel&trackingCode=AF5831775&subId=&width=240&height=600&tsource=`
- 하단: id **976089** (카테고리 베스트 - 패션의류/잡화), 680×300, `CoupangBottomBanner`
  - src: `https://ads-partners.coupang.com/widgets.html?id=976089&template=carousel&trackingCode=AF5831775&subId=&width=680&height=300&tsource=`
- 구현 방식: 파트너스 공식 iframe URL 직접 사용, `referrerPolicy="unsafe-url"` 필수
- 적용 페이지: blog목록/상세, incheon목록/상세, subsidy목록/상세, festival목록/상세, about (총 9곳)

## 백로그
- [x] Google Analytics 설정 ✅
- [x] 쿠팡 파트너스 배너 삽입 ✅
- [ ] Google AdSense 설정
- [ ] 에러 핸들링 및 자동화 모니터링
- [x] 2단계: 전국 맛집 기능 1차 구축 (카카오 API + Gemini 스냅샷 + 맛집 포스트 자동 생성)
