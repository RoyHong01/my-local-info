# CLAUDE.md — 픽앤조이 프로젝트 가이드

> Claude Code가 이 프로젝트 작업 시 항상 먼저 읽어야 할 파일입니다.
> 각 작업 세션이 끝날 때마다 "## 작업 이력" 섹션을 업데이트해주세요.

## 프로젝트 기본 정보
- 사이트명: 픽앤조이 (pick-n-joy.com)
- 슬로건: "당신의 일상을 Pick, 당신의 주말을 Enjoy!"
- 로컬 경로: D:\Dev\my-local-info
- GitHub: https://github.com/RoyHong01/my-local-info
- Cloudflare Pages URL: https://my-local-info-2gs.pages.dev
- 최종 도메인: https://pick-n-joy.com

## 기술 스택
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Gemini API (gemini-2.0-flash) — 블로그 글 자동 생성
- 공공데이터포털 API + 한국관광공사 TourAPI — 데이터 수집
- GitHub Actions — 매일 07:00 KST 자동 실행
- Cloudflare Pages — 호스팅 및 배포

## 환경변수 (.env.local)
- GEMINI_API_KEY: Gemini AI 블로그 생성
- PUBLIC_DATA_API_KEY: 공공데이터포털 (보조금24, 인천 데이터)
- TOUR_API_KEY: 한국관광공사 TourAPI
- KAKAO_API_KEY: 카카오 로컬 API (2단계, 미사용)
- NEXT_PUBLIC_ADSENSE_ID: Google AdSense (미설정)
- NEXT_PUBLIC_GA_ID: Google Analytics (미설정)
- NEXT_PUBLIC_COUPANG_PARTNER_ID: 쿠팡 파트너스 (미설정)

## API 엔드포인트
- 보조금24: https://apis.data.go.kr/1741000/Subsidy24
- TourAPI: https://apis.data.go.kr/B551011/KorService2
- 카카오 로컬: https://dapi.kakao.com/v2/local/search/keyword.json

## 콘텐츠 카테고리
1. 인천 지역 정보 → public/data/incheon.json
2. 전국 보조금·복지 → public/data/subsidy.json
3. 전국 축제·여행 → public/data/festival.json
4. 전국 맛집 (2단계) → public/data/restaurant.json (미구현)

## 만료 처리 방식
- 파일 삭제 X (SEO 보존)
- frontmatter의 expired: true 마킹
- 목록 페이지에서 expired 항목 제외
- 상세 페이지에서 "종료된 행사" 배지 표시

## 폴더 구조 (핵심)
src/app/
page.tsx          # 메인 (멀티카테고리)
incheon/          # 인천 지역 정보 목록
subsidy/          # 전국 보조금 목록
festival/         # 전국 축제·여행 목록
blog/             # AI 블로그 목록 + 상세
rss.xml/          # RSS 피드 (route.ts)
about/            # 소개 페이지
src/components/
BlogFilter.tsx    # 블로그 카테고리 필터 (use client)
scripts/
collect-incheon.js    # 인천 데이터 수집
collect-subsidy.js    # 보조금 데이터 수집
collect-festival.js   # 축제 데이터 수집
generate-blog-post.js # Gemini AI 블로그 생성
cleanup-expired.js    # 만료 콘텐츠 처리
.github/workflows/
deploy.yml        # 매일 07:00 KST 자동화

## GitHub Actions Secrets
- CLOUDFLARE_API_TOKEN ✅
- CLOUDFLARE_ACCOUNT_ID ✅
- PUBLIC_DATA_API_KEY ✅
- TOUR_API_KEY ✅
- GEMINI_API_KEY ✅

## 작업 규칙
1. 작업 전 반드시 이 파일(CLAUDE.md) 먼저 읽기
2. 새 파일 생성 시 이 파일의 폴더 구조 섹션 업데이트
3. 새 환경변수 추가 시 이 파일의 환경변수 섹션 업데이트
4. 각 작업 세션 종료 시 "## 작업 이력" 섹션에 날짜와 작업 내용 추가
5. npm run build 항상 마지막에 실행해서 빌드 오류 확인
6. 빌드 성공 후 git add . → git commit → git push 순서로 배포
7. Copilot과 병행 작업 시 `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`를 함께 확인하고 동기화 유지
8. 세션 종료 전 사용자에게 문서 업데이트 여부를 확인하고, 업데이트 시 CLAUDE.md / .github/copilot-instructions.md / COPILOT_MEMORY.md / PROJECT_MEMORY.md를 함께 반영

