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

### 2026-03-28 완료
- **블로그 썸네일 TourAPI 실제 이미지로 교체**: 진해군항제/여의도벚꽃/경포벚꽃/구례산수유/광안리 5개 포스트
- **태허철학관 배너 추가**: `TaeheoAdBanner.tsx` 가로형 + 도장 로고(`taeheo-logo.png`) 삽입, 전 페이지 사이드바 상단 배치
- **Google Analytics 설정**: `G-6VNKGES4FW` 적용 완료, `layout.tsx`에 Script 삽입
- **블로그 카테고리 필터 URL 파라미터 방식 전환**: `BlogFilter.tsx`를 `useSearchParams` 기반으로 재작성, 뒤로가기 시 필터 유지
- **블로그 생성 AI Gemini 2.5 Pro 전환**: `generate-blog-post.js` Gemini 2.5 Pro로 교체, MZ 감성 + 정보 완전성 규칙 추가
- **쿠팡 파트너스 배너 전면 구현**:
  - `CoupangBanner.tsx` (사이드바 240x600, id:976088) + `CoupangBottomBanner.tsx` (하단 680x300, id:976089)
  - 파트너ID: AF5831775
  - useEffect + g.js 중복 로드 방지 + `bannerId` prop으로 페이지별 고유 container id 지정
  - blog/incheon/subsidy/festival 목록·상세 8개 페이지 전체 적용
- **공정위 필수 문구**: 전 페이지 footer에 "쿠팡 파트너스 활동을 통해 수수료를 제공받습니다" 추가
- **인천/보조금/축제 상세 페이지 사이드바 추가**: `TaeheoAdBanner` + `CoupangBanner` 사이드바 3개 상세 페이지 전부 적용
- **블로그 중복 제거**: 진해군항제 1편 삭제 → 고창청보리밭 축제 1편 추가, 인천 봄꽃 축제 중복 제거

- **멀티카테고리 구조 전면 재설계**: 인천/전국 보조금/축제·여행 3개 카테고리 + 블로그
- **SEO 전면 보강 (2026-03-27)**:
  - sitemap.xml 도메인 수정 (pages.dev → pick-n-joy.com)
  - 전 페이지 metadata export 추가 (title, description, OG, canonical)
  - og:image 자동화 (TourAPI firstimage → frontmatter, 카테고리별 기본 SVG)
  - favicon 추가 (ico + svg)
  - robots.txt 도메인 수정
- **블로그 자동 생성**: Claude API(claude-haiku-4-5) + 공공데이터 기반 블로그 포스트 자동 생성 스크립트
- **CI/CD 워크플로우**: GitHub Actions (매일 07:00 KST) + Cloudflare Pages 자동 배포
- **RSS 피드**: /rss.xml 경로 제공
- **네이버 서치어드바이저**: 사이트 인증 완료
- **네비 메뉴명 변경**: 인천정보→인천시 정보, 보조금→전국 보조금·복지 정책, 축제·여행→전국 축제·여행 정보
- **헤더 UI 확대**: 로고·네비 폰트 사이즈 업
- **축제 overview 수집 보강**: collect-festival.js에 detailCommon2 API 추가, 기존 100건 보강 완료
- **축제 상세 데이터 복구**: overview 절삭 제거, 샘플 3건 API 매핑/교체(매칭 실패 샘플 정리), festival.json API 기반 재정리 완료
- **상세 페이지 가독성 개선**:
  - 전역 폰트 스택 개선(Pretendard/Noto Sans KR) 및 텍스트 톤 강화
  - 상세 본문 prose 적용(`@tailwindcss/typography`)
  - 상세 4페이지 폭 조정(`max-w-5xl → 7xl → 6xl`)
- **블로그 본문 구조화 자동 보정**:
  - 훅(Hook) 우선 시작 보정, 본문 H1→H2 보정
  - `1.`/`1️⃣` 번호 소제목 자동 헤딩화 + 설명 단락 분리
  - 번호 항목 설명 들여쓰기 code block 오인(pre/code 좌우 스크롤) 제거
  - 블로그 생성 프롬프트에 훅/번호 소제목 규칙 반영
- **상세 페이지 콘텐츠 구조 고도화**:
  - 인천/보조금/축제 상세 페이지를 Markdown + prose 중심 렌더링으로 통일
  - `description_markdown` 필드 우선 사용, 기존 데이터는 fallback markdown 생성으로 즉시 적용
  - 수집 스크립트(`collect-incheon.js`, `collect-subsidy.js`, `collect-festival.js`)에서 Anthropic으로 `description_markdown` 생성
  - source hash 기반 재생성 방지(`description_markdown_source_hash`)로 비용 최소화
  - `DESCRIPTION_MARKDOWN_BATCH_LIMIT`(기본 10)으로 실행당 생성량 제한해 초기 백필 시간을 분산
  - **description_markdown 전체 백필 완료 (2026-03-27)**: incheon 103건, subsidy 103건, festival 107건 모두 100% 생성 완료
  - 실측 Anthropic 비용: 10건당 ~$0.037, 1건당 ~$0.004(₩5), 월 10건/일 기준 ~$1.10/월
- **카드 UI 인터랙션 전역화 (2026-03-27)**:
  - `src/app/globals.css`에 공통 카드 인터랙션 클래스(`.menu-card`, `.menu-card-icon`) 도입
  - 인천/보조금/축제/블로그/홈 카드 hover 동작을 일관화(미세 확대 + 배경 틴트 + 아이콘 톤다운)
  - `prefers-reduced-motion`에서 애니메이션 비활성화로 접근성 대응
- **카드 높이 정책 재조정 (2026-03-27)**:
  - 인천/보조금 목록의 강제 동일 높이(`auto-rows-fr`, `h-full`) 적용을 롤백
  - 과도한 카드 확장 이슈를 해소하고 축제/블로그와 유사한 카드 체감 크기로 복구

## 3. 앞으로 해결해야 할 과제 / 백로그 (Backlog & Next Steps)

- [x] 블로그 상세 페이지 구조화된 JSON-LD 데이터 추가 및 Meta 데이터(OpenGraph 등) 확충 작업
- [x] 사이트맵(`sitemap.xml`) 및 웹 로봇(`robots.txt`) 추가하여 신규 글들에 대한 크롤링 최적화 진행
- [x] Google Analytics (NEXT_PUBLIC_GA_ID) 설정 ✅ 2026-03-28
- [x] 쿠팡 파트너스 배너 구현 ✅ 2026-03-28
- [ ] 쿠팡 배너 렌더링 확인 (배포 후 브라우저 콘솔 점검)
- [ ] Google AdSense (NEXT_PUBLIC_ADSENSE_ID) 설정
- [ ] 에러 핸들링 및 자동화 모니터링: 스크립트 실행 오류 시 알림 채널 검토
- [ ] 2단계: 전국 맛집 기능 (restaurant.json, 카카오 API 연동)
