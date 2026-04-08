# WORK_LOG.md — 픽앤조이 작업 이력

> 상세 작업 이력 보관용. CLAUDE.md에는 포함하지 않음.
> 최신 항목이 위에 오도록 작성.

---

## 2026-04-08

### 서비스 신뢰도/정책 페이지 보강 + SEO 메타 최적화

- 일상의 즐거움 카드 노출 제한 해제
  - `src/app/life/page.tsx`: 초이스 `getChoiceArticles(6)` 제한 제거, 맛집 `.slice(0, 12)` 제거
  - `src/lib/life-choice.ts`: 기본 limit `4 -> 1000` 조정
- AdSense/E-E-A-T 대응 보강
  - `src/app/about/page.tsx`: 소개 페이지 6개 섹션 확장 + AboutPage JSON-LD 추가
  - `src/app/layout.tsx`: 전역 description 정비, `WebSite`/`Organization` schema 강화
  - `src/components/SiteFooter.tsx`: 공익 문구 2줄 구조 반영
- 이용약관 페이지 신설
  - `src/app/terms/page.tsx`: 개인정보처리방침과 동일한 배경/타이포 구조로 Terms of Service 신규 추가
  - 핵심 조항 반영: 목적, 서비스 내용, 면책, 저작권, 문의
- 푸터 신뢰도 링크 세트 완성
  - `src/components/SiteFooter.tsx`: `소개 | 개인정보 처리방침 | 이용약관 | 문의하기(mailto)`로 개편
- UI 가독성 미세 조정
  - 푸터 보조 문구 색상을 메인 문구와 동일 톤(`text-gray-400`)으로 통일
- 네이버 URL 검사 대응
  - `src/app/page.tsx`: 홈 `metadata.description` + `openGraph.description`를 80자 이내 권장 길이로 축약
- 네이버 크롤링 보강
  - `scripts/generate-sitemap.js`: 정적 페이지 목록에 `/privacy/`, `/terms/` 추가 (sitemap URL 477 -> 479)
- 홈 히어로 하단 통계 정렬 보정
  - `src/app/page.tsx`: 하단 3개 지표(보조금/축제·행사/업데이트)에서 중앙 지표는 고정하고 좌우 지표 간격을 확장해 상단 CTA 버튼 하단 정렬감을 개선
  - 추가 미세 조정: 통계 영역 폭을 CTA 버튼 묶음 폭에 가깝게 재축소해 좌우가 과하게 벌어져 보이는 문제 보정
- 홈 히어로 CTA 버튼 폭/문구 통일
  - `src/app/page.tsx`: 상단 3개 CTA 버튼을 동일 폭 grid로 통일
  - 문구 조정: `이번 주말 전국 행사·축제`, `요즘 뜨는 인천·서울·경기 맛집`
  - 통계 영역도 동일한 최대 폭(`max-w-4xl`) 기준으로 정렬
  - 추가 미세 조정: CTA 내부 아이콘/텍스트 정렬 구조를 통일하고, 좌우 통계를 각 카드 중심축 아래로 이동
  - 히어로 섹션 `overflow-hidden` 적용으로 모바일에서 보이던 내부 스크롤바 제거
  - 설명 문단과 CTA 카드 사이 여백 확대: `mb-14 -> mb-16 md:mb-20`으로 조정해 답답한 인상 완화
- 홈 Problem 섹션 카드 중앙 정렬 정리
  - `src/app/page.tsx`: 문제 카드 3개를 `flex-col + text-center` 구조로 통일
  - 1번 제목 문구 축약: `수많은 정보 속 나에게 딱 맞는 혜택은?`
  - 숫자 배지(1,2,3) 제거 후 텍스트 크기 확대, 두 줄 메시지 카드 중심으로 단순화
  - 섹션 분리 여백 강화: Problem 섹션 `pb-6 -> pb-8`, Category 섹션 `pt-10 -> pt-16 md:pt-20`로 조정해 "문제 제기 -> 해결책" 전환을 시각적으로 명확화
  - 시각적 전환 장치 추가: Category 섹션 상단에 1px 옅은 그라디언트 페이드 라인(`from-transparent via-stone-300/80 to-transparent`) 삽입
  - 하단 마무리 가독성 보강: Features+CTA 섹션 하단 여백 확대(`pb-16 sm:pb-20`) + `SiteFooter` 상단 구분선(`border-t border-white/10`)과 상단 패딩(`pt-8`)으로 마지막 문구와 푸터 압박감 완화

- 관련 커밋:
  - `6a17d64` 카드 노출 제한 해제
  - `6c68fab` 소개/스키마/푸터 공익 문구
  - `18cd552` 푸터 보조 문구 가독성 상향
  - `05c81ec` 이용약관 페이지 + 푸터 링크 확장
  - `1264588` 푸터 문구 색상 통일
  - `0a694bf` 홈 메타 설명 길이 최적화

---

## 2026-04-08 (추가)

### posts.ts Turbopack 광범위 파일 접근 경고 수정

- 원인: `postsDirectories`를 `path.join(process.cwd(), ...)` 런타임 계산 방식으로 정의하고, `getSortedPostsData()`에서 `markdownEntries`에 `{ fileName, fullPath }` 형태로 경로를 중간 저장한 뒤 나중에 `readFileSync` 호출 → Turbopack이 파일 접근 범위를 넓게 추정해 경고 발생 (L169, L256)
- 수정 내용:
  - `postsDirectories`: `path.join(process.cwd(), ...)` → `path.resolve('src/content/...')` 리터럴 문자열 방식으로 변경 (Turbopack이 정적으로 디렉터리 경로 분석 가능)
  - `getSortedPostsData()`: 중간 `markdownEntries` 배열(fullPath 저장) 제거 → 단일 패스로 파일 읽기 + PostData 생성 처리
  - 에러 처리: 디렉터리 순회 오류 / 개별 파일 파싱 오류 각각 분리 처리
- 빌드: 497페이지 정상 생성, 커밋 `f35735e`

---

## 2026-04-07

### 픽앤조이 초이스 수동 포스트 생성: Panasonic ES-148

- 사용자 제공 제품 태그 기준으로 신규 초이스 포스트 작성 완료
  - 파일: `src/content/life/2026-04-07-choice-panasonic-es148-eyebrow-trimmer.md`
  - slug: `panasonic-es148-eyebrow-trimmer`
  - category: `픽앤조이 초이스`
  - 쿠팡 링크/배너 frontmatter 반영 (`coupang_link`, `coupang_banner_image`, `coupang_banner_alt`)
- 사용자 지정 이미지 2종을 다운로드 폴더에서 프로젝트로 반영
  - `C:\Users\Roy Hong\Downloads\Panasonic.png` → `public/images/choice/panasonic-es148-hero.png`
  - `C:\Users\Roy Hong\Downloads\Panasonic-1.png` → `public/images/choice/panasonic-es148-detail.png`
- 본문 구성: 상단 이미지 + 중간 이미지 + CTA 링크 2회 배치(모바일 가독성 기준)
- 최종 상태: build/commit/push 완료

### 픽앤조이 초이스 이미지 중복 재발 방지 보완

- 문제 원인 확인: 상세 페이지에서 `frontmatter.image`를 상단에 자동 렌더링하는데, 본문에 같은 이미지를 다시 삽입해 중복 노출 발생
- 즉시 수정: `2026-04-07-choice-panasonic-es148-eyebrow-trimmer.md` 본문의 동일 상단 이미지 제거
- 재발 방지 코드 적용:
  - `src/app/blog/[slug]/page.tsx`에 `removeFirstDuplicateHeroImage()` 추가
  - 초이스 글(`isChoicePost`) 렌더링 시 본문 첫 이미지가 `frontmatter.image`와 같으면 자동 제거
