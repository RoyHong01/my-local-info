# 픽앤조이 (pick-n-joy.com) — Copilot 프로젝트 가이드

> GitHub Copilot이 이 프로젝트 작업 시 항상 먼저 읽어야 할 파일입니다.
> Copilot 작업은 이 파일과 `COPILOT_MEMORY.md`, `WORK_LOG.md`를 기준으로 운영합니다.

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
1. 작업 전 이 파일과 `COPILOT_MEMORY.md`를 먼저 확인
2. 세부 작업 이력은 `WORK_LOG.md`에 기록
3. Copilot 운영 문서는 `.github/copilot-instructions.md`와 `COPILOT_MEMORY.md`를 기준으로 유지
4. `npm run build` 항상 마지막에 실행해서 빌드 오류 확인
5. 빌드 성공 후 `git add . → git commit → git push` 순서로 배포
6. 세션 종료 시 `WORK_LOG.md`, `COPILOT_MEMORY.md`, `.github/copilot-instructions.md` 업데이트
7. **항상 적용할 종료 루틴(필수)**
  - 코드 변경 작업 완료 후, 반드시 `build 성공 → commit/push → 문서/메모리 동기화` 순서를 수행
  - 문서/메모리 동기화 대상: `WORK_LOG.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`
  - 위 루틴 미완료 상태에서는 작업 완료로 보지 않음
8. **커밋/배포 완료 직후 필수 확인 질문**: 사용자에게 반드시 다음을 먼저 질문한다 — **"`WORK_LOG.md`와 메모리 파일(`COPILOT_MEMORY.md`)도 지금 업데이트할까요?"**. 위 확인 질문 없이 작업 완료로 종료하지 않는다.
9. **사용자가 요청하지 않은 수정 금지**: 사용자가 명시적으로 요청한 파일·코드만 수정한다. 프롬프트가 불분명하거나 작업 대상이 모호할 경우, 임의로 짐작해서 수정하지 말고 반드시 사용자에게 확인 질문을 한 뒤 작업을 진행한다.

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

## 최근 동기화 메모 (압축판)

- 상세 이력은 `WORK_LOG.md`에 누적하고, 본 문서는 운영 규칙/현행 상태 위주로 유지한다.
- 2026-03-29~30 핵심 반영:
  - `픽앤조이 초이스` 카테고리 신설 및 포스트 2편 반영
  - 초이스 상세 UI/안내문구 개선 + 히어로 이미지 로컬 교체
  - 맛집 자동화 고도화(지역 버킷 분배, Google 평점 필터, slug 안정화)
  - 블로그 생성/배포 품질 강화(E2E, 생성 재시도, SEO/JSON-LD)
- 고정 참고값:
  - 쿠팡 파트너ID `AF5831775`
  - 사이드바 배너 `976244`, 하단 배너 `976089`
  - 쿠팡 배너는 공식 iframe URL 직접 사용 + `referrerPolicy="unsafe-url"`

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
- [ ] Google AdSense 설정
- [ ] 자동화 오류 모니터링 강화
- [ ] 맛집 포스트 이미지 전략 고도화
