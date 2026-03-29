# WORK_LOG.md — 픽앤조이 작업 이력

> 상세 작업 이력 보관용. CLAUDE.md에는 포함하지 않음.
> 최신 항목이 위에 오도록 작성.

---

## 2026-03-29

### 일상의 즐거움 맛집 포스트 자동화
- `src/lib/life-restaurants.ts`:
  - 카카오 로컬 API 검색어를 `찐맛집/현지인 맛집/줄서는 식당` 조합으로 고도화
  - 지역별 최대 15개까지 수집, snapshot JSON 우선 로딩 구조 추가
  - Gemini 요약 프롬프트를 문제 해결형 서사 + place_url 문맥 참고 방식으로 강화
- `scripts/collect-life-restaurants.mjs` 신규:
  - 지역별 맛집 스냅샷을 `src/app/life/restaurant/data/restaurants.json`에 저장
- `scripts/generate-life-restaurant-posts.mjs` 신규:
  - `픽앤조이 맛집 탐방` 카테고리 전용 포스트 생성
  - 제목 규칙: 지역 + 상황 + 보상
  - 본문 규칙: 페인 포인트 → 발견 → 디테일 → 팁
  - 주차/웨이팅/인테리어 등 확인 불가 정보는 단정 금지, 필요 시 `확인 필요` 사용
- `src/app/life/page.tsx`:
  - 생성된 맛집 포스트가 있으면 맛집 탭에서 우선 노출
  - 아직 포스트가 없을 때만 카카오맵 외부 링크 카드 fallback
- `.github/workflows/deploy.yml`:
  - 스케줄 시 맛집 스냅샷 수집 후 맛집 포스트 생성 단계 추가
- 검증:
  - `npm run build` 성공
- 반영:
  - 커밋 `4509056` → `main` 푸시 완료

### SEO 보강 + E2E/배포 게이트 + 실포스트 2건 발행
- `src/app/blog/[slug]/page.tsx` SEO 보강:
  - 본문 첫 문장 기반 `description` 생성 로직 추가
  - JSON-LD 확장: `articleSection`, `about`, `additionalType`, `keywords`, `inLanguage`
- Playwright 최소 검증 세트 도입:
  - `playwright.config.ts` 신규
  - `e2e/blog-filter.spec.ts` 신규 (카테고리 필터 유지 동선)
  - `src/components/BlogFilter.tsx`, `src/components/BlogBackButton.tsx`에 `data-testid` 반영
  - `.github/workflows/deploy.yml`에 배포 전 `npm run test:e2e` 단계 추가
- 블로그 생성 안정화 (`scripts/generate-blog-post.js`):
  - `maxOutputTokens` 4096 상향
  - `finishReason`/본문 완결성 검사 + 최대 3회 재시도
- 실제 전국 축제·여행 포스트 2편 발행:
  - `src/content/posts/2026-03-29-gangjin-jeollabyeongseong-festival.md`
  - `src/content/posts/2026-03-29-jindo-canolaflower-festival.md`
- 검증 결과:
  - `npm run build` 성공
  - `npm run test:e2e` 성공
- 반영:
  - 커밋 `da64479` → `main` 푸시 완료

### 블로그 생성 문체 가이드 개선
- `generate-blog-post.js` 프롬프트 문체 섹션 교체:
  - `[Gemini 감성 글쓰기 지침]` → `[글쓰기 스타일 가이드]`
  - 경어체 종결어미 필수 (~해요/~거든요/~입니다), 평어체(~이다/~한다) 절대 금지
  - AI 금지어 목록 추가 (결론적으로/다양한/인상적인 등)
  - 본문 규칙 3번: 경어체 고정 + 현장 묘사 우선으로 교체
- 마무리 문구 유연화: "함께 가면 좋은 사람" 공식 추천 금지 → 작가 주관 한 줄 평 또는 상황 여운으로 교체
- `date` 필드 하드코딩: Gemini 임의 생성 → Node.js `today` 변수 직접 주입 (날짜 오류 재발 방지)
- 논산딸기축제 포스트 수정: date `2024-05-21` → `2026-03-29` 수정, 잘린 본문 완성 재작성

---

## 2026-03-28