- 생성 지침 보완:
  - `scripts/generate-choice-post.js` 이미지 규칙에 "대표 이미지와 동일 이미지 재삽입 금지" 명시
  - 품질 체크리스트의 링크 규칙 모순 수정(배너 금지 + CTA 텍스트 링크 허용)

### 픽앤조이 초이스 CTA 링크 중복 수정 + 재발 방지

- 문제 확인: Panasonic ES-148 글 본문에 동일 쿠팡 CTA 링크가 2회 삽입됨(상단/중간)
- 즉시 수정: 상단 CTA 링크 삭제 후 중간 CTA 1회만 유지
- 재발 방지 적용:
  - `scripts/generate-choice-post.js` 프롬프트를 "본문 중간 1회만 삽입"으로 명시
  - `dedupeAffiliateLinks()` 후처리 함수 추가: 동일 `coupang_link` 중복 시 마지막 1개만 남기고 나머지 제거

### 픽앤조이 초이스 수동 포스트 생성: 톰보 모노 제로 샤프형 지우개

- 사용자 제공 쿠팡 태그 기준으로 신규 초이스 포스트 작성 완료
  - 파일: `src/content/life/2026-04-07-choice-tombo-mono-zero-eraser.md`
  - slug: `tombo-mono-zero-eraser`
  - category: `픽앤조이 초이스`
  - 쿠팡 링크/배너 frontmatter 반영 (`coupang_link`, `coupang_banner_image`, `coupang_banner_alt`)
- 사용자 지정 이미지 2종을 다운로드 폴더에서 프로젝트로 반영
  - `C:\Users\Roy Hong\Downloads\Tombo.png` → `public/images/choice/tombo-mono-zero-hero.png`
  - `C:\Users\Roy Hong\Downloads\Tombo-1.png` → `public/images/choice/tombo-mono-zero-detail.png`
- 본문 구성: 상단 대표 이미지는 frontmatter로 노출, 본문 중간 상세 이미지 1장 + CTA 링크 1회만 배치

## 2026-04-04

### 자동화 개선 완료: 검증 + 비용 모니터링 + 프롬프트 안정화

#### 1단계) 데이터 수집 검증 강화 + Anthropic 사용량 추적

- 3개 수집 스크립트(`collect-incheon.js`, `collect-subsidy.js`, `collect-festival.js`)에 `validateFetchedData()` 헬퍼 함수 추가
  - API 조회 결과 0건이면 경고 표시
  - API 조회 결과가 기존 데이터의 50% 이하면 경고 표시
- GitHub Actions output으로 Anthropic 토큰 사용량 보고 (`anthropic_usage={inputTokens}/{outputTokens}`)
- 워크플로우에서 수집 단계 output 수신 정의:
  - `COLLECT_{지역}_VALIDATION`: 검증 상태(ok/warning)
  - `COLLECT_{지역}_ANTHROPIC_USAGE`: 토큰 사용량 문자열
- 일일 리포트(`write-daily-report.mjs`)에 데이터 검증 상태 및 Anthropic 사용량 섹션 추가
  - 핵심 요약에 "데이터 검증" 행 표시
  - 핵심 요약에 "Anthropic 사용량" 행으로 각 지역별 input/output 토큰 누적 표시

#### 2단계) 블로그/초이스 포스트 프롬프트 안정화

- `generate-blog-post.js`: temperature 0.9 → 0.4, topP 0.92 추가
- `generate-choice-post.js`: temperature 0.9 → 0.35, topP 0.92 추가
- 목표: 생성 결과의 형식/구조 일관성 향상 (출력 편차 감소)

#### 3단계) 문서 규칙 자동화 변경

- `.github/copilot-instructions.md` 규칙 8번: 커밋/배포 후 "필수 확인 질문" → "자동 동기화" 정책으로 변경
- `CLAUDE.md` 규칙 10번: 동일 내용으로 변경
- `COPILOT_MEMORY.md` 운영 규칙에 "별도 사용자 확인 질문 없이 자동 동기화" 명시
- 효과: 작업 중단 방지, 문서 업데이트 루프 해소

- **커밋**: `5c4fcc8` (자동화 개선: 데이터 검증, Anthropic 사용량 보고, Prompt 안정화)
- **검증**: `npm run build` 성공 (454페이지 정적 생성 완료)

### 자동화 첫 완전 성공 리포트 (2026-04-03 → 2026-04-04)

- **자동화 리포트 정상 완료**: 인천/보조금/축제/만료처리 모두 에러 없이 실행됨
- **데이터 수집 결과**:
  - 인천: 신규 0건, 총 103건
  - 보조금: 신규 0건, 총 103건
  - 축제: 신규 5건, 업데이트 95건, 총 140건
- **변경 데이터**: `festival.json`, `restaurants.json`
- **블로그 생성**: 3건
- **맛집 포스트 생성**: 3건
- **생성된 블로그 제목**:
  - 인천 부평구 기초생활수급자라면 쓰레기 처리비, 신청 안 해도 나와요!
  - 초록의 물결 속으로! 옥천 묘목축제에서 인생 나무를 만나보세요 🌳
  - 국가유공자 예우, 특별한 희생에 감사하는 보상금 지급 잊지 마세요!
- **생성된 맛집 제목**:
  - 동탄 카페: 약속 전 디저트까지 완벽한 동선이 필요할 때
  - 망원동 빙수: 약속 동선 짤 때 일단 저장부터 하는 이유
  - 송도 브런치, 햇살 잘 드는 자리부터 잡고 싶을 때
- **텔레그램 알림**: 정상 전송

### 자동화 개선 과제

- 이번 실행에는 큰 오류가 없었지만, 앞으로 안정성과 추적성을 더 높이기 위해 아래 개선 과제를 권장합니다.
  - **생성 중복/누락 감지**: 블로그/맛집 포스트 생성 결과를 자동 비교해 누락 건이 없는지 점검
  - **데이터 수집 검증**: `festival.json`, `restaurants.json` 변경 전후 스냅샷 비교로 비정상 변동 감지
  - **Prompt 안정화**: `generate-choice-post.js` 등 자동 글 생성 프롬프트에서 불필요 라벨 제거 및 표현 일관성 강화
  - **비용 모니터링**: Gemini 비용 누적 감시와 예산 경고 알림 추가

---

## 2026-04-03

### GitHub Actions 스케줄 변경 + Admin 배경 통일

- **cron 변경**: `0 22 * * *` (07:00 KST) → `0 19 * * *` (04:00 KST)
- **admin 배경**: `admin/page.tsx`, `admin/runs/page.tsx` gradient → `bg-cherry-blossom` (다른 페이지와 동일한 꽃무늬 배경)
- 커밋: `1dd82f9`

### 맛집 파이프라인 3지역 분리 (인천/서울/경기)

