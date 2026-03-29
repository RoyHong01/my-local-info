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
| KAKAO_API_KEY | 카카오 로컬 API | 미사용 (2단계) |
| NEXT_PUBLIC_GA_ID | Google Analytics | ✅ G-6VNKGES4FW |
| NEXT_PUBLIC_ADSENSE_ID | Google AdSense | 미설정 |
| NEXT_PUBLIC_COUPANG_PARTNER_ID | 쿠팡 파트너스 | ✅ AF5831775 |

## GitHub Actions Secrets
- CLOUDFLARE_API_TOKEN ✅
- CLOUDFLARE_ACCOUNT_ID ✅
- PUBLIC_DATA_API_KEY ✅
- TOUR_API_KEY ✅
- ANTHROPIC_API_KEY ✅

## API 엔드포인트
- 보조금4: https://apis.data.go.kr/1741000/Subsidy24
- TourAPI: https://apis.data.go.kr/B551011/KorService2

## 콘텐츠 카테고리 & 데이터
| 카테고리 | 데이터 파일 | 상태 |
|----------|------------|------|
| 인천 지역 정보 | public/data/incheon.json | ✅ |
| 전국 보조금·복지 | public/data/subsidy.json | ✅ |
| 전국 축제·여행 | public/data/festival.json | ✅ |
| 전국 맛집 | public/data/restaurant.json | 미구현 (2단계) |

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
  generate-blog-post.js # Claude API 블로그 자동 생성 (카테고리당 2편)
  cleanup-expired.js    # 만료 콘텐츠 처리
  generate-sitemap.js   # sitemap.xml 생성 (postbuild)

public/
  data/                 # incheon.json, subsidy.json, festival.json
  images/               # 공식 포스터 이미지 저장소

.github/workflows/
  deploy.yml            # push 또는 07:00 KST 자동 배포
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
- 마무리: "함께 가면 좋은 사람" 언급
- 유지 항목: 정보완전성 규칙, image 처리, FILENAME 형식, ### 1.2.3. 구조

## 블로그 현황 (2026-03-28 기준)
- 총 28편: 인천 지역 정보 9편, 전국 보조금·복지 9편, 전국 축제·여행 9편, 기타 1편
- 자동 생성: GitHub Actions 매일 07:00 KST, 카테고리당 2편 (Gemini 2.5 Pro, MZ 감성)
- 2026-03-28: 진해군항제 수동 중복 제거(1편 삭제) → 고창청보리밭 축제 추가(1편)
- 2026-03-28: 인천 봄꽃 축제 중복 제거(1편 삭제), 유지본 제목·이미지·source_id 수정
- 2026-03-28: 블로그 썸네일 TourAPI 실제 이미지로 교체 (진해/여의도/경포/구례/광안리)

## 쿠팡 파트너스 배너 현황 (2026-03-28)
- 파트너ID: AF5831775
- 사이드바: id 976088, 240x600, `CoupangBanner`
  - src: `https://ads-partners.coupang.com/widgets.html?id=976088&template=carousel&trackingCode=AF5831775&subId=&width=240&height=600&tsource=`
- 하단: id 976089, 680x300, `CoupangBottomBanner`
  - src: `https://ads-partners.coupang.com/widgets.html?id=976089&template=carousel&trackingCode=AF5831775&subId=&width=680&height=300&tsource=`
- 구현 방식: **공식 iframe 직접 임베드** (useEffect/script 방식 완전 제거)
  - `referrerPolicy="unsafe-url"` 필수
  - `bannerId` prop은 인터페이스 호환용으로만 유지 (실제 미사용)
- 적용 페이지: blog목록/상세, incheon목록/상세, subsidy목록/상세, festival목록/상세 (총 8곳)
- 공정위 문구: 전 페이지 footer에 추가 완료

## 다음 작업 예정
- ~~Google Analytics (GA ID) 설정~~ ✅ 완료
- ~~쿠팡 파트너스 배너 삽입~~ ✅ 완료
- Google AdSense 신청 (페이지 15개 이상 완료)
- 카카오 API 맛집 페이지 구축 (2단계)