### 쿠팡 배너 안정적 재구현 + 상세 페이지 사이드바 추가
- CoupangBanner/CoupangBottomBanner: useEffect + g.js 중복 로드 방지 방식으로 재작성
  - bannerId prop으로 페이지별 고유 id 지정 (기존 id prop → bannerId prop 변경)
  - window.PartnersCoupang 존재 시 즉시 실행, 로드 중이면 500ms 후 시도
- incheon/[id], subsidy/[id], festival/[id] 상세 페이지 사이드바 추가 (TaeheoAdBanner + CoupangBanner)
- 전체 9개 위치 bannerId 고유값 정리:
  - blog-list, blog-detail, incheon-list, incheon-detail, subsidy-list, subsidy-detail, festival-list, festival-detail, bottom-blog

### 쿠팡 배너 next/script 방식으로 재구현 (배너 위치 오류 수정)
- 문제: useEffect로 스크립트 동적 삽입 시 쿠팡 G() 함수가 `document.currentScript`를 찾지 못해 배너가 body 맨 앞에 삽입됨
- 해결: `next/script` `afterInteractive` + `onLoad` 콜백 방식으로 재작성, `container` 옵션으로 지정 div에 삽입
- `id` prop 추가 → 페이지별 고유 container id 부여 (중복 방지)
  - blog/[slug] aside: `coupang-sidebar-blog`, 본문 하단: `coupang-bottom-blog`
  - blog list: `coupang-sidebar-blog-list`
  - incheon: `coupang-sidebar-incheon`, subsidy: `coupang-sidebar-subsidy`, festival: `coupang-sidebar-festival`
- `output: "export"` 환경에서도 `afterInteractive` 정상 동작 확인