- **배경**: 기존 2지역(`incheon-gyeongin`, `seoul-gyeonggi`) 구조에서 경기 후보 소진 → 매일 수집 필요
- **목표**: 3지역 분리 + 지역당 30개 후보로 월 1회 수집으로 충분하도록 변경
- **collect 스크립트 변경** (`collect-life-restaurants.mjs`):
  - `REGION_QUERY_MAP`: 2지역 → 3지역(`incheon`, `seoul`, `gyeonggi`) 각 8개 검색어
  - `MAX_ITEMS_PER_REGION`: 15 → 30
  - `GOOGLE_PRE_FILTER_SIZE`: 20 → 50
  - `run()`: 하드코딩 2지역 → `Object.keys(REGION_QUERY_MAP)` 동적 순회
- **generate 스크립트 변경** (`generate-life-restaurant-posts.mjs`):
  - `TARGET_BUCKETS`: `gyeonggi-other` → `gyeonggi` 통일
  - `classifyRegionBucket()`, `toAreaTag()`, `classifyBucketFromPostFrontmatter()` 업데이트
  - `regionLabel`/`areaTag` 매핑: 3지역 객체 룩업 방식으로 변경
- **프론트엔드 변경**:
  - `src/lib/life-restaurants.ts`: `LifeRegionTab` 타입 3지역, `REGION_QUERY_MAP`/`REGION_FALLBACK`/`MAX_ITEMS_PER_REGION` 업데이트
  - `src/components/life/RestaurantExplorer.tsx`: 탭 2개 → 3개 (인천/서울/경기)
  - `src/app/life/restaurant/page.tsx`: 3지역 데이터 로드
  - `src/app/life/page.tsx`: 3지역 데이터 로드 + 폴백 매핑
- **수집 결과**: 인천 30건, 서울 30건, 경기 30건 (총 90개 후보)
- 커밋: `bd8a7d7`

### 맛집 후보 자동 재수집 로직 추가

- **요청**: 어느 버킷이든 후보가 0이면 자동으로 Kakao API 재수집
- **변경** (`generate-life-restaurant-posts.mjs`):
  - `buildFilteredCandidates()`, `findEmptyBuckets()`, `recollectRestaurants()` 함수 분리
  - `run()`: 빈 버킷 감지 시 `collect-life-restaurants.mjs` 자동 호출 후 재시도
- 커밋: `26c9a9a`

### 홈페이지 디자인 개편 (히어로 + 콘텐츠 배경)

- **히어로 섹션 리디자인**: 기존 진한 오렌지/보라 그라데이션 → 흰색→오렌지 부드러운 그라데이션 + 어두운 텍스트 (눈의 피로도 감소)
  - 배경: `from-white via-orange-50 to-orange-300`
  - 텍스트: `text-gray-900`/`text-gray-700` + Pick/Enjoy `text-orange-600`
  - CTA: `bg-orange-500 text-white` / `bg-white text-orange-600`
  - 닷 패턴, 애니메이션 도형 톤다운
- **“왜 픽앤조이인가요?” 섹션**: 다채 금속 그라데이션 → `from-orange-50 to-orange-100` + 흰색 카드 UI
- **콘텐츠 페이지 배경 (bg-cherry-blossom)**: 벚꽃 이미지 원복 (`bg-cherry-blossom.png`)
- **콘텐츠 컨테이너 배경 (bg-content-floral)**: 새 개나리 꽃 이미지 적용 (`bg-content.png`)
  - 적용 9곳: incheon/subsidy/festival/blog 상세, about, privacy, life/choice(헤더+하단), life/restaurant(헤더)
  - 기존 `bg-white` → `bg-content-floral` 교체
- 커밋: `1a02ed5` (1차), `afc063d` (2차 히어로), `759373e` (벚꽃 원복 + 콘텐츠 배경 최종)

### 홈페이지 히어로 아래 섹션 흰색 배경 + 하단 복원

- **히어로 아래 전체 배경**: `bg-cherry-blossom` → `bg-white` (웨이브 아래 벚꽃 제거)
- **웨이브 SVG fill**: `#FFFBF0` → `#ffffff`
- **"왜 픽앤조이인가요?" 섹션**: 흰색으로 변경했다가 사용자 요청으로 `from-orange-50 to-orange-100` 복원
- 커밋: `7b09aae` (흰색 변경), `38a8217` (하단 주황색 복원)

### Sticky 사이드바 GPU 레이어 프로모션 강화

- **macOS 관성 스크롤 미세 떨림 수정** (이전 수정 후 잔존 jitter 대응)
- `transform`: `translateZ(0)` → `translate3d(0, 0, 0)`
- `will-change`: `transform` → `transform, top`
- 신규: `perspective: 1000px`, `contain: layout style`, `transition: none`
- `top`: Tailwind `6rem` → CSS `5.95rem` (서브픽셀 렌더링 최적화)
- 커밋: `194100e`

### 홈 배경 아이보리 크림 (#F9F9F7) 변경

- 순백색(`bg-white`) → 아이보리 크림(`bg-[#F9F9F7]`)으로 변경 (눈 편안함 + 부드러운 전환)
- 웨이브 SVG fill도 `#ffffff` → `#F9F9F7` 동기화
- 커밋: `7f23ce8`

### 히어로 CTA 버튼 스타일 통일

- 보조금 버튼만 `bg-orange-500 text-white`로 불일치 → 3개 모두 `bg-white text-orange-600 border border-orange-200`으로 통일
- 커밋: `b60873c`

### 카테고리 카드 UI 개선

- **헤더 중앙정렬**: 카테고리 타이틀·설명 `text-center` 적용
- **카드 화살표 카테고리별 색상**: 인천 `text-blue-600`, 보조금 `text-orange-600`, 축제 `text-purple-600`
- **더보기 링크**: 카테고리별 색상 적용 + 점선 테두리 제거
- 커밋: `e354cc2`

### 카드 포인트 요소 시각적 강조

- 화살표 색상 `*-400` → `*-600`, hover `*-700`
- strokeWidth `2` → `2.5`
- 더보기 텍스트 `font-medium` → `font-bold`
- 커밋: `fb6de1f`

### 텔레그램 4/3 리포트 이슈 4건 수정

1. **경기 맛집 포스트 미생성 (2/3)**: 버킷 재분배 로직 + 경기 포스트 수동 생성 (`파스타예요 광교본점`)
2. **블로그 테이블 1열 줄바꿈**: `globals.css`에 `.blog-prose table td:first-child, th:first-child { white-space: nowrap }` 추가
3. **admin/runs에 4/3 리포트 미표시**: `deploy.yml`에 리포트 커밋 후 최종 빌드+배포 단계 추가
4. **경기 맛집 포스트 생성**: `2026-04-03-suwon-restaurant-390921841.md`

- 커밋: `5290e53`

---

## 2026-04-02

### 일간 자동화 리포트 한글 파일명 인코딩 버그 수정

- **현상**: 텔레그램 알림과 admin/runs에서 블로그 3건 생성 중 1건만 표시
- **근본 원인**: `write-daily-report.mjs`의 `git log --name-only`에서 Git 기본 설정 `core.quotePath=true`가 한글 파일명을 octal 이스케이프(`\354\225\204\353\271\240...`)로 출력 → `summarizeChanges()`가 `src/content/posts/*.md` 패턴 매칭 실패
- **수정**: `git -c core.quotePath=false log ...` 옵션 추가 → 한글 파일명 정상 출력
- **향후 효과**: 앞으로 모든 일일 리포트에서 한글 파일명 블로그/맛집 포스트가 정확히 카운트됨
- 커밋: `cdec179`

### 텔레그램 알림에 데이터 수집 결과 추가

