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
- Claude API (claude-haiku-4-5) — 블로그 글 자동 생성
- 공공데이터포털 API + 한국관광공사 TourAPI — 데이터 수집
- GitHub Actions — 매일 07:00 KST 자동 실행
- Cloudflare Pages — 호스팅 및 배포

## 환경변수 (.env.local)
- ANTHROPIC_API_KEY: Claude API 블로그 생성
- PUBLIC_DATA_API_KEY: 공공데이터포털 (보조금24, 인천 데이터)
- TOUR_API_KEY: 한국관광공사 TourAPI
- KAKAO_API_KEY: 카카오 로컬 API (2단계, 미사용)
- NEXT_PUBLIC_ADSENSE_ID: Google AdSense (미설정)
- NEXT_PUBLIC_GA_ID: Google Analytics (미설정)

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
4. 전국 맛집 (2단계) → `public/data/restaurant.json` (미구현)

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

## 백로그
- [ ] Google Analytics 설정
- [ ] Google AdSense 설정
- [ ] 에러 핸들링 및 자동화 모니터링
- [ ] 2단계: 전국 맛집 기능 (restaurant.json, 카카오 API)
