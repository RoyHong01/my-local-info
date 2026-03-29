# CLAUDE.md — 픽앤조이 프로젝트 가이드

> 작업 시작 시 반드시 읽기. 상세 작업 이력은 `WORK_LOG.md` 참조.

## 프로젝트 기본 정보
- 사이트명: 픽앤조이 (pick-n-joy.com)
- 슬로건: "오늘의 일상을 Pick, 오늘의 주말을 Enjoy!"
- 로컬 경로: D:\Dev\my-local-info
- GitHub: https://github.com/RoyHong01/my-local-info
- 배포: Cloudflare Pages (https://my-local-info-2gs.pages.dev → pick-n-joy.com)

## 기술 스택
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Claude API (claude-haiku-4-5) → 인천/보조금/축제 데이터 description 생성
- Gemini API (gemini-2.5-pro) → 블로그 글 자동 생성 (MZ 감성 + 정보 완전성 규칙)
- 공공데이터포털 API + 한국관광공사 TourAPI → 데이터 수집
- GitHub Actions → 매일 07:00 KST 자동 실행 (cron: `0 22 * * *`)
- Cloudflare Pages (wrangler) → 빌드 후 자동 배포

## 환경변수 (.env.local)
| 변수 | 용도 | 상태 |
|------|------|------|
| ANTHROPIC_API_KEY | Claude API 데이터 description 생성 | ✅ |
| GEMINI_API_KEY | Gemini API 블로그 글 생성 | ✅ |
| PUBLIC_DATA_API_KEY | 공공데이터포털 (보조금4, 인천) | ✅ |
| TOUR_API_KEY | 한국관광공사 TourAPI | ✅ |
| KAKAO_API_KEY | 카카오 로컬 API 호환용 | ✅ |
| KAKAO_REST_API_KEY | 일상의 즐거움 맛집 수집용 카카오 로컬 API | ✅ |
| NEXT_PUBLIC_GA_ID | Google Analytics | ✅ G-6VNKGES4FW |
| NEXT_PUBLIC_ADSENSE_ID | Google AdSense | 미설정 |
| NEXT_PUBLIC_COUPANG_PARTNER_ID | 쿠팡 파트너스 | ✅ AF5831775 |

## GitHub Actions Secrets
- CLOUDFLARE_API_TOKEN ✅
- CLOUDFLARE_ACCOUNT_ID ✅
- PUBLIC_DATA_API_KEY ✅
- TOUR_API_KEY ✅
- ANTHROPIC_API_KEY ✅
- GEMINI_API_KEY ✅
- KAKAO_REST_API_KEY ✅

## API 엔드포인트
- 보조금4: https://apis.data.go.kr/1741000/Subsidy24
- TourAPI: https://apis.data.go.kr/B551011/KorService2

## 콘텐츠 카테고리 & 데이터
| 카테고리 | 데이터 파일 | 상태 |
|----------|------------|------|
| 인천 지역 정보 | public/data/incheon.json | ✅ |
| 전국 보조금·복지 | public/data/subsidy.json | ✅ |
| 전국 축제·여행 | public/data/festival.json | ✅ |
| 전국 맛집 | src/app/life/restaurant/data/restaurants.json | ✅ (카카오 API + Gemini 스냅샷) |

## 만료 처리 방식
- 삭제 하지 않음 (SEO 보존) → `expired: true` 마킹
- 목록 페이지: expired 항목 필터링
- 상세 페이지: "종료된 행사" 배너 표시

## 폴더 구조
```
src/app/
  page.tsx              # 메인 (멀티카테고리)
  incheon/page.tsx      # 인천 지역 정보 목록
  incheon/[id]/page.tsx # 인천 상세
  subsidy/page.tsx      # 전국 보조금 목록
  subsidy/[id]/page.tsx # 보조금 상세
  festival/page.tsx     # 전국 축제·여행 목록
  festival/[id]/page.tsx# 축제 상세
  blog/page.tsx         # AI 블로그 목록
  blog/[slug]/page.tsx  # 블로그 상세
  rss.xml/route.ts      # RSS 피드
  about/page.tsx        # 소개 페이지

src/components/
  BlogFilter.tsx        # 블로그 카테고리 필터 (use client, URL 파라미터 방식)
  IncheonCardList.tsx   # 인천 카드 목록 (use client, 스크롤 저장)
  SubsidyCardList.tsx   # 보조금 카드 목록 (use client, 스크롤 저장)
  FestivalCardList.tsx  # 축제 카드 목록 (use client, 스크롤 저장)
  ScrollRestorer.tsx    # 스크롤 위치 복원 (use client, storageKey prop)
  TaeheoAdBanner.tsx    # 태허철학관 배너 (가로형 + 도장 로고)
  CoupangBanner.tsx     # 쿠팡 사이드바 배너 240x600 (공식 iframe 방식)
  CoupangBottomBanner.tsx # 쿠팡 하단 배너 680x300 (공식 iframe 방식)
  AdBanner.tsx          # Google AdSense 배너 (ADSENSE_ID 없으면 null)

scripts/
  collect-incheon.js    # 인천 데이터 수집
  collect-subsidy.js    # 보조금 데이터 수집
  collect-festival.js   # 축제 데이터 수집 (overview 포함)
  collect-life-restaurants.mjs # 일상의 즐거움 맛집 스냅샷 수집
  generate-life-restaurant-posts.mjs # 맛집 전용 블로그 포스트 생성
  generate-blog-post.js # Claude API 블로그 자동 생성 (카테고리당 2편)
  cleanup-expired.js    # 만료 콘텐츠 처리
  generate-sitemap.js   # sitemap.xml 생성 (postbuild)

public/
  data/                 # incheon.json, subsidy.json, festival.json
  images/               # 공식 포스터 이미지 저장소

.github/workflows/
  deploy.yml            # push 또는 07:00 KST 자동 배포

e2e/
  blog-filter.spec.ts   # 블로그 카테고리 필터 유지 E2E

playwright.config.ts    # Playwright 실행 설정 (CI/로컬 공용)

src/app/life/restaurant/data/
  restaurants.json      # 카카오 API + Gemini 기반 맛집 스냅샷 데이터
```

## 작업 규칙
1. 작업 시작 시 이 파일(CLAUDE.md) 먼저 읽기
2. 새 파일 생성 시 폴더 구조 섹션 업데이트
3. 새 환경변수·Secret 추가 시 해당 섹션 업데이트
4. **커밋 전 반드시 `npm run build` 실행** → 빌드 오류 확인
5. **커밋 시 새 파일 누락 주의**: `git status`로 untracked 파일 확인 후 명시적으로 `git add`
6. 빌드 성공 후 `git add [파일목록] → git commit → git push` 순서로 배포
7. Copilot 병행 시 `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md` 읽기
8. **세션 종료 시**: `WORK_LOG.md`에 날짜·작업 요약 추가
9. **수동 블로그 작성 시 이미지 우선순위 규칙:**
   - 1순위: 공식 행사 포스터 이미지 (`public/images/`에 저장)
   - 2순위: TourAPI 이미지 (`festival.json`의 `firstimage` 필드)
     - 검색: `public/data/festival.json`에서 해당 축제명 → `firstimage` URL 추출
     - URL 형식: `https://tong.visitkorea.or.kr/cms/resource/...`
   - 3순위: 카테고리 기본 SVG — 1,2순위 없을 때만 사용
   - ※ **절대 사용 금지**: Unsplash 외부 이미지 (주제 무관 사진 나올 수 있음)

## 블로그 글 생성 스타일 가이드 (2026-03-29 고정)
- 페르소나: 30대 초반 여행·생활정보 에디터 (친절한 형/오빠 톤)
- 종결어미: 경어체 필수 (~해요/~거든요/~입니다), 평어체(~이다/~한다) 절대 금지
- AI 금지어: 결론적으로/다양한/인상적인/포착한/대명사가 됐다 등
- 감성 묘사: 정보 나열 전 시각적 묘사·현장 기분 먼저
- 마무리: "함께 가면 좋은 사람" 공식 추천 문구 금지 → 작가 주관적 한 줄 평 또는 특정 상황 여운으로 끝내기
- 유지 항목: 정보완전성 규칙, image 처리, FILENAME 형식, ### 1.2.3. 구조
- [전국 축제·여행 전용 추가 규칙] (다른 카테고리에는 미적용)
  - 제목: 연도(2026 등)/완전정복/총정리 금지, 핵심 즐길 거리 조합한 스토리텔링형
  - 소제목: 숫자 번호(1. 2. 3.) 금지, 감성 소제목으로 자유롭게 2~4개
  - 분리선(---/***): 글 전체에서 최대 1회만 허용

## 블로그 현황 (2026-03-29 기준)
- 총 28편: 인천 지역 정보 9편, 전국 보조금·복지 9편, 전국 축제·여행 9편, 기타 1편
- 자동 생성: GitHub Actions 매일 07:00 KST, 카테고리당 2편 (Gemini 2.5 Pro, MZ 감성)
- 2026-03-28: 진해군항제 수동 중복 제거(1편 삭제) → 고창청보리밭 축제 추가(1편)
- 2026-03-28: 인천 봄꽃 축제 중복 제거(1편 삭제), 유지본 제목·이미지·source_id 수정
- 2026-03-28: 블로그 썸네일 TourAPI 실제 이미지로 교체 (진해/여의도/경포/구례/광안리)
- 2026-03-29: 전국 축제·여행 블로그 11편 Gemini 스타일 재작성 (경어체 통일, 번호 소제목 제거, 분리선 최대 1회, 제목 연도·총정리 제거)

## 최신 동기화 메모 (2026-03-29 추가-4)

- **맛집 자동생성 6건 분배 로직 고정** (`f337cf5`):
  - `scripts/generate-life-restaurant-posts.mjs`
    - 일일 생성 수를 `LIFE_RESTAURANT_POSTS_PER_RUN=6` 기준으로 고정
    - 버킷 분배 로직 추가: `서울 2 / 인천 2 / 경기기타 2` 우선 선발
    - 주소/쿼리 기반 `seoul | incheon | gyeonggi-other` 분류 함수 추가
    - 버킷 후보 부족 시 경고 로그 출력
  - `.github/workflows/deploy.yml`
    - `LIFE_RESTAURANT_POSTS_PER_RUN: '6'`
    - `LIFE_RESTAURANT_POSTS_PER_BUCKET: '2'` 추가
  - 검증: `node --check` 통과, `npm run build` 성공, 커밋/푸시 완료

- **맛집 글 생성 규칙 3차 고도화** (`a42ee87`):
  - `scripts/generate-life-restaurant-posts.mjs`
    - 실행당 생성 건수: 기본 2건 → **3~5건 클램프**(`LIFE_RESTAURANT_POSTS_PER_RUN`, 기본 3)
    - 저장 경로를 `src/content/posts` → `src/content/life`로 전환
    - slug 규칙 강화: `지역명-상호명` 영문 조합 기반 slug 생성(`songdo-...` 형태)
    - 파일명은 날짜 접두 유지(`YYYY-MM-DD-slug.md`), frontmatter `slug`는 영문 조합값 유지
    - 프롬프트 훅을 도발형으로 강화, 금지어/감각 묘사/동선 가이드 규칙 보강
  - `scripts/collect-life-restaurants.mjs`
    - 키워드 확장: 오마카세/퓨전한식/화덕피자 추가
    - Google 평점 strict 컷오프: **평점 미확인 업장 제외 + 4.2 미만 제외**
  - `src/lib/posts.ts`: `src/content/posts` + `src/content/life`를 함께 읽도록 확장
  - `.github/workflows/deploy.yml`: `LIFE_RESTAURANT_POSTS_PER_RUN` 기본값 `3`으로 상향
  - 검증: `node --check` 통과, `npm run build` 성공

- **맛집 엔진 고도화 — Google Places API 평점 필터 + 프롬프트 업그레이드** (`8a98b87`):
  - `scripts/collect-life-restaurants.mjs`: Kakao 20개 추출 → Google Places API (New) 평점 4.2+ 필터 → 상위 15개 → Gemini 요약
    - 필드 마스크: `places.rating,places.userRatingCount` (비용 최적화)
    - restaurants.json에 `googleRating` / `googleRatingCount` 추가
  - `scripts/generate-life-restaurant-posts.mjs`:
    - googleRating 있으면 `rating_value` / `review_count` frontmatter 자동 삽입 → JSON-LD `aggregateRating` 자동 연결
    - 프롬프트: 조도·공간감·음식 결 감각적 묘사 2개 이상 규칙 추가
    - 프롬프트: 방문 정보 박스에 "식사 후 동선" 항목 추가
  - `.github/workflows/deploy.yml`: `GOOGLE_PLACES_API_KEY` Secret 추가 (GitHub Actions Secrets에도 추가 필요)
  - 검증: `npm run build` 성공, 커밋/푸시 `8a98b87`

## 최신 동기화 메모 (2026-03-29 추가)
- **일상의 즐거움 맛집 자동화 파이프라인 추가**:
  - `src/lib/life-restaurants.ts`: 찐맛집/현지인/줄서는 식당 키워드 기반 수집으로 고도화, 지역당 15개 상한, Gemini 문제해결형 서사 요약 반영
  - `scripts/collect-life-restaurants.mjs`: 카카오 API + Gemini로 맛집 스냅샷 생성 → `src/app/life/restaurant/data/restaurants.json` 저장
  - `scripts/generate-life-restaurant-posts.mjs`: `픽앤조이 맛집 탐방` 카테고리 전용 블로그 포스트 생성 (지역+상황+보상 제목, SEO용 slug/description/frontmatter, 페인포인트→발견→디테일→팁 구조)
  - `/life` 페이지는 생성된 맛집 포스트가 있으면 우선 노출, 없으면 카카오맵 직접 링크 카드로 fallback
  - `.github/workflows/deploy.yml`에 맛집 수집/포스트 생성 스텝 추가
  - `src/app/blog/[slug]/page.tsx`에 맛집 `Restaurant` / 초이스 `Product` JSON-LD 추가 (별점/리뷰수는 검증 가능한 값이 있을 때만 삽입)

- **맛집 자동화 2차 톤 리프레시**:
  - `scripts/collect-life-restaurants.mjs`, `src/lib/life-restaurants.ts`를 2030 핫플형 검색어 세트로 재구성
    - 예: 송도 브런치 카페 / 성수동 팝업 근처 맛집 / 연남동 내추럴 와인바 / 망원동 에스프레소 바
  - 검색 결과에 `sourceQuery`, `scenarioHint`, `vibeHint`, `cuisineHint` 메타데이터를 함께 저장하고 trend score로 우선순위 정렬
  - `scripts/generate-life-restaurant-posts.mjs` 프롬프트를 교과서형 설명 대신 "저장해둘 만한 핫플 큐레이션" 톤으로 재작성
  - `FORCE_RESTAURANT_SOURCE_IDS` 환경변수로 특정 source_id 포스트 재생성 가능
  - 저품질 초기 맛집 포스트 2건 제거 후 신규 2건 발행:
    - `2026-03-29-인천-젠젠-본점.md`
    - `2026-03-29-서울-미테이블-성수본점.md`
- **실제 전국 축제·여행 포스트 2편 발행 완료**:
  - `2026-03-29-gangjin-jeollabyeongseong-festival.md`
  - `2026-03-29-jindo-canolaflower-festival.md`
- **SEO 강화** (`src/app/blog/[slug]/page.tsx`):
  - 메타 설명을 본문 첫 문장 기반으로 생성
  - JSON-LD에 `articleSection`, `about`, `additionalType`, `keywords`, `inLanguage` 확장
- **Playwright 최소 E2E 도입 및 배포 전 게이트 연결**:
  - `playwright.config.ts`, `e2e/blog-filter.spec.ts` 추가
  - `BlogFilter.tsx`, `BlogBackButton.tsx`에 `data-testid` 반영
  - `.github/workflows/deploy.yml`에 배포 전 E2E 테스트 단계 추가
- **블로그 생성 안정화** (`scripts/generate-blog-post.js`):
  - `maxOutputTokens` 4096 상향
  - 불완전 응답 감지(`finishReason`, 길이/종결/파일명 검사) + 최대 3회 재시도
- **검증/반영 완료**:
  - `npm run build` 성공
  - `npm run test:e2e` 성공
  - 커밋/푸시: `da64479` (`main`)

## 쿠팡 파트너스 배너 현황 (2026-03-29 최종)
- 파트너ID: AF5831775
- 사이드바: id **976244** (고객 관심 기반 추천), 240x600, `CoupangBanner`
  - src: `https://ads-partners.coupang.com/widgets.html?id=976244&template=carousel&trackingCode=AF5831775&subId=&width=240&height=600&tsource=`
  - 배너명: `픽앤조이_사이드바_여행_최종`
- 하단: id 976089 (카테고리 베스트 - 패션의류/잡화), 680x300, `CoupangBottomBanner`
  - src: `https://ads-partners.coupang.com/widgets.html?id=976089&template=carousel&trackingCode=AF5831775&subId=&width=680&height=300&tsource=`
  - 배너명: `픽앤조이_본문하단_여행캠핑`
- 구현 방식: **파트너스 공식 iframe URL 직접 사용** (사이드바·하단 모두 통일)
  - `referrerPolicy="unsafe-url"` 필수 (트래킹 정상 동작)
  - `CoupangBanner.tsx`에 `'use client'` 추가 → Hydration mismatch 해결
  - `bannerId` prop은 인터페이스 호환용으로만 유지 (실제 미사용)
- 적용 페이지: blog목록/상세, incheon목록/상세, subsidy목록/상세, festival목록/상세, about (총 9곳)
- 해결 과정: useEffect+g.js → same-origin iframe → 직접 iframe URL → `'use client'` 추가 + ID 교체 (최종 해결)
- **실제 원인**: 코드/구조 문제 아님 → 구 ID(976088, 976244 초기발급분) 자체가 Coupang 측에서 비정상 상태. 하단 배너 ID로 사이드바 테스트 시 즉시 정상 작동 확인 → 새 ID 발급으로 해결
- 공정위 문구: 전 페이지 footer에 추가 완료
- 구 ID 976088 → 중간 ID → 현재 976244 (새 발급): Coupang 파트너스 측 활성화 문제

## 다음 작업 예정
- ~~Google Analytics (GA ID) 설정~~ ✅ 완료
- ~~쿠팡 파트너스 배너 삽입~~ ✅ 완료
- Google AdSense 신청 (페이지 15개 이상 완료)
- 에러 핸들링 및 자동화 모니터링
- 맛집 포스트 이미지 전략 고도화 (검증 가능한 이미지 소스 확보 후)