- **요청 배경**: 텔레그램 알림에 데이터 수집 성공/실패 여부 및 건수 미표시
- **수집 스크립트 수정** (`collect-incheon.js`, `collect-subsidy.js`, `collect-festival.js`):
  - 각 스크립트에 `GITHUB_OUTPUT`으로 `collect_summary` 출력 추가
  - 형식: `신규 N건, 총 M건` (인천/보조금) / `신규 N건, 업데이트 M건, 총 K건` (축제)
- **deploy.yml 수정**: `COLLECT_INCHEON_SUMMARY`, `COLLECT_SUBSIDY_SUMMARY`, `COLLECT_FESTIVAL_SUMMARY` 환경변수 전달
- **write-daily-report.mjs**: Stage1 데이터에 `collectSummary` 객체 추가
- **notify-telegram.mjs**: 3개 신규 라인 추가
  - `📡 데이터 수집:` 각 단계 ✅/❌/🚫/⏭️ 아이콘
  - `📋 수집 결과:` 항목별 신규/업데이트/총 건수
  - `📂 데이터 변경:` 변경된 데이터 파일명
- 커밋: `cdec179`

### 맛집 포스트 제목 가이드라인 개선

- **문제**: 맛집 포스트 제목이 `지역 + 상황` 조합으로만 구성되어 음식/메뉴 정체성 부재
- **수정**: `generate-life-restaurant-posts.mjs` 프롬프트의 제목 규칙 변경
  - 기존: `"지역 + 상황 + 왜 여기 체크하는지"`
  - 변경: `"지역 + 음식 장르/특색 + 왜 여기 체크하는지"` + 좋은/나쁜 예시 추가
- 커밋: `cdec179`

### admin/runs 대시보드 데이터 보정 (4/2)

- **현상**: admin 대시보드에 "블로그 1건"으로 표시 (실제 3건 생성)
- **원인**: 이미 저장된 `runs/daily/2026-04-02.json`에 인코딩 버그 데이터가 고정
- **수동 보정**:
  - `2026-04-02.json`: `generatedBlogPosts` 1→3건, `allChangedFiles`/`commits` 한글 파일명 복원
  - `index.json`: `generatedBlogCount` 1→3
- 커밋: `632782f`

### 종료일 지난 항목 블로그 생성 방지

- **문제**: `generate-blog-post.js`가 `expired` 플래그만 체크 → 수집 시점 기준이라 종료일 지나도 `false`인 채 후보에 포함
- **예시**: 논산딸기축제 (`eventenddate: 20260329`) — 3/29 종료 후 4/1에 다시 블로그 생성됨
- **수정**: `isEndDatePassed()` 함수 추가 — 오늘 날짜 vs 실제 종료일 비교
  - 축제: `eventenddate` (YYYYMMDD)
  - 인천/보조금: `endDate` (YYYY-MM-DD)
  - 종료일 없음/상시 → 필터링 안 함 (정상 후보 유지)
- 커밋: `a23b203`

### BY.OUR 블랙 맥주 샴푸 초이스 포스트 작성

- **신규 초이스 포스트**: `src/content/life/2026-04-02-choice-byour-black-beer-shampoo.md`
- **로컬 이미지**: `public/images/choice/byour-black-beer-shampoo.jpg`
- **쿠팡 링크**: `https://link.coupang.com/a/efCy9F`

- **규칙 확립**: 초이스 포스트 본문(마크다운 body)에 쿠팡 배너/링크/iframe 삽입 금지
- **사이드바 배너**: frontmatter `coupang_banner_image`를 통해 자동 렌더링 (기존 방식 유지)
- **수정 대상**: byour, cj-biocore, catsrang 3개 포스트에서 본문 내 쿠팡 배너 HTML 제거
- **생성기 규칙 추가**: `generate-choice-post.js`에 본문 배너 삽입 금지 규칙 명문화
- **copilot-instructions.md**: 규칙 10번 "초이스 포스트 본문 배너 금지" 추가

---

## 2026-03-31

## 2026-04-01

### Cloudflare Worker `pick-n-joy-trigger` 배포

- `/admin/runs/`의 수동 실행 버튼(전체 업데이트/배포만)이 Worker 미배포로 "Failed to fetch" 오류 발생
- Worker 코드 작성 및 Cloudflare에 배포 완료
  - 코드: `workers/trigger/index.js`, `workers/trigger/wrangler.toml`
  - URL: `https://pick-n-joy-trigger.royshong01.workers.dev`
  - Secrets: `ADMIN_SECRET`, `GITHUB_TOKEN` (wrangler secret put)
  - 인증: `X-Admin-Secret` 헤더 검증
  - 동작: GitHub API `workflow_dispatch` → `deploy.yml` 트리거 (mode: full/deploy_only)
- 테스트 완료: 잘못된 시크릿 → 401 거부, 올바른 시크릿 → workflow dispatch 성공
- 커밋: `686ddd8`

### Admin 페이지 UI 수정

- **admin/runs 상단 여백**: `py-10` → `pt-20 pb-10` (네비바와 콘텐츠 간격 확보)
- **admin 메인 상단 여백**: 동일하게 `pt-20 pb-10` 적용
- **admin 메인 "수동 실행 트리거" 플레이스홀더 카드 제거** (runs 페이지에 이미 기능 존재)
- 커밋: `982b288`, `04bac69`(revert), `b564589`, `a9e1210`

### 블로그/맛집 카테고리 썸네일 이미지 교체

- **기존**: 카테고리별 단색 그라데이션 + 텍스트 라벨 (CSS only)
- **변경**: 카테고리별 커스텀 일러스트 이미지로 교체
- **블로그 목록** (`BlogFilter.tsx`):
  - 인천 지역 정보 → `/images/incheon-thumbnail.jpg`
  - 전국 보조금·복지 → `/images/subsidy-thumbnail.png`
  - 전국 축제·여행 → 기존 그라데이션 유지 (이미지 미준비)
- **맛집 목록** (`LifeFilterClient.tsx`):
  - 인천 맛집 → `/images/restaurant-incheon-thumbnail.png`
  - 서울 맛집 → `/images/restaurant-seoul-thumbnail.png`
  - 경기 맛집 → `/images/restaurant-gyeonggi-thumbnail.png`
- 구현 방식: `CATEGORY_THUMBNAIL_IMAGES` / `RESTAURANT_THUMBNAIL_IMAGES` 매핑 → 이미지 있으면 `<Image>`, 없으면 기존 그라데이션 fallback
- 커밋: `075f6a8` ~ `0237f4e` (다수 교체 반복)

### 정책/소개 페이지 UI 정리 + 문의 이메일 교체

- **개인정보 처리방침 여백 보정**: `src/app/privacy/page.tsx`
  - 상단 설명문과 `1. 수집하는 정보 및 이용 목적` 섹션 사이 여백 확대 (가독성 개선)
- **사이트 소개 우측 광고 배너 제거**: `src/app/about/page.tsx`
  - 태허철학관/쿠팡 사이드 영역 삭제, 본문 중심 단일 레이아웃으로 정리
- **프로젝트 문의 이메일 교체**:
  - 기존: `roysshong@gmail.com`
  - 변경: `royshong01@gmail.com`
  - 반영 파일: `src/app/about/page.tsx`, `src/app/privacy/page.tsx`
- **검증**: `npm run build` 성공
- 커밋: `794460b` (여백/배너 정리), `5cbfdeb` (문의 메일 교체)

### Figma MCP 연결 이슈 정리

