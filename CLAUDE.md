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
- GitHub Actions → 매일 04:00 KST 자동 실행 (cron: `0 19 * * *`)
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
    life/
      ChoiceArticleCard.tsx  # 픽앤조이 초이스 블로그형 카드 (ReactMarkdown 렌더링)
      RestaurantExplorer.tsx
    # life-choice.ts: ChoiceArticle 인터페이스, getChoiceArticles() 필터 로직
    # 픽앤조이 초이스 카테고리 포스트를 자동 수집 (3대 카테고리 제외)
    # choice/page.tsx: 초이스 목록 페이지 (ChoiceArticleCard + CoupangBottomBanner)
    # 초이스 포스트 전용 frontmatter: coupang_link, coupang_banner_image, coupang_banner_alt
    # rating_value, review_count (JSON-LD aggregateRating 자동 연결)
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
  deploy.yml            # push 또는 04:00 KST 자동 배포

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
10. **커밋/배포 완료 직후 자동 동기화**: 작업 완료 후 즉시 `WORK_LOG.md`와 메모리 파일(`COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`)을 자동으로 업데이트한다. 사용자에게 별도 확인 질문을 하지 않는다.

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

## 블로그 현황 (2026-03-30 기준)
- 총 28편(posts/) + 초이스 2편(life/): 인천 9, 보조금 9, 축제 9, 기타 1 / 픽앤조이 초이스 2
- 2026-03-30: 픽앤조이 초이스 카테고리 신설, 쿠팡 제휴 리뷰 포스트 2편 수동 작성

## 최신 동기화 메모 (압축판)

- 상세 이력은 `WORK_LOG.md`에 누적하고, 본 문서는 규칙/현행 상태 중심으로 유지한다.
- 2026-04-19 핵심 반영:
  - **Reading Progress Bar 추가**: 모든 상세 페이지(blog/incheon/subsidy/festival 4곳) 헤더 바로 아래 고정, orange-500 색상
  - **Sticky Choice CTA 추가**: 초이스 카테고리 모바일 전용(md:hidden), 200px 스크롤 후 노출
  - **린트 완전 정리**: 54 errors + 48 warnings → 0 errors, 0 warnings
    - 3개 파일 수정(eslint.config.mjs, about/page.tsx, AdBanner.tsx)
    - 19개 파일 dead code 정리(Link/redirect import + unused 함수/변수)
    - 자동화 영향: 0 (코드 정리만, 기능 무변화)
- 2026-04-17 핵심 반영:
  - **공공데이터 페이지네이션 복구**: `scripts/collect-incheon.js`, `scripts/collect-subsidy.js`, `scripts/collect-festival.js`에 페이지 반복 수집 추가
  - **활성 기간 윈도우 정리**: 인천/보조금은 12개월(최소 6개월), 축제는 6개월 범위
  - **만료 처리 정책 복원**: `expired: true` 마킹으로 유지
  - **콘텐츠 보호 강화**: ALLOW_EXISTING_POST_DELETION/OVERWRITE env 필수
- 2026-03-29~30 핵심 반영:
  - `픽앤조이 초이스` 카테고리/목록/카드/포스트 체계 반영
  - 초이스 상세 UI/고지문/히어로 이미지 개선
  - 맛집 자동화 고도화(버킷 분배, 평점 필터, slug 안정화)
  - 블로그 생성 안정화(E2E 게이트, 재시도 로직, SEO/JSON-LD 강화)
- 고정 참고값:
  - 쿠팡 파트너ID `AF5831775`
  - 사이드바 `976244`, 하단 `976089`
  - 배너는 공식 iframe URL + `referrerPolicy="unsafe-url"` + `CoupangBanner.tsx` `'use client'`

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