## 작업 이력

### 2026-03-26
- 프로젝트 인천/전국 멀티카테고리 구조로 전면 재설계
- PROJECT_PLAN.md 업데이트 (성남 → 인천/전국)
- 환경변수 재정비 (GEMINI_API_KEY, TOUR_API_KEY, KAKAO_API_KEY 추가)
- scripts/ 재편: collect-incheon.js, collect-subsidy.js, collect-festival.js, cleanup-expired.js 신규 생성
- GitHub Actions daily.yml 멀티카테고리 구조로 업데이트
- src/app/ 멀티카테고리 UI 전면 재작성 (픽앤조이 브랜딩 적용)
- 샘플 데이터 3종 생성 (incheon.json, subsidy.json, festival.json)
- Cloudflare Pages 배포 확인: https://my-local-info-2gs.pages.dev
- 상세 페이지 생성: incheon/[id], subsidy/[id], festival/[id]
- 홈 카드에 상세 페이지 링크 연결

### 2026-03-26 (계속)
- Gemini 모델 gemini-2.5-pro → gemini-2.5-flash → gemini-2.0-flash 변경 (free tier 쿼터 초과)
- 블로그 포스트 3편 자동 생성 성공 (인천 봄꽃 축제, 청년 월세 지원, 어린이날 큰잔치)
- YAML frontmatter title 콜론 자동 따옴표 처리 로직 추가
- 블로그 목록 컴팩트 카드 그리드로 개선 (3열, 카테고리 필터 탭)
  - src/components/BlogFilter.tsx 신규 생성 (use client, 카테고리 필터)
  - src/app/blog/page.tsx 서버 컴포넌트로 유지, BlogFilter에 데이터 전달
- 기존 블로그 글 category 수정 (정보 → 적절한 카테고리)
- 네이버 서치어드바이저 사이트 인증 메타태그 추가 (layout.tsx)
- 네이버 서치어드바이저 소유 확인 HTML 파일 추가 (public/)
- RSS 피드 추가 (src/app/rss.xml/route.ts → /rss.xml 경로)

### 2026-03-27

- sitemap.xml 도메인 수정: pages.dev → pick-n-joy.com (generate-sitemap.js, robots.txt)
- SEO 전체 점검 및 보강:
  - 블로그 상세 페이지: OG 태그, canonical, publishedTime 추가
  - 블로그 목록/소개/인천/보조금/축제 페이지: metadata export 추가 (title, description, OG, canonical)
- og:image 자동화 구현:
  - generate-blog-post.js: TourAPI firstimage → frontmatter image 필드 자동 삽입
  - 이미지 없는 카테고리는 카테고리별 기본 SVG 이미지 사용
  - posts.ts: PostData에 image 필드 추가
  - blog/[slug] generateMetadata: og:image 반영
  - layout.tsx: 사이트 전역 기본 og:image 추가
  - public/images/ 기본 OG 이미지 4종 생성 (default-og, default-incheon, default-subsidy, default-festival)
- favicon 추가:
  - public/favicon.ico (32x32, 오렌지 배경 + 흰색 P)
  - public/favicon.svg (벡터, 고해상도 대응)
  - layout.tsx: icons 메타데이터 설정 추가
- 네비 메뉴명 변경 (10개 페이지):
  - 인천정보 → 인천시 정보
  - 보조금 → 전국 보조금·복지 정책
  - 축제·여행 → 전국 축제·여행 정보
- 헤더 UI 확대: 로고 text-2xl→text-3xl, 네비 text-sm→text-base
- 축제 상세설명(overview) 수집 보강:
  - collect-festival.js: detailCommon2 API 추가 호출로 각 축제 overview 자동 수집
  - HTML 태그 제거 + 200자 요약 처리
  - 기존 overview 없는 항목 자동 보강 로직 추가
  - 100건 축제 상세 설명 보강 완료