- 원인: SethFord MCP Figma Extension(WebSocket 방식)과 Copilot MCP 설정 혼재로 연결 실패
- 조치:
  - 충돌 확장(`sethford.mcp-figma-extension`) 제거
  - 로컬 Copilot MCP 설정 유지: `.vscode/mcp.json`
  - 토큰 파일 비커밋 처리: `.gitignore`에 `.vscode/mcp.json` 추가

### AdSense 검증 오류 원인 분석 및 배포 파이프라인 수정

- **현상**: AdSense 콘솔에서 "사이트를 확인할 수 없습니다" 반복 발생
- **진단 결과**:
  - `ads.txt` 자체는 정상 서빙(200) 및 Googlebot/Mediapartners-Google 접근 가능
  - 라이브 HTML 검사 시 `adsbygoogle.js` 스크립트가 누락된 배포본 존재
  - 원인: GitHub Actions `deploy.yml`의 빌드 env에 `NEXT_PUBLIC_ADSENSE_ID` 미주입
- **조치**:
  - `.github/workflows/deploy.yml`의 모든 Next.js 빌드 단계(1단계/2단계/3단계/공통)에
    `NEXT_PUBLIC_ADSENSE_ID='ca-pub-5984189992308575'` 추가
  - 실서버 재검증: 홈 HTML에 AdSense script 포함 확인
- **검증**:
  - Mediapartners-Google 기준 홈/`/ads.txt` 모두 200 응답
  - `/ads.txt` 내용 정상: `google.com, pub-5984189992308575, DIRECT, f08c47fec0942fa0`

### 개인정보 처리방침 페이지 추가 (AdSense 심사용 필수 항목 대응)

- **신규 페이지**: `src/app/privacy/page.tsx`
  - 쿠키 사용 고지
  - Google DART 쿠키 안내
  - 맞춤형 광고 거부 안내(광고 설정)
  - 수집 정보 및 이용 목적 안내
- **Footer 링크 추가**: `src/components/SiteFooter.tsx`
  - `개인정보 처리방침(/privacy)`
  - `사이트 소개(/about)`
- **검증**: `npm run build` 성공 (`/privacy` 라우트 생성 확인)
- 커밋: `848871b` (CI AdSense env 반영), `8dc883b` (privacy 페이지 + footer 링크)

### 서울 축제 1건 자동 생성 테스트 (Gemini 키 재발급 검증)

- **자동 생성 스크립트 개선**: `scripts/generate-blog-post.js`
  - `BLOG_ONLY_KEYWORD` 환경변수 추가
  - `title/name/addr1/overview`에 키워드가 포함된 항목만 후보로 필터링 가능
- **테스트 실행**:
  - `BLOG_ONLY_CATEGORY="전국 축제·여행"`
  - `BLOG_ONLY_KEYWORD="서울"`
  - 위 조건으로 Gemini 자동 생성 1회 실행
- **생성 결과**:
  - `src/content/posts/2026-03-31-yangjaecheon-cherryblossom-lantern-festival.md`
  - source_id: `2540520` (양재천 벚꽃 등(燈) 축제, 서울 서초구)
- **검증**: `npm run build` 성공

### 초이스 생성기 Gemini 키 로딩 오류 복구

- **원인**: `scripts/generate-choice-post.js`의 환경변수 로더가 `.env`를 먼저 읽고, 이미 값이 있으면 `.env.local` 값을 덮어쓰지 않도록 구현되어 있었음
  - 저장소 `.env`의 `GEMINI_API_KEY`가 플레이스홀더(`your_key_here`)여서 Google API에서 `API_KEY_INVALID` 발생
- **조치**:
  - `.env.local`이 `.env`를 override 하도록 로더 우선순위/덮어쓰기 규칙 수정
  - CJ 입력 파일로 재실행하여 자동 생성 성공 확인
- **검증**:
  - `node scripts/generate-choice-post.js --input scripts/choice-input.cj-biocore.json` 성공
  - `npm run build` 성공

### CJ 바이오코어 초이스 포스트 재작성 + 생성기 프롬프트 보강

- **초이스 생성기 개선**: `scripts/generate-choice-post.js`
  - 제목 과장 표현 금지(`가장 확실한 방법`, `정착기`, `완벽한`, `끝판왕` 등) 규칙 추가
  - 입력 데이터 밖의 통계/임상 수치/비교 우위 생성 금지 규칙 강화
  - `outputFileName` 지원 추가로 기존 포스트 파일을 지정 재생성할 수 있게 보강
  - 로컬 실행 시 `.env`, `.env.local` 자동 로드 기능 추가
- **CJ 포스트 본문 재작성**: `src/content/life/2026-03-31-choice-cj-biocore-probiotics.md`
  - 번역투/과장형 제목 제거
  - 근거 없는 비교 수치/효능성 문구 제거
  - 캐츠랑 포스트와 유사한 자연어형 초이스 톤으로 본문 전면 재정비
- **입력 파일 추가**: `scripts/choice-input.cj-biocore.json`
- **검증**: `npm run build` 성공

### 캐츠랑 20kg 초이스 포스트 추가

- **신규 초이스 포스트 추가**: `src/content/life/2026-03-31-choice-catsrang-20kg.md`
  - 쿠팡 링크 `https://link.coupang.com/a/efdAq0` 기반으로 고양이 사료 초이스 글 작성
  - 상단 이미지는 전면 패키지 사진, 본문 중간 이미지는 후면 QR/성분 안내 사진 사용
- **로컬 이미지 추가**:
  - `public/images/choice/catsrang-20kg-front.jpg`
  - `public/images/choice/catsrang-20kg-back.jpg`
- **검증**: `npm run build` 성공

### 쿠팡 초이스 수동 입력 기반 자동 글 생성 스크립트 추가

- **신규 스크립트**: `scripts/generate-choice-post.js`
  - 수동 입력 JSON(`--input`)을 받아 Gemini 프롬프트 생성 후 초이스 포스트 마크다운 자동 생성
  - 필수 입력: `title`, `englishName`, `summary`, `coupangUrl`, `coupangHtml`
  - frontmatter 정규화(카테고리/평점/쿠팡 필드), 파일명 안전화, 본문 정리 후 `src/content/life`에 저장
- **예시 입력 파일 추가**: `scripts/choice-input.example.json`
- **npm 스크립트 추가**: `package.json`에 `generate:choice` 등록
- **검증**:
  - `node scripts/generate-choice-post.js --help` 실행 성공
  - `npm run build` 성공
- 커밋: `07d015b`

### 초이스 포스트 운영 보정 + 네비/목록 동작 정리

- **초이스 신규 포스트 추가**: `src/content/life/2026-03-31-choice-cj-biocore-probiotics.md`
  - 카테고리 `픽앤조이 초이스`, 쿠팡 필드(`coupang_link`, `coupang_banner_image`, `coupang_banner_alt`), 평점 필드(`rating_value`, `review_count`) 반영
- **이미지 운영 수정**:
  - 상단 히어로 이미지를 로컬 첨부 이미지로 교체: `public/images/choice/cj-biocore-detail.jpg`
  - 본문 중간의 중복 이미지 제거 (상단 이미지와 중복 노출 방지)
- **본문 품질 보정**:
  - 단계형 영어 헤딩 제거 및 자연스러운 한국어 소제목으로 통일
  - 본문 내 중복 고지문 제거 (상세 페이지 하단 공통 고지문과 중복 방지)
  - 인코딩 깨짐 이슈 발생분 복구 (프론트매터/본문 정상화)
