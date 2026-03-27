# CLAUDE.md ???�앤조이 ?�로?�트 가?�드

> ?�업 ?�작 ??반드???�기. ?�션 종료 ??"## ?�업 ?�력" ?�데?�트.

## ?�로?�트 기본 ?�보
- ?�이?�명: ?�앤조이 (pick-n-joy.com)
- ?�로�? "?�신???�상??Pick, ?�신??주말??Enjoy!"
- 로컬 경로: D:\Dev\my-local-info
- GitHub: https://github.com/RoyHong01/my-local-info
- 배포: Cloudflare Pages (https://my-local-info-2gs.pages.dev ??pick-n-joy.com)

## 기술 ?�택
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Claude API (claude-haiku-4-5) ??블로�?글 ?�동 ?�성
- 공공?�이?�포??API + ?�국관광공??TourAPI ???�이???�집
- GitHub Actions ??매일 07:00 KST ?�동 ?�행 (cron: `0 22 * * *`)
- Cloudflare Pages (wrangler) ???�스??�?배포

## ?�경변??(.env.local)
| 변??| ?�도 | ?�태 |
|------|------|------|
| ANTHROPIC_API_KEY | Claude API 블로�??�성 | ??|
| PUBLIC_DATA_API_KEY | 공공?�이?�포??(보조�?4, ?�천) | ??|
| TOUR_API_KEY | ?�국관광공??TourAPI | ??|
| KAKAO_API_KEY | 카카??로컬 API | 미사??(2?�계) |
| NEXT_PUBLIC_GA_ID | Google Analytics | 미설??|
| NEXT_PUBLIC_ADSENSE_ID | Google AdSense | 미설??|
| NEXT_PUBLIC_COUPANG_PARTNER_ID | 쿠팡 ?�트?�스 | 미설??|

## GitHub Actions Secrets
- CLOUDFLARE_API_TOKEN ??- CLOUDFLARE_ACCOUNT_ID ??- PUBLIC_DATA_API_KEY ??- TOUR_API_KEY ??- ANTHROPIC_API_KEY ??
## API ?�드?�인??- 보조�?4: https://apis.data.go.kr/1741000/Subsidy24
- TourAPI: https://apis.data.go.kr/B551011/KorService2

## 콘텐�?카테고리 & ?�이??| 카테고리 | ?�이???�일 | ?�태 |
|----------|------------|------|
| ?�천 지???�보 | public/data/incheon.json | ??|
| ?�국 보조금·복지 | public/data/subsidy.json | ??|
| ?�국 축제·?�행 | public/data/festival.json | ??|
| ?�국 맛집 | public/data/restaurant.json | 미구??(2?�계) |

## 만료 처리 방식
- ?�일 ??�� X (SEO 보존) ??`expired: true` 마킹
- 목록 ?�이지: expired ??�� ?�터�?- ?�세 ?�이지: "종료???�사" 배�? ?�시

## ?�더 구조
```
src/app/
  page.tsx              # 메인 (멀?�카?�고�???
  incheon/page.tsx      # ?�천 지???�보 목록
  incheon/[id]/page.tsx # ?�천 ?�세
  subsidy/page.tsx      # ?�국 보조�?목록
  subsidy/[id]/page.tsx # 보조�??�세
  festival/page.tsx     # ?�국 축제·?�행 목록
  festival/[id]/page.tsx# 축제 ?�세
  blog/page.tsx         # AI 블로�?목록
  blog/[slug]/page.tsx  # 블로�??�세
  rss.xml/route.ts      # RSS ?�드
  about/page.tsx        # ?�개 ?�이지

src/components/
  BlogFilter.tsx        # 블로�?카테고리 ?�터 (use client)
  IncheonCardList.tsx   # ?�천 카드 목록 (use client, ?�크�??�??
  SubsidyCardList.tsx   # 보조�?카드 목록 (use client, ?�크�??�??
  FestivalCardList.tsx  # 축제 카드 목록 (use client, ?�크�??�??
  ScrollRestorer.tsx    # ?�크�??�치 복원 (use client, storageKey prop)

scripts/
  collect-incheon.js    # ?�천 ?�이???�집
  collect-subsidy.js    # 보조�??�이???�집
  collect-festival.js   # 축제 ?�이???�집 (overview ?�함)
  generate-blog-post.js # Claude API 블로�??�동 ?�성 (카테고리�?2????
  cleanup-expired.js    # 만료 콘텐�?처리
  generate-sitemap.js   # sitemap.xml ?�성 (postbuild)

.github/workflows/
  deploy.yml            # push ?�는 07:00 KST ?�동??```

## ?�업 규칙
1. ?�업 ?????�일(CLAUDE.md) 먼�? ?�기
2. ???�일 ?�성 ???�더 구조 ?�션 ?�데?�트
3. ???�경변?�·Secret 추�? ???�당 ?�션 ?�데?�트
4. ?�션 종료 ???�업 ?�력 ?�짜·?�약 추�?
5. **커밋 ??반드??`npm run build` ?�행** ??빌드 ?�류 ?�인
6. **커밋 ?????�일 ?�락 주의**: `git status`�?untracked ?�일 ?�인 ??명시?�으�?`git add`
7. 빌드 ?�공 ??`git add [?�일목록] ??git commit ??git push` ?�서�?배포
8. Copilot 병행 ??`.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md` ?�기??9. **모든 ?�업 종료 루틴(?�수)**: 코드 ?�정 ?�업???�나�?반드??`build ?�공 ??commit/push ?�료 ??4�?문서 ?�기??CLAUDE.md, .github/copilot-instructions.md, COPILOT_MEMORY.md, PROJECT_MEMORY.md)` ?�서�??�행?�며, 미완�????�션 종료�?간주?��? ?�음.

## ?�업 ?�력

### 2026-03-26

- ?�로?�트 ?�천/?�국 멀?�카?�고�?구조�??�면 ?�설�?(?�남 ???�천/?�국)
- ?�경변???�정�? scripts/ ?�편, GitHub Actions ?�데?�트
- ?�플 ?�이??3�??�성, ?�세 ?�이지 구현, Cloudflare 배포 ?�인
- 블로�??�동 ?�성 구축: Gemini ??gemini-2.0-flash (쿼터 문제, ?�재 미사??
- BlogFilter.tsx, RSS ?�드, ?�이�??�치?�드바이?� ?�증 추�?

### 2026-03-27

- 축제 ?�세 ?�이??복구:
  - `collect-festival.js` overview ?�삭(200?? ?�거 ???�문 ?�세?�명 보존
  - ?�래???�플 3�?`festival-001~003`) API ?�본 매핑/교체 로직 추�?
  - 매칭 ?�패 ?�플 ?�동 ?�리 + `contentid/id` 기�? 중복 ?�거 추�?
  - `festival.json` ?�수�??�료 (?�플 ?�거/교체 ??API 기반 ?�이?�로 ?�리)

- ?�국 ?�래?�트 구조 ?�리 �?문서???�기??
  - CLAUDE.md, copilot-instructions.md, COPILOT_MEMORY.md, PROJECT_MEMORY.md 기술 ?�택 ?�일
  - Next.js 14 ??**16 ?�정**, Gemini ??**Claude API** ?�정 (claude-haiku-4-5)
  
- **?�세 ?�이지 가?�성 개선 (최종):**
  - **?�트 컬러 강화**: `text-stone-700` ??`text-stone-900` (검?�색??가까운 짙�? ?�색)
  - **?��? ?�트 ?�택 ?�그?�이??* (globals.css):
    - 기본�? `"Pretendard Variable", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic"` ??    - 가?�성 + ?�?�포그래??최적??(`ss01`, `ss02` 기능)
  - **?�천/보조�??�세 (`incheon/[id]/page.tsx`, `subsidy/[id]/page.tsx`)**:
    - `InfoRow` 컴포?�트: ?�스??>170???�동 문단 분리 로직 추�?
    - �??�이 조정: `leading-relax` ??`leading-7`, ?�락 �??�백: `space-y-1` ??`space-y-2`
    - ?�이�? `text-xs text-stone-400` ??`text-xs text-stone-500 uppercase mb-1.5 tracking-wide`
    - ?�딩 ?�리: `py-4` ??`py-3`
  - **축제 ?�세 (`festival/[id]/page.tsx`)**:
    - ?�로??`splitParagraphs()` ?�수: 공백 문단 기�? 먼�? 분리, ??문장 ?�위 분리
    - ?�더�? ?�일 `overview` 문자????`overviewParagraphs` 배열 매핑
    - ?�?�포그래?? `text-[15px] text-stone-900 leading-7 space-y-3` (???��? ?�락 간격)
  - **빌드 검�?*: `npm run build` ?�과 (300+ ?�이지 ?�전 ?�더�? sitemap.xml ?�성 ?�공)

- **@tailwindcss/typography ?�러그인 ?�성??(prose ?�용):**
  - `tailwind.config.ts` ?�일 ?�성 (v4 ?�경?�서 ?�수)
  - 블로그�? ?�일???��???(prose-stone) ?�일
  - ?�천/보조�?축제 ?�세 ?�이지 본문 ?�역??`prose prose-stone` ?�래?�로 감싸�?  - ?�?�포그래??강화: ?�락 간격, 글???�기, line-height ?�동 최적??  - 블로그처??강력??가?�성 ?�과 ?�성

- **?�세 ?�이지 ?�이?�웃/?�?�포그래??추�? 개선:**
  - ?�용???�드�?반영: ?�세 ?�이지 체감 ??�� 좁아 보이??문제 ?�정
  - ?�세 ?�이지 4�?`incheon/[id]`, `subsidy/[id]`, `festival/[id]`, `blog/[slug]`) 메인 컨테?�너 `max-w-5xl` ??`max-w-7xl` ?�장
  - ?�세 ?�이지 prose ?��???강화: `prose-orange`, `lg:prose-lg`, `prose-p:leading-8` ???�용
  - 빌드 ?��?�??�료 (`npm run build` ?�과)

- **?�세 ?�이지 ??미세 조정 (?�용???�드�?반영):**
  - 과도??좌우 ?�장 체감 보정: ?�세 4?�이지 메인 컨테?�너 `max-w-7xl` ??`max-w-6xl`
  - ?�?? `blog/[slug]`, `incheon/[id]`, `subsidy/[id]`, `festival/[id]`
  - 빌드 검�??�료 (`npm run build` ?�과)

- **블로�?본문 구조/가?�성 규칙 강화:**
  - 본문 ???�딩??메인 ?�목보다 �?보이지 ?�도�?H1?�H2 ?�동 보정 (`posts.ts`)
  - ?�이 ?�는 글?� ?�목 기반 ??`## ...`)??본문 �?줄에 ?�동 ?�입
  - `1. ?�제�??�명`/`**1. ?�제�?*`/`**1️⃣ ?�제�?*`/`1️⃣ ?�제�? ?�턴??    `### 1. ?�제�? + ?�음 ?�명 ?�락 ?�태�??�동 변??  - 번호 ?�제�??�음 문단 ?�여?�기(code block ?�인) 보정?�로 좌우 ?�크�?`pre`) 문제 ?�결
  - 빌드 ?�출물에??`h3 1/2/3` 분리 �?`pre/code` ?�거 검�??�료