- generate-blog-post.js 전면 재작성:
  - 하루 6편 생성 (카테고리별 2편씩)
  - 중복 체크 개선: title 정확 매칭 + source_id 기반 ID 중복 방지
  - 카테고리별 우선순위 정렬 로직 추가 (인천: 행사/축제 우선, 보조금: 조회수 순, 축제: 이미지 있는 것 우선)
  - 글 사이 30초 대기 (API 쿼터 보호)

### 2026-03-27 (오후)
- Anthropic API 키 발급 및 적용 (.env.local, GitHub Secrets)
- 블로그 생성 스크립트 Gemini → Claude API (claude-haiku-4-5)로 교체
- 블로그 자동 생성 개선: 카테고리별 2편씩, 우선순위 정렬, 중복 방지 강화
- 중복 블로그 파일 5개 정리 (총 14편으로 정리)
- EDC Korea 카테고리 변경: 전국 축제·여행 → 인천 지역 정보
- 블로그 카드 썸네일 이미지 추가 (BlogFilter.tsx)
- 현재 블로그: 인천 7편, 보조금 5편, 축제 2편 = 총 14편
- 블로그 카드 UI 개선: 이미지 있는 포스트 → 세로형(썸네일 h-40 + 카테고리 배지), 이미지 없는 포스트 → 컴팩트 가로형(왼쪽 컬러 스트라이프 + 텍스트)
- 블로그 카드 레이아웃 통일: 이미지 없는 카드에 카테고리별 SVG 썸네일 자동 생성 (인천: 도시 아이콘/파란 그라디언트, 보조금: 문서 아이콘/주황, 축제: 깃발 아이콘/핑크), 단일 세로형 카드로 통일
- 한글 파일명 슬러그 3개 영문으로 변경 (404 수정): 다자녀자동차취득세감면 → family-car-tax-reduction, 연수e음-지역화폐-캐시백 → yeonsu-local-currency-cashback, 인천동구명절위문지원 → incheon-donggu-holiday-welfare
- SEO 보강: 전체 14개 포스트에 slug, description 필드 추가 (130~160자 meta description), posts.ts PostData에 description 필드 추가, blog/[slug] generateMetadata에서 description 우선 사용
- SEO 자동화: generate-blog-post.js 프롬프트 개선 (summary 130~160자, description=summary, tags 5개), 파일 저장 시 slug 자동 삽입 로직 추가
- 기존 포스트 6개 summary 130~160자로 보강: nurieducation, yeonsu, incheon-spring(2026), namsan, family-car-tax, edc-korea
- posts.ts description fallback 추가 (description || summary), JSON-LD에도 description 우선 적용
- 블로그 목록 스크롤 위치 복원 기능 추가: BlogFilter.tsx 카드 클릭 시 sessionStorage에 scrollY 저장, BlogScrollRestorer.tsx 신규 생성(useEffect로 복원), blog/page.tsx에 추가
- 상세 페이지 정보 풍부화: incheon/[id], subsidy/[id], festival/[id] 전면 재작성 (formatText 줄바꿈 보존, ㅇ→• 변환, 필드 추가, 링크 버튼 개선)
- 목록 페이지 클라이언트 컴포넌트 분리: IncheonCardList.tsx, SubsidyCardList.tsx, FestivalCardList.tsx 신규 생성 (sessionStorage 스크롤 저장)
- ScrollRestorer.tsx 신규 생성 (storageKey prop으로 범용 사용)
- incheon/page.tsx, subsidy/page.tsx, festival/page.tsx: ScrollRestorer + CardList 컴포넌트 적용
- blog/page.tsx: BlogScrollRestorer → ScrollRestorer(storageKey="blogScrollY")로 통일

## 다음 작업 예정
- Google Analytics GA ID 설정
- 쿠팡 파트너스 배너 삽입
- Google AdSense 신청 (15편 이상 시)
- 블로그 카드 썸네일 배포 확인