- **네비/목록 UX 수정**:
  - 헤더 메뉴 순서 변경: `일상의 즐거움`을 `블로그` 앞에 배치 (데스크톱/모바일 공통)
  - 검색 돋보기 아이콘 크기 소폭 확대 (`20 → 22`)
  - 블로그 목록에서 맛집 글 제외 (`픽앤조이 맛집 탐방` 및 맛집성 글), 맛집 글은 `일상의 즐거움` 영역에서만 노출
- 커밋: `de1dbce`, `4902539`, `897d63a`, `0b180bb`, `b10f4d1`, `3ff606d`

### sitemap 확장 + 사이트 목적 문구 SEO 반영

- **sitemap 생성 로직 고도화** (`scripts/generate-sitemap.js`):
  - 기존 블로그 중심 구조에서 전체 섹션 기반으로 확장
  - 포함 대상: `/incheon`, `/subsidy`, `/festival`, `/life`, `/life/choice`, `/life/restaurant`, `/rss.xml` 및 각 상세 페이지
  - URL 인코딩/중복 제거/lastmod 보정 처리
  - 생성 결과: `399개 URL`(당시)
- **사이트 목적 문구 SEO 반영**:
  - `src/app/layout.tsx`: 전역 metadata description/OG description 보강, `WebSite` JSON-LD description 업데이트, `Organization` JSON-LD 추가
  - `src/app/page.tsx`: 홈 전용 metadata(description/OG/canonical) 추가
  - `src/app/about/page.tsx`: 운영 목적/데이터 출처/콘텐츠 생성 방식 문구를 시민 체감형 큐레이션 톤으로 재작성
- 커밋: `6e3a175`, `ebe1a5c`

### admin/runs 수동 트리거 버튼 + Cloudflare Worker 연동

- **Cloudflare Worker 준비 완료**: GitHub Actions `deploy.yml`의 `workflow_dispatch`를 호출하는 별도 Worker 구성
  - Worker URL: `https://pick-n-joy-trigger.royshong01.workers.dev`
  - 보안: `GITHUB_TOKEN` + `ADMIN_SECRET` 시크릿 검증 방식
  - 입력값: `mode = full | deploy_only`
- **`src/components/AdminTriggerPanel.tsx`** (신규 클라이언트 컴포넌트):
  - 버튼 2개 추가: `전체 업데이트 실행`, `배포만 실행`
  - 실행 중 스피너 표시 + 버튼 비활성화
  - Worker POST 호출 후 성공/실패 메시지 표시
- **`src/app/admin/runs/page.tsx`**:
  - 페이지 상단에 `AdminTriggerPanel` 연결
  - 최신 리포트 유무와 무관하게 수동 실행 UI 노출
- **검증**: `npm run build` 성공 확인 후 커밋/푸시 완료
- 커밋: `a769647`

### admin/runs 상세 보기 - 날짜 행 클릭 확장 패널 (RunsDetailPanel)

- **배경**: `/admin/runs/[date]` 동적 라우트 방식은 `output: export` + `generateStaticParams` 빈 배열 시 빌드 에러 발생 → accordion 방식으로 전환
- **`src/lib/daily-runs.ts`**: `getDailyRunReport(date)` 단건 조회 함수 추가
- **`src/components/RunsDetailPanel.tsx`** (신규 클라이언트 컴포넌트):
  - 날짜 행 클릭 시 그 아래 확장 패널 표시 (▶/▼ 토글)
  - 상세 내용: 요약 수치(블로그/맛집/데이터/전체 파일), Gemini 예산 현황, 단계별 실행 결과(세부 스텝 포함), 커밋 목록(SHA GitHub 링크 + 변경 파일 태그), 생성 파일 분류(블로그=orange, 맛집=sky, 데이터=emerald)
  - 동시에 하나만 열림 (`expandedDate` state)
- **`src/app/admin/runs/page.tsx`**: `RunsDetailPanel` import 및 날짜 이력 섹션 교체, 안내 문구 추가
- 커밋: `740615a`

### Gemini API 비용 가드 + 모델 전환 + maxOutputTokens

- **문제**: Gemini 2.5 Pro 과금 폭탄 (₩28,920, 원인: aggressive retry + 고가 모델)
- **모델 전환**: `gemini-2.5-pro` → `gemini-2.5-flash-lite` (실제 API 호출로 가용성 확인)
  - `gemini-2.0-flash`, `gemini-1.5-flash` → 404 (이 계정에서 미지원)
  - `gemini-2.5-flash`, `gemini-2.5-flash-lite` → 200 ✅
- **추가된 상수** (`generate-blog-post.js`):
  - `GEMINI_MODEL`: 기본값 `gemini-2.5-flash-lite`
  - `GEMINI_MAX_OUTPUT_TOKENS`: 기본값 `8192` (블로그 짤림 방지)
  - `BLOG_GEMINI_MIN_DELAY_MS`: 호출 간 최소 지연 (5000ms)
  - `BLOG_MAX_API_CALLS`: 일일 최대 API 호출 횟수 (10)
  - `BLOG_DAILY_BUDGET_KRW`: 일일 예산 상한 (500원 초과 시 자동 중단)
  - `GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS`: 비용 추정 단가
- **GitHub Actions** (`deploy.yml`) 환경변수 동기화
- **`write-daily-report.mjs`**: 예산 사용 현황 리포트 섹션 추가
- **`src/lib/daily-runs.ts`**: `DailyRunReport.budget` 인터페이스 추가
- **`src/app/admin/runs/page.tsx`**: 예산 상태 배너 + 히스토리 테이블 컬럼 추가
- 커밋: `58f4ef7` (비용 가드), `f550316` (maxOutputTokens 8192)

### Cloudflare Access — /admin/* 접근 보호 설정

- **Cloudflare Zero Trust** `pick-n-joy-admin` Application 생성 완료
  - Domain: `pick-n-joy.com` / Path: `/admin/*` / Session: 24시간
  - Login 방식: One-time PIN (OTP) 이메일 인증
- **2025년 11월 이후 Cloudflare Zero Trust UI 경로 변경 사항**:

  | 기능 | 구 경로 | 현재 경로 |
  | ------ | -------- | ---------- |
  | Login methods / IdP | Settings → Authentication | Integrations → Identity providers |
  | Access Applications | Access → Applications | Access controls → Applications |
  | WARP 설정 | Settings → WARP | Team & Resources → Devices |
  | 로그/모니터링 | Logs | Insights |

- OTP 설정: Zero Trust → Integrations → Identity providers → Add new → One-time PIN
- Application 생성: Zero Trust → Access controls → Applications → Add an application → Self-hosted

### 모바일 햄버거 네비게이션 추가

- **MobileNav 컴포넌트** (`src/components/MobileNav.tsx`) 신규 생성
  - `lg:hidden` 모바일 전용 햄버거(☰) + 검색(🔍) 버튼
  - 드롭다운으로 5개 네비 링크 표시, 클릭 시 자동 닫힘
  - 검색 버튼은 SearchOverlay 직접 토글
- **SiteHeader 수정** (`src/components/SiteHeader.tsx`):
  - MobileNav import + 렌더링 추가
  - 로고 `ml-10` → `ml-2 lg:ml-10`, `h-14` → `h-10 sm:h-14` (모바일 최적화)
  - `relative` 추가 (드롭다운 위치 기준)
- 커밋: `df4b994`

### 왕가의 산책 블로그 글 본문 완성

