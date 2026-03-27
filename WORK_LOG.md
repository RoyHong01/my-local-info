# WORK_LOG.md — 픽앤조이 작업 이력

> 상세 작업 이력 보관용. CLAUDE.md에는 포함하지 않음.
> 최신 항목이 위에 오도록 작성.

---

## 2026-03-27

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