### GitHub Actions 빌드 에러 수정
- 원인: `CoupangBottomBanner.tsx`, `CoupangBanner.tsx` 수정분이 git에 누락된 상태로 push됨
- `Module not found: Can't resolve '@/components/CoupangBottomBanner'` 에러 4회 발생 (#125~#128)
- 두 파일 커밋 후 GitHub Actions 정상 복구 ✅

### 쿠팡 배너 240x600 적용, aside 너비 w-72 통일
- 5개 페이지 aside 너비 `w-44` → `w-72` (240px 배너 여백 확보)
- `blog/[slug]` footer 공정위 문구 클래스: `text-stone-400`으로 통일
- 4개 목록 페이지 footer 공정위 문구: `mt-1 text-center md:text-right` 적용

### 쿠팡 파트너스 배너 2종 적용 완료
- `CoupangBottomBanner.tsx` (680x300, id:976089) 확인
- `blog/[slug]/page.tsx`: 본문 하단 `CoupangBanner` → `CoupangBottomBanner` (가로형) 교체
- 사이드바 aside는 `CoupangBanner` (160x600, 세로형) 유지
- 목록 4개 페이지(blog/incheon/subsidy/festival) 사이드바·공정위 문구 이미 적용 완료

### 쿠팡 파트너스 배너 aside 구조 개선
- aside 너비 `w-56` → `w-44` (쿠팡 배너 160px 맞춤)
- aside 내부 `<div className="flex flex-col gap-4">` 래퍼 구조로 변경
- 공정위 문구 스타일 `text-stone-600 text-center`로 5개 파일 통일

### 쿠팡 파트너스 배너 추가 + 공정위 필수 문구 삽입
- `CoupangBanner.tsx` 기존 구현 확인 (AF5831775, carousel 템플릿, 160×600)
- 5개 페이지 aside에 `<CoupangBanner />` 추가 (태허철학관 배너 하단, `flex flex-col gap-4`)
- 4개 목록 페이지 footer + blog/[slug] article footer에 공정위 필수 문구 추가
- CLAUDE.md 쿠팡 파트너스 ID "미설정" → "✅ AF5831775" 업데이트

### Gemini 프롬프트 데이터 완전성 규칙 추가 + 블로그 정보 보강
- `generate-blog-post.js`: 정보 완전성 규칙 추가 (JSON 필드 누락 방지), 본문 최소 길이 1000→1500자
- `2026-03-28-post-1774680975916.md` 본문 재작성: 지원 금액, 대상 조건 표, 신청 기한, 전화번호(032-760-7524), 정부24 링크 등 전체 정보 포함

### Gemini API 테스트 - 인천 지역 정보 블로그 1편 생성
- Gemini 모델 `gemini-1.5-pro` → `gemini-2.5-flash` 교체 (기존 모델 신규 키 미지원)
- `scripts/_test-gemini-blog.js` 임시 테스트 스크립트로 API 호출 성공 확인
- 인천 중구 저소득 노인 부분틀니 지대치 비용 지원 블로그 생성 (source_id: 349000000108)
- `.env.local`에 `GEMINI_API_KEY` 추가

### 블로그 글 생성 Gemini 1.5 Pro로 교체
- `generate-blog-post.js`: Anthropic SDK → Gemini 1.5 Pro fetch API 교체
  - `callGemini()` 함수 추가 (temperature 0.9, maxOutputTokens 2048)
  - 프롬프트에 Gemini 감성 글쓰기 지침 추가 (MZ 스타일, 오감 묘사, 공문서 스타일 금지)
  - run() API 키 체크 → `GEMINI_API_KEY`로 변경
- `deploy.yml`: 블로그 생성 스텝 env `ANTHROPIC_API_KEY` → `GEMINI_API_KEY` 교체
- GitHub Secrets에 `GEMINI_API_KEY` 등록되어 있음 (로컬 .env.local 불필요)

### 인천 봄꽃 축제 중복 정리 + 이미지 교체 + 제목 수정
- `2026-03-26-incheon-spring-flower-festival.md` 삭제 (샘플 기반 중복, default 이미지)
- `2024-04-23-incheon-spring-flower-festival.md` 유지본으로 확정
  - title: "2026년 인천 봄꽃 축제" → "2026 인천대공원 봄꽃 축제" 수정
  - `image: "/images/incheon-spring-festival-2026.jpg"` 추가 (공식 포스터)
  - `source_id: "incheon-001"` 추가
- `public/images/incheon-spring-festival-2026.jpg` 공식 포스터 이미지 추가

### 진해군항제 수동 중복 제거 + 고창청보리밭 축제 블로그 추가
- `2026-03-27-jinhae-gunhangje-cherry-blossom.md` 삭제 (API 기반 자동 생성본 `2026-03-27-post-1774652966257.md`으로 대체)
- `2026-03-28-gochang-barley-field-festival.md` 신규 작성 (전국 축제·여행, source_id: 511801)
  - 4월 18일~5월 10일, 전북 고창 학원농장, 77만㎡ 청보리밭, firstimage TourAPI 사용
- 총 블로그 수 유지: 28편

### 태허철학관 배너 가로형 교체 + 도장 로고 추가
- `TaeheoAdBanner.tsx` 전면 교체: 세로형 → 가로형 (좌측 도장 로고 + 우측 텍스트)
- `public/images/taeheo-logo.png` 추가 (도장 이미지)
- 5개 페이지 aside 너비 `w-52` → `w-56` 조정

---

## 2026-03-27

### Google Analytics 설정
- `.env.local`: `NEXT_PUBLIC_GA_ID=G-6VNKGES4FW` 설정
- GitHub Secret `NEXT_PUBLIC_GA_ID` 등록 (`gh secret set`)
- `deploy.yml` "Next.js 빌드" 단계에 `NEXT_PUBLIC_GA_ID` env 주입 추가
- 빌드 결과물(`out/index.html`) GA 스크립트 포함 확인 ✅

### 태허철학관 자체 배너 추가
- **TaeheoAdBanner.tsx** (신규): 딥네이비 + 금색 디자인, 사주·운세·작명 CTA 배너
- 5개 페이지 사이드바 구조 적용: blog, incheon, subsidy, festival 목록 + blog 상세
  - `max-w-5xl` → `max-w-6xl`, `flex gap-8` 레이아웃, `aside.hidden.lg:block.w-52.sticky.top-24`
  - 모바일(lg 미만) 숨김, 데스크탑에서만 우측 고정 표시

### 블로그 카테고리 필터 URL 파라미터 방식 전환
- **BlogFilter.tsx**: `useState` → `useSearchParams` + `useRouter`로 교체
  - 필터 탭 클릭 시 URL 변경 (`/blog?category=축제` 등)
  - 카드 클릭 시 `blogScrollY` + `blogCategory` 모두 sessionStorage 저장
- **BlogScrollRestorer.tsx** (신규): 카테고리 URL 복원 + 스크롤 복원 통합
  - URL에 category 없는데 sessionStorage에 있으면 `router.replace`로 복원
- **BlogBackButton.tsx** (신규): "목록으로 돌아가기" 클라이언트 컴포넌트
  - sessionStorage의 `blogCategory`를 읽어 올바른 URL로 `router.push`
- **blog/page.tsx**: ScrollRestorer → BlogScrollRestorer 교체, Suspense 래핑
- **blog/[slug]/page.tsx**: Link → BlogBackButton 교체

### 구조 개선
- **CLAUDE.md/WORK_LOG.md 분리 리팩터링:**
  - CLAUDE.md: 설정·규칙만 유지, 인코딩 깨짐 전체 수정 (한글 정상화)
  - WORK_LOG.md 신규 생성: 이후 모든 작업 이력은 여기에 기록

### 블로그 콘텐츠
- **API 기반 수동 블로그 8편 추가 (카테고리별 9편 완성):**
  - 인천 2편: 저소득층 건강보험료 지원, 지역사회서비스투자사업 (인천 중구)
  - 보조금 4편: 청년도약계좌, 첫만남이용권, 국민취업지원제도, 근로·자녀장려금
  - 축제 2편: 가야문화축제 (김해, 4/30~5/3), 강서 낙동강30리 벚꽃축제 (부산, 4/3~4/5)
  - 누적 블로그 포스트: 총 28편 (인천 9, 보조금 9, 축제 9, 기타 1)
- **GitHub Actions 자동 생성 설정 확인:**
  - `generate-blog-post.js`: 카테고리당 2편 (`generated >= 2` break) 정상 확인
- **블로그 썸네일 이미지 교체 (TourAPI/공식 이미지로):**
  - 진해 군항제, 여의도 봄꽃, 경포 벚꽃: Unsplash → TourAPI 이미지
  - 구례 산수유: TourAPI URL → 로컬 공식 포스터 (`public/images/gurye-sansuyu-2026-poster.jpg`)
  - 광안리 드론라이트쇼: TourAPI → 공식 포스터 (`public/images/gwangan-drone-2026-poster.png`)
- **수동 블로그 포스트 추가 (벚꽃 시리즈):**
  - 전국 벚꽃 TOP 15 총정리, 구례 산수유, 진해 군항제, 여의도 봄꽃, 경포 벚꽃 (총 5편)
  - 자동 블로그 생성 MZ 감성 스타일 가이드 적용 (`generate-blog-post.js` 프롬프트 업그레이드)
- **블로그 이미지 규칙 강화:**
  - Unsplash 절대 금지, TourAPI/공식 포스터 우선순위 규칙 수립

### UI/UX
- **블로그 상세 페이지 히어로 이미지 추가:**
  - `blog/[slug]/page.tsx`: `post.image` 있고 `.svg` 아닌 경우 prose 위에 히어로 이미지 표시
- **카드 UI 전역 인터랙션 적용:**
  - `globals.css`에 `.menu-card`, `.menu-card-icon` 공통 스타일 추가
  - hover 시 확대/배경 틴트, `prefers-reduced-motion` 대응
- **인천/보조금 카드 레이아웃 FestivalCardList와 통일:**
  - summary `<p>`에 `flex-grow`, Link className 제거, `min-h-[220px]` 방식으로 최종 정리
- **상세 페이지 prose/타이포그래피 강화:**
  - `@tailwindcss/typography` 플러그인 적용, `max-w-6xl`, `prose-orange`, `lg:prose-lg`
  - 인천/보조금/축제 상세 본문 ReactMarkdown + prose 렌더링으로 전환
  - `description_markdown` 캐시 방식: `description_markdown_source_hash` 해시로 변경 감지

### 데이터
- **description_markdown 전체 백필 완료:**
  - incheon 103건, subsidy 103건, festival 107건 (100%)
  - Anthropic Haiku 4.5 실측: 입력 $1/MTok, 출력 $5/MTok, 1건당 ₩5 수준

---

## 2026-03-26

- 프로젝트 인천/전국 멀티카테고리 구조로 화면 재설계 (탭남 → 인천/전국)
- 환경변수 정리, scripts/ 개편, GitHub Actions 업데이트
- 샘플 데이터 3개 생성, 상세 페이지 구현, Cloudflare 배포 확인
- 블로그 자동 생성 구축: Gemini → (쿼터 문제로) Claude API 전환
- BlogFilter.tsx, RSS 피드, 사이트맵 자동생성 추가
- 기술 스택 문서 수정: Next.js 14→16, Gemini→Claude API(claude-haiku-4-5)