- `2026-03-30-post-1774856309930.md` (source_id: 2433596) 잘린 본문 보완
  - 기념사진 하이라이트, 추천 대상 리스트, 방문 정보 테이블 추가
- 커밋: `e084acc`

### 사이트 전체 검색 기능 추가 (Fuse.js)

- **빌드타임 검색 인덱스** (`scripts/generate-search-index.js`):
  - incheon/subsidy/festival JSON + 블로그/맛집/초이스 마크다운 전체 인덱싱 (총 377건)
  - 만료 항목 자동 제외, `out/data/search-index.json` 출력
  - `postbuild`에 연동 (`generate-sitemap.js && generate-search-index.js`)
- **SearchOverlay 컴포넌트** (`src/components/SearchOverlay.tsx`):
  - `'use client'`, Fuse.js 퍼지 검색 (threshold 0.35, 가중치: title 0.5 > summary > tags > category)
  - 카테고리별 컬러 배지 (인천=blue, 보조금=orange, 축제=purple, 블로그=green, 초이스=amber, 맛집=red)
  - ESC/배경클릭 닫기, 최대 15건 표시, 첫 열기 시 lazy load
- **SearchButton 클라이언트 래퍼** (`src/components/SearchButton.tsx`):
  - SiteHeader(서버 컴포넌트) 유지하면서 검색 상태 관리
  - 🔍 아이콘 버튼 → SearchOverlay 토글
- **SiteHeader 통합** (`src/components/SiteHeader.tsx`):
  - nav 우측에 SearchButton 배치, 서버 컴포넌트 구조 유지
- 커밋: `8c90b5b`

### CTA 버튼 스타일 통일 + 텍스트 축소 + 맛집 제목 1줄 처리

- 보조금 CTA `bg-white text-orange-600` → `bg-white/15 backdrop-blur-sm text-white` (축제/맛집과 동일 글래스 스타일)
- 3개 CTA 텍스트 `text-lg px-8 py-4` → `text-sm sm:text-base px-6 py-3.5` + `whitespace-nowrap`
- 맛집 페이지 제목 `text-3xl md:text-4xl` → `text-2xl md:text-3xl` (1줄 표시)
- 커밋: `aadfb30`

### 히어로 맛집 CTA 추가 + 상단 여백 축소

- 히어로 CTA 버튼 3번째 추가: `🍽️ 요즘 뜨는 맛집 보러가기` → `/life/restaurant`
- 히어로 섹션 `min-h-[85vh]` → `min-h-[70vh]`로 축소 (네비↔배지 여백 약 35% 감소)
- 커밋: `4c56009`

### 글로벌 네비/푸터 적용 + 소개 메뉴 제거

- **SiteHeader 그라디언트 리디자인** (`src/components/SiteHeader.tsx`):
  - `'use client'` + `usePathname()` 제거 → 서버 컴포넌트로 변환
  - 그라디언트 배경(`from-orange-500 via-orange-600 to-purple-700`), `sticky top-0 z-20`
  - Image 로고(`h-14 w-auto`), `ml-10`/`mr-10` 중앙 정렬
  - 흰색 텍스트 링크(`text-white/90 hover:text-white hover:bg-white/10`)
- **SiteFooter 신규 생성** (`src/components/SiteFooter.tsx`):
  - `bg-gray-900`, 좌측 큐레이션 문구 + 우측 코피라이트, `text-gray-400`
- **layout.tsx 글로벌 반영** (`src/app/layout.tsx`):
  - `SiteHeader` + `SiteFooter` import 및 body 내 전역 렌더링
  - `flex flex-col min-h-screen` + children `flex-1` wrapper로 sticky footer
- **홈페이지 내장 네비/푸터 제거** (`src/app/page.tsx`):
  - 임베디드 `<header>` 네비(25줄), `<footer>`, `Image` import, `min-h-screen` 제거
- **10개 페이지 개별 헤더/푸터 제거**:
  - incheon/page, subsidy/page, festival/page, blog/page: SiteHeader import/사용 + footer 전체 제거
  - incheon/[id], subsidy/[id], festival/[id]: SiteHeader + footer 제거
  - about/page: SiteHeader + 미사용 Link import 제거
  - blog/[slug]: SiteHeader 제거
  - life/layout: SiteHeader + footer 제거
  - 전 페이지 `min-h-screen` 제거 (layout.tsx에서 처리)
- **소개 메뉴 제거** (`SiteHeader.tsx`, `SiteFooter.tsx`):
  - 네비에서 `{ label: '소개', href: '/about' }` 항목 삭제
  - 푸터에서 `| 소개` 링크 제거
- **커밋 이력**: `8881fde` → `ad28901` → `b21f9f4`

### 홈페이지 전면 개편 + 레이아웃 미세조정

- **블로그 목록에서 초이스 포스트 필터링** (`src/app/blog/page.tsx`):
  - `category !== '픽앤조이 초이스'` 조건으로 블로그 목록에서 초이스 글 제외
- **블로그 썸네일 높이 축소** (`src/components/BlogFilter.tsx`):
  - 카테고리 썸네일 `h-40` → `h-20`으로 50% 축소
- **깨진 블로그 글 6편 삭제** (`src/content/posts/`):
  - 3/28 Gemini API 오류(EUC-KR 인코딩 깨짐)로 생성된 6개 파일 삭제
- **홈페이지 전면 개편** (`src/app/page.tsx`):
  - 태허 철학관 참고 디자인 기반 완전 재작성
  - 그라데이션 히어로(orange→purple) + 애니메이션 배경 도형 + CTA 버튼 + 통계 카운터
  - 3열 카테고리 카드(그라데이션 헤더, 실제 JSON 데이터 연동)
  - `globals.css`에 `fade-in`, `fade-in-up` 키프레임 애니메이션 추가
- **copy.md 카피 적용** (`src/app/page.tsx`):
  - Problem 섹션("혹시 이런 경험 있으신가요?") 추가
  - CTA 섹션("오늘부터 시작하세요") 추가
  - 히어로 부제 + 카테고리 상세 설명 반영
- **Problem 섹션 레이아웃 개선** (`src/app/page.tsx`):
  - 3열 수직 카드 → 가로 스트립 레이아웃 변경
  - 섹션 간 패딩 ~20% 축소
- **Features + CTA 섹션 통합** (`src/app/page.tsx`):
  - 흰색 배경 Features 섹션 + 주황색 CTA 섹션을 하나의 주황색 그라데이션 섹션으로 병합
  - 6개 피처 카드를 주황색 배경 위 반투명 카드(bg-white/10)로 변경
  - CTA를 간결한 무료 안내 문구로 축소 (3개 카드·CTA 버튼·부가 텍스트 제거)
- **커밋 이력**: `262a81a` → `9e3d1b7` → `9b34197` → `d9ac45f` → `6a03ca1` → `5cba1fb`

### 홈페이지 레이아웃 미세조정 (2차)

- **Problem 카드 3열 가로 배치** (`src/app/page.tsx`):
  - 세로 스택 → `md:grid-cols-3` 1행 가로 배치로 변경
- **카테고리 카드 높이 통일** (`src/app/page.tsx`):
  - 홈페이지 카드 `min-h-[140px]` → `h-[150px]` 고정 높이
- **Features+CTA 섹션 컴팩트화** (`src/app/page.tsx`):
  - 패딩/카드 크기 축소, 설명 텍스트 `text-white font-medium`으로 가독성 개선