- **블로�??�성 ?�롬?�트 강화 (`scripts/generate-blog-post.js`):**
  - ??글?� 본문 �?줄을 ??##)?�로 ?�작?�도�?지??  - 추천 ?�유 3가지??`### 1/2/3` ?�식 + ?�명 ?�락 분리 ?�식?�로 지??
- **?�세 콘텐�?블로그형 고도??(기존+?�후 ?�시 ?�용):**
  - ?�세 3?�이지(`incheon/[id]`, `subsidy/[id]`, `festival/[id]`) 본문??`ReactMarkdown + prose` 중심 ?�더링으�??�환
  - ?�이?�에 `description_markdown`???�으�??�선 ?�용, ?�으�?기존 ?�드 기반 fallback markdown ?�동 ?�성?�로 즉시 ?�용
  - ?�집 ?�크립트 3�?`collect-incheon.js`, `collect-subsidy.js`, `collect-festival.js`)??Anthropic 기반 `description_markdown` ?�성 로직 추�?
  - `description_markdown_source_hash` 캐시 방식?�로 변경된 ??���??�생?�하??비용 최소??  - ?�집 로그???�력/출력 ?�큰 ?�용??출력 추�?(비용 추적??
  - `DESCRIPTION_MARKDOWN_BATCH_LIMIT` ?�경변?�로 ?�행???�성 건수 ?�한(기본 10�??�여 초기 백필 과�???방�?

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

### 2026-03-27 (4)

- **인천/보조금 카드 고정 높이 & 텍스트 넘침 방지:**
  - 카드 div에 `max-h-[280px]` + `overflow-hidden` 추가 → 어떤 데이터에도 높이 일정
  - `rawSummary` 최대 120자 강제 절삭 (지원내용 fallback은 80자 선절삭 후 120자 제한)
  - flex 컨테이너 안 `line-clamp` 미작동 버그 수정: 아이콘(`flex-shrink-0`)과 텍스트 `<span>`을 분리하고 텍스트 span에만 `line-clamp-1 overflow-hidden` 적용
  - 대상: `IncheonCardList.tsx`, `SubsidyCardList.tsx`

### 2026-03-27 (5)

- **인천/보조금 카드 그리드 정렬 완전 통일:**
  - Link에 `block h-[300px]` 적용 → 그리드 셀 높이 완전 고정
  - 카드 div를 `h-full overflow-hidden`으로 변경 → Link 높이를 꽉 채워 모든 카드 동일 크기
  - `min-h` / `max-h` 제거, `h-full` 단일 방식으로 통일
  - 대상: `IncheonCardList.tsx`, `SubsidyCardList.tsx`

### 2026-03-27 (9)

- **블로그 상세 페이지 히어로 이미지 추가:**
  - `blog/[slug]/page.tsx`: `Image` 컴포넌트 import 추가
  - `post.image`가 있고 `.svg`가 아닌 경우 prose 위에 `h-72 md:h-96` 히어로 이미지 표시
  - `next.config.ts`는 `unoptimized: true` 상태로 외부 도메인 설정 불필요

### 2026-03-27 (8)

- **수동 블로그 포스트 추가:**
  - `2026-03-27-gurye-sansuyu-flower-festival.md` 신규 생성
  - 제목: "2026 구례 산수유꽃 축제 후기 + 내년 가이드"
  - 누적 블로그 포스트: 총 17편

### 2026-03-27 (7)

- **수동 블로그 포스트 추가:**
  - `2026-03-27-nationwide-cherry-blossom-top-15.md` 신규 생성 (포스트 1편)
  - 제목: "2026 전국 벚꽃 축제 명소 TOP 15 총정리" (하나의 글에 15곳 소개)
  - 카테고리: 전국 축제·여행, source_id: manual-cherry-blossom-2026
  - 누적 블로그 포스트: 기존 14편 + 1편 = 총 15편

### 2026-03-27 (6)

- **인천/보조금 카드 구조를 FestivalCardList와 동일하게 통일:**
  - Link `className` 제거 (고정 높이 방식 폐기)
  - 카드 div: `h-full overflow-hidden` 제거, `min-h-[220px]` 추가
  - summary `<p>`: `flex-grow` 추가 → 하단 org/target 영역을 카드 맨 아래로 자연스럽게 밀어냄
  - 하단 `<div>`: `mt-auto` 제거 (flex-grow로 대체)
  - 대상: `IncheonCardList.tsx`, `SubsidyCardList.tsx`

## ?�음 ?�업 ?�정

- Google Analytics (GA ID) ?�정
- 쿠팡 ?�트?�스 배너 ?�입
- Google AdSense ?�청 (?�스??15???�상 ??