- **로고 이미지 적용** (`src/app/page.tsx`, `public/images/logo-pick-n-joy.png`):
  - 홈 네비 + 푸터의 텍스트 로고를 `next/image` 로고 이미지로 교체
- **배지↔타이틀 간격 축소** (`src/app/page.tsx`):
  - 히어로 배지 `mb-12` → `mb-5`
- **카테고리 헤더 이모티콘 제거** (`src/app/page.tsx`):
  - `{cat.emoji}` div 제거
- **벗꽃 배경 이미지 적용** (`globals.css`, 10개 페이지/레이아웃):
  - `public/images/bg-cherry-blossom.png` 추가
  - `.bg-cherry-blossom` CSS 클래스 (cover, fixed, no-repeat)
  - 홈 제외 전 페이지 `bg-slate-50` → `bg-cherry-blossom`
- **네비 로고 크기 조정** (`src/app/page.tsx`):
  - `h-28` → `h-14`, 헤더 `pt-2` 추가로 브라우저 바와 간격 확보
- **홈 네비 폰트** (`src/app/page.tsx`):
  - `text-sm` → `text-base font-medium` (SiteHeader와 동일)
- **목록 페이지 카드 높이 통일** (IncheonCardList/SubsidyCardList/FestivalCardList):
  - `min-h-[220px]` → `h-full` (CSS Grid 행 내 동일 높이 자동 적용, 블로그 카드와 동일 방식)
- **copilot-instructions.md 규칙 추가**:
  - 작업 규칙 9번: 사용자 미승인 수정 금지 + 불분명 시 확인 질문 후 진행
- **커밋 이력**: `eb6d727` → `57844c6` → `a6589fe` → `f32db5a` → `5121862` → `6201afb`

---

## 2026-03-30

### Copilot 운영 기준 문서 축소 (Claude 문서 비의존 전환)

- 사용자 운영 정책 확정:
  - 앞으로 Copilot은 `CLAUDE.md` / `PROJECT_MEMORY.md`를 필수 로드/동기화 대상으로 사용하지 않음
  - Copilot 관리 대상은 `WORK_LOG.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md` 3개로 고정
- 반영 파일:
  - `.github/copilot-instructions.md` 작업 규칙/종료 루틴/확인 질문 문구를 3개 문서 기준으로 수정
  - `COPILOT_MEMORY.md` 시작 체크리스트 및 운영 규칙을 3개 문서 기준으로 수정
- 목적:
  - 세션 초기 컨텍스트 경량화
  - 운영 문서 중복 관리 제거

### 픽앤조이 초이스 히어로/문구 미세조정

- **히어로 이미지 잘림 이슈 해결** (`src/app/blog/[slug]/page.tsx`):
  - 초이스 히어로 이미지 렌더링을 `object-cover` → `object-contain`으로 변경
  - 제품 이미지가 좌우/상하 잘리지 않고 원본 비율로 보이도록 보정
- **히어로 하단 간격 확대** (`src/app/blog/[slug]/page.tsx`):
  - 초이스 히어로 wrapper 마진 `mb-8` → `mb-14`로 확대
  - 히어로와 본문 첫 단락 사이 간격 개선
- **초이스 고지문 색상 미세조정** (`src/app/blog/[slug]/page.tsx`):
  - 안내문 텍스트 톤 `text-stone-700` → `text-stone-800`로 상향
  - "이거 없던 시절의..." 문장과 유사한 가독성/명도 기준으로 통일
- **검증/반영**:
  - `npm run build` 성공
  - 커밋/푸시: `ee72b92`

### 픽앤조이 초이스 카테고리 신설 + 수동 리뷰 포스트 2편 작성

- **픽앤조이 초이스 기능 구조**:
  - `src/lib/life-choice.ts`: `ChoiceArticle` 인터페이스 + `getChoiceArticles()` 필터 로직 추가
    - `픽앤조이 초이스` 카테고리 포스트를 자동 수집
    - 기존 3대 카테고리(인천/보조금/축제) 포스트는 제외
  - `src/app/life/choice/page.tsx`: 초이스 목록 페이지 (ChoiceArticleCard + CoupangBottomBanner)
  - `src/components/life/ChoiceArticleCard.tsx`: 블로그형 전문 카드 컴포넌트 (ReactMarkdown 렌더링)
  - 포스트 저장 위치: `src/content/life/` (기존 맛집 포스트와 동일 디렉터리)
  - 초이스 포스트 전용 frontmatter: `coupang_link`, `coupang_banner_image`, `coupang_banner_alt`, `rating_value`, `review_count`

- **수동 리뷰 포스트 2편 작성 (픽앤조이 초이스 카테고리)**:
  - `src/content/life/2026-03-30-choice-lemouton-mate-navy.md`
    - 제목: "TV 광고 속 그 운동화, 르무통 메이트에 결국 정착한 진짜 이유"
    - 평점: 4.9 / 리뷰수: 2,850
    - 쿠팡 링크: `https://link.coupang.com/a/eeover`
  - `src/content/life/2026-03-30-choice-nutridday-lutein-omega3.md`
    - 제목: "충혈된 눈과 이별하는 가장 확실한 방법, 루테인 오메가3 정착기"
    - 평점: 4.8 / 리뷰수: 1,540
    - 쿠팡 링크: `https://link.coupang.com/a/eekIni`

---

## 2026-03-29

### 맛집 톤 리프레시 + 저품질 포스트 교체

- `scripts/collect-life-restaurants.mjs`:
  - 2030 취향 핫플형 검색어 세트로 전면 교체 (예: 송도 브런치 카페, 성수동 팝업 근처 맛집, 연남동 내추럴 와인바)
  - `sourceQuery`, `scenarioHint`, `vibeHint`, `cuisineHint` 메타데이터 저장 및 trend score 정렬 적용
- `src/lib/life-restaurants.ts`:
  - 런타임 로더도 동일한 쿼리/메타데이터/정렬 규칙으로 동기화
- `scripts/generate-life-restaurant-posts.mjs`:
  - 프롬프트를 교과서형 정보문에서 저장형 핫플 큐레이션 톤으로 전환
  - `FORCE_RESTAURANT_SOURCE_IDS` 환경변수로 특정 source_id 재생성 지원
- 콘텐츠 정리:
  - 기존 저품질 포스트 2건 삭제
    - `2026-03-29-restaurant-18763742.md`
    - `2026-03-29-restaurant-870136692.md`
  - 신규 포스트 2건 생성
    - `2026-03-29-인천-젠젠-본점.md`
    - `2026-03-29-서울-미테이블-성수본점.md`
- 데이터 갱신:
  - `src/app/life/restaurant/data/restaurants.json` 재수집 완료 (인천/경인 15건, 서울/경기 15건)
- 검증:
  - `npm run collect:life-restaurants` 성공
  - `npm run generate:life-restaurant-posts` 성공
  - `npm run build` 성공

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
  - SEO용 slug/description/frontmatter(place_name, place_address, place_url 등) 추가
- `src/app/life/page.tsx`:
  - 생성된 맛집 포스트가 있으면 맛집 탭에서 우선 노출
  - 아직 포스트가 없을 때만 카카오맵 외부 링크 카드 fallback
- `src/app/blog/[slug]/page.tsx`:
  - 맛집 포스트는 `Restaurant` JSON-LD, 초이스 포스트는 `Product` JSON-LD 출력
  - 검증 가능한 별점/리뷰수 없으면 `aggregateRating`는 생략해 구조화 데이터 신뢰도 유지
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
