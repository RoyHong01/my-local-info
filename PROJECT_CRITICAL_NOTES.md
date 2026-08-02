# PROJECT_CRITICAL_NOTES.md — 픽앤조이 핵심 가이드

> **이 파일의 목적**: WORK_LOG.md(4000줄+)는 방대해서 매번 읽기 어렵다. 이 파일은
> "이 프로젝트에서 반드시 알아야 할 핵심 사실 · 반복된 함정 · 불변 규칙"만 압축한다.
>
> **작업/디버깅 시작 전 이 파일을 먼저 읽는다.** 특히 "알려진 함정(§2)"을 확인해
> **이미 규명된 원인을 처음부터 다시 추론하지 않는다.** 코드만 보고 추론하다
> 과거에 밝혀진 사실과 어긋나는 오진을 내는 사고가 반복됐다(§2 참조).
>
> - 상세 이력: `WORK_LOG.md`
> - 운영 규칙·로직 고정: `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`
> - 최종 진실은 실제 코드/스냅샷/런타임. 이 문서와 코드가 다르면 코드를 확인 후 이 문서를 갱신한다.

---

## 1. 프로젝트 한눈에 (Quick Facts)

| 항목 | 값 |
|---|---|
| 사이트 | https://pick-n-joy.com |
| GitHub | `RoyHong01/my-local-info` |
| 로컬 | `C:\LangProjects\my-local-info` |
| Cloudflare Pages | https://my-local-info-2gs.pages.dev |
| 스택 | Next.js 16 App Router + TypeScript + Tailwind v4, `output: "export"` (정적 배포) |
| 배포 | Cloudflare Pages + GitHub Actions (매일 **01:00 KST**, `deploy.yml`) |
| 수익화 | Google AdSense + 쿠팡 파트너스(`AF5831775`) — **현재 AdSense 재신청 준비 단계** |
| GA | `G-6VNKGES4FW` / AdSense `ca-pub-5984189992308575` |

### 콘텐츠 카테고리 (4개 + 편집 레이어)

1. **인천 지역 정보** — 공공데이터 API (대부분 **보조금·복지**, 일부 축제/문화)
2. **전국 보조금·복지** — 공공데이터 API (텍스트 정보)
3. **전국 축제·여행** — 한국관광공사 TourAPI (`searchFestival2`)
4. **일상의 즐거움** — 맛집(구글/네이버 이미지) + 초이스(쿠팡)
5. **편집 레이어** — 블로그·큐레이션·축제비교 (AI 생성). **← 장기 자산의 본체**

### 블로그 생성 모델 (2026-07-24~)
- 일반 블로그·큐레이션·축제비교 = **Claude Sonnet 5** (Batch 통합). 블라인드 A/B 1위.
- 초이스·맛집 = **Gemini** 경로 유지.
- 상세 markdown(인천/보조금/축제 본문) = **Gemini** (`collect-*.js`).
- **모델 결정 보류 중**: AdSense 통과까지 Sonnet 유지, 통과 후 비용(월 3~4만원) 관점에서 Gemini 복귀 재검토.

---

## 2. 알려진 함정 (Known Pitfalls) — **가장 중요. 디버깅 전 필독**

> 아래는 실제로 여러 번 오진했다가 규명된 사안이다. 증상만 보고 새로 추론하면
> 같은 함정에 빠진다. **"왜 그렇게 됐는지(의도·히스토리)"를 기억하는 것이 핵심.**

### 2-1. ⚠️ 7/25 prepare/finalize refactor가 여러 fallback을 끊었다 (형제 버그군)

- **배경**: 2026-07-24 Sonnet 5 Batch 통합 때 블로그 생성기를 `prepareBlogRequest` /
  `finalizeBlogRequest` 구조로 분리했다(`generate-blog-post.js`).
- **부작용**: 이 분리 과정에서 **fallback/재검증 로직이 finalize 쪽에서 누락**되는 회귀가
  최소 두 곳에서 발생했다.
  - **맛집 finalize context 유실** (`9166a74`에서 수정) — prepare가 만든 context를 finalize가 못 받음.
  - **인천/보조금 이미지 landmark fallback 중단** — `finalizeBlogRequest`(around `:1823`)에
    landmark 재호출이 없어, prepare에서 이미지 못 구하면 finalize에서 복구 못 하고 default로 빠짐.
- **증상 타임라인**: **7/26부터** 인천·보조금 블로그 hero가 default로 빠지기 시작.
  (7/25 refactor 배포 직후 생성분부터)
- **교훈**: 앞으로 prepare/finalize류 리팩터를 할 때는 **finalize에도 fallback/재검증
  안전망이 남아있는지 반드시 확인**한다. "candidate는 넘어가는데 fallback 실행 코드가
  한쪽에서 빠지는" 패턴을 조심.
- **착각 금지**: 이 증상을 "게이트 문제"나 "데이터 없음"으로 오진하기 쉽다(아래 2-2 참조).
  실제 분기점은 **7/25 코드 변경**이다.

### 2-2. ⚠️ 인천/보조금 이미지는 "원본에 없다" — API가 키워드로 채운 것

- **사실**: 보조금·복지 정보는 **원본 데이터에 이미지가 없다(순수 텍스트)**.
  관공서 지원 정책에는 사진이 없다.
- **어떻게 이미지가 붙나**: `INCHEON_PHOTO_API`(=API003, `collect-incheon.js`, 2026-04-14 연동)가
  **지역명 키워드로 관광사진을 검색**해서 `firstimage`를 채운다.
  - 예: `"월미도"` 검색 → **GS25 월미도 선착장점** 사진. `"송도"` → 송도컨벤시아. `"인천광역시"` → 인천시립박물관.
  - **관공서 복지 글에 편의점(GS25) 사진이 붙는 이유가 이것** — 원본이 아니라 키워드 검색 결과다.
- **착각 금지**: 코드에서 `firstimage`가 채워진 걸 보고 **"원본에 이미지가 있었다"고
  추론하면 틀린다.** 전부 API가 사후에 채운 것이다.
- **fallback 체인** (`generate-blog-post.js`):
  `candidate.firstimage → landmark 검색(getRegionalLandmark, 관광공사 tong.visitkorea) → default-incheon.svg`
  - 7/22까지는 firstimage 없어도 landmark가 관광공사 이미지를 채웠다(정상).
  - 7/25 refactor가 이 landmark fallback을 finalize에서 끊음 → 7/26부터 default (§2-1).
- **주의**: `COPILOT_MEMORY.md`의 "인천 이미지: 인천관광공사 API 비활성화, TourAPI 키워드
  매칭 성공 시만 반영"이라는 메모가 있으나, 실제로는 API003이 이미지 소싱의 핵심이다.
  이 메모 문구가 혼란의 원인이 될 수 있으니 코드(`collect-incheon.js`)를 진실로 삼는다.

### 2-3. ⚠️ 미색인(GSC "크롤링됨-미색인")의 정체 = 본문 빈 페이지

- **사실**: GSC 미색인 다수(800건대)의 정체는 **description_markdown이 빈 Top 상세 페이지**였다.
  sitemap에 올려 구글에 "색인하라"고 안내했지만 본문이 없어 구글이 색인 거부.
- **규모**(2026-08 기준): subsidy 337 / incheon 140 / festival 195 = **약 672건**이 빈 본문.
  특히 **festival은 Top 218건 중 195건(89%)이 빈 본문**이었다.
- **조치**: `generate-sitemap.js`에서 **빈 description_markdown Top 항목은 sitemap 제외**
  (채워지면 자동 재포함). sitemap이 1,511 → 정리됨.
- **채우기**: `description_markdown` 배치를 하루 인천5/보조금5/축제5로 상향(빈 항목 우선 버킷).
  채워지는 대로 sitemap 자동 복귀.
- **교훈**: "데이터(항목)는 넘치는데 본문이 안 채워진 것"이 문제였다. **"데이터 풀 부족"으로
  오해하지 말 것** — subsidy는 7,000건+ 있다. 부족한 건 본문 생성 속도.

### 2-4. ⚠️ 삭제만으로는 재생성을 못 막는다 — reject-list tombstone 필요

- **사실**: 맛집/인천 후보는 스냅샷(`restaurants.json` 등)의 source_id + 현존 .md의
  existingIds로 **매일 다시 뽑힌다**. .md만 삭제하면 스냅샷에 source_id가 남아 **다음날 재생성**된다.
- **조치**: `restaurant-reject-list.json`을 tombstone(영구 제외 명부)으로 확장.
  `reason`: `manual_delete` / `image_mirror_failed` / `no_live_image_source`.
  후보 선정 시 이 목록 제외 + 이미지 미러링 전부 실패 시 자동 등록(실패 학습).
- **교훈**: "삭제했는데 또 생긴다"류 문제는 **후보 목록(스냅샷)과 삭제가 연동 안 됨**이 원인.
  삭제 = 증상 제거일 뿐. 근본은 "후보에서 왜 안 빠지나".

### 2-5. ⚠️ "URL 문자열이 있다" ≠ "이미지가 살아있다"

- 후보 필터가 `googlePhotoUrl || naverPhotoUrl` 식으로 **문자열 유무만** 보면,
  죽은 URL(404/403)도 "사진 있음"으로 통과시킨다 → 생성 시 미러링 실패 → default.
- **HEAD 405/403은 오탐일 수 있다** — 네이버/카카오 CDN은 HEAD를 막고 GET만 허용하는
  경우가 많다. **생존 확인은 GET(Range bytes=0-0)으로**. 실제로 405 17건이 전부 GET에선
  살아있던 사례가 있다. content-type이 `image/*`가 아니면(예: octet-stream) 미채택이 맞다.

### 2-6. ⚠️ 맛집 로컬 이미지 커밋 누락 (해결됨, 참고용)

- 7/13 로컬 이미지 기능 도입 후, Stage3 자동 커밋이 `public/images/restaurants`를
  git add에서 빠뜨려 "참조는 있는데 파일이 배포에 없음" 발생. → deploy.yml에서 해결됨(현재 포함).
- 외부 URL 이미지(식신 siksinhot 등)는 원본 서버가 내리면 죽는다. 다만 205개 중 실제 죽음은
  2건(1%) 수준으로, 외부 URL 방식이 대량 붕괴하는 건 아니다.

---

## 3. 불변 규칙 (Invariants) — 승인 없이 어기지 말 것

### 3-1. API 비용
- **유료 API(구글 플레이스) 실호출로 검증/테스트 금지.** mock, 시드 캐시, 스케줄 실행
  리포트만 사용. 불가피한 실호출은 **사전 승인 필수**.
- **구글 플레이스 사진은 후보 수집 때 로컬에 저장**해두고, 포스트 생성 시엔 저장된 로컬
  사진을 쓴다(재호출 없음 = 비용 0). 이게 Places 비용 폭탄(6~7월 ~70만원) 봉합의 핵심.
- 무료 API(관광공사/TourAPI/카카오/API003)는 재소싱 자유. 단 캐시로 중복 호출만 방지.
- 공개 산출물(`src/content`, `restaurants.json`)에 **Places key 포함 URL 저장 절대 금지**
  (`check:no-exposed-keys`가 빌드 전 차단).

### 3-2. 색인 / SSG (규칙 21 계열)
- **SSG는 Top ID만 생성.** `generateStaticParams`/sitemap/RSS 상한 해제는 **사용자 명시 승인 필수**.
  이게 AdSense Low Value 대응의 핵심축. 풀면 4월 저품질 문제로 회귀.
- 404 완화는 SSG 상한 해제가 아니라 수집 단계 `expired: true` 보존으로 처리.
- **404는 무해**하다. 삭제된 페이지가 404 반환은 정상. 대량 404(5,000건대)는 과거 대형
  sitemap(4월 8,298 URL) 시절 잔재이며 자연 소멸 대기. 억지로 되살리지 말 것.
- 빈 본문 Top 페이지는 sitemap 제외(§2-3).

### 3-3. 코드 작업 안전 (파일 손상 방지)
- **한 번에 한 파일만 수정.** 여러 파일 동시 str_replace는 파일 손상을 반복 유발한다
  (모델 무관: GPT-5.3-Codex, Sonnet, Fable 5 등에서 모두 발생). 각 파일:
  수정 → `node --check` → `git diff --stat`(대량 삭제 감지 시 중단) → 다음 파일.
- **커밋 정책**: 수정은 한 파일씩 순차 진행하되, **커밋·push는 한 작업 단위에 1회로 묶는다**(코드 + 문서 단일 커밋). 연속 push 시 GitHub Actions가 이전 run을 자동 취소해 CI 이력이 오염되기 때문. 논리적으로 무관한 작업이 섞일 때만 커밋을 분리한다. (`copilot-instructions.md` 작업 규칙 8 참조)
- **`node -e` / PowerShell 인라인 실행 금지** — 프롬프트 문자열이 셸 파싱에서 깨진다.
  임시 `.cjs` 파일을 만들어 실행.
- 0바이트/대량 변경 감지 시 즉시 중단, `git restore --source` 또는 `git checkout <commit> --`로 복구.
- 셸 리다이렉트(`git show ... > file`)로 복구 금지.

### 3-4. 로직 고정 (승인 없이 수정 금지) — `COPILOT_MEMORY.md` 상세
- 블로그 발행 기본: 인천 1 / 축제 1 / 보조금 2 (`generate-blog-post.js`, 우선순위: 마감임박 > 조회수 > 최근수정).
- 상세 markdown 배치: 인천 5 / 보조금 5 / 축제 5 (빈 항목 우선 버킷). *(기존 인천2/축제2/보조금5에서 상향)*
- 상세 본문 렌더: `description_markdown || generatedMarkdown`. fallback: `src/lib/*-markdown.ts`.
- **AI 재가공 필드 보존**: 매일 수집 머지 시 `{...(prev||{}), ...item}` 패턴으로
  `description_markdown` 등 유지. 재생성은 `description_markdown_source_hash` 변경 시에만
  (원본 실제 변경 시에만 재호출 = 비용 절약).
- 이미지 소싱 우선순위: 공식 포스터 → TourAPI firstimage → 카테고리 SVG. **Unsplash 금지.**

---

## 4. 데이터 · 이미지 소싱 구조 (착각 방지용 지도)

### 4-1. 카테고리별 이미지 출처
| 카테고리 | hero 이미지 출처 | 비고 |
|---|---|---|
| 인천 | API003(INCHEON_PHOTO_API) 키워드 검색 → landmark(관광공사) → default | **원본에 이미지 없음.** API가 채움 (§2-2) |
| 보조금 | (인천과 동일 generate-blog-post 경로) → landmark → default | 원본 텍스트, 이미지 없음 |
| 축제 | TourAPI `firstimage` | 원본 이미지 있음 |
| 맛집 | 구글 플레이스(로컬 저장) → 네이버 → default. 카페는 네이버 fallback 허용 | 후보 수집 때 로컬 미러링 |
| 초이스 | 쿠팡/수동 제공 이미지 | — |

### 4-2. 후보 수집 → 생성 2단계 구조
```
[수집] collect-*.js → JSON 스냅샷(source_id + firstimage 등) 저장 (이미지도 여기서 로컬화)
[생성] generate-blog-post.js / generate-life-restaurant-posts.mjs → 스냅샷 소비 → .md 생성
```
- 이미지 소싱은 **수집 단계에서 미리 붙이는 게 원칙**(생성 단계는 얇은 안전망).
  생성 단계에서 매번 API 호출하면 부하·중복·네트워크 민감도가 커진다.

### 4-3. 만료 처리
- `endDate`/`eventenddate` 기준 `expired: true` 마킹. **삭제 아님, 페이지 유지**
  (내년 같은 ID 재수집 시 부활). Top에서는 제외되므로 만료 후 실서버 404가 되긴 한다.

---

## 5. 자동화 · 비용 (Anthropic)

- **구독 크레딧(데스크탑앱)과 API 크레딧(console.anthropic.com)은 별개 지갑.**
  자동화(API)가 멈추면 Console에서 충전/자동충전/월한도를 확인. 데스크탑 충전은 무관.
- Batch 50% 할인 적용됨(청구로 확인). Sonnet 하루 ~$0.6, 월 ~2.7만원(인트로가), 9/1~ ~4만원.
- 리포트 실측 vs 콘솔 청구가 근접하면 정상. 미발행 0 = 낭비 없음.
- 스케줄 01:00 KST(`0 16 * * *`). Batch timeout 6시간, 폴링 5분, fallback 재시도 상한 1회.

---

## 6. VS Code AI 협업 특성 (중요)

- **규칙을 알면서도 실행에서 무시하는 경향이 있다.** copilot-instructions를 정확히 인용하면서도
  다중 파일 수정으로 파일을 깨거나(§3-3), Trading System에서 basename 금지 규칙을 어긴다.
  모델 4종(GPT-5.3-Codex, GPT Sol, Sonnet, Fable 5)에서 동일 → 모델 문제가 아니라 습관/구조 문제.
- **대응**: 규칙에 의존하지 말고 **프롬프트 설계로 예방**한다.
  - 다중 파일 → "한 파일씩" 쪼개서 지시.
  - 진단은 **한 번에 한 가지**만. 증상 덮기(default 교체/삭제)가 아니라 근본 원인(왜 후보에서
    안 빠지나/왜 fallback 안 도나) 규명 우선.
- **VS Code 진단이 반례와 충돌하면 반례를 믿는다.** "5월 복지 글은 이미지 정상이었다" 같은
  경험적 반례가 코드 추론보다 정확한 경우가 많았다. 진단이 반례를 설명 못 하면 그 진단은 틀린 것.

---

## 7. 작업 종료 체크리스트

1. `npm run build` 통과 (또는 `node --check` + 관련 검증).
2. 파일별 순차 커밋 → push (한 파일씩, §3-3).
3. 문서 동기화: `WORK_LOG.md` + 이 파일 + `COPILOT_MEMORY.md`/`PROJECT_MEMORY.md`.
   - **이 파일(§2 함정)에 새로 규명된 원인·의도를 추가**해 다음 착각을 예방한다.

---

## 8. 현재 진행 상황 (2026-08 기준, 수시 갱신)

- **AdSense 재신청 준비 중.** 미색인(빈 페이지) 정리 완료, GSC 1~2주 관찰 후 재신청.
- 색인 문제(404/리디렉션/미색인) 사실상 정리 완결, 구글 반영 대기.
- 빈 본문 채우기 하루 15건 자동 가동.
- 맛집 이미지: reject-list tombstone으로 재생성 방지 완료.
- **인천/보조금 이미지 회귀(§2-1, §2-2): 7/25 refactor의 finalize landmark fallback 복구 진행 중.**
  실서버(GitHub Actions)는 API003 IP 등록됨 → 백필 가능. VS Code 로컬은 UNREGISTERED_IP_ERROR로 막힘.
- 모델(Sonnet vs Gemini): AdSense 통과 후 결정 보류.

---

*이 문서는 "다시 같은 함정에 빠지지 않기 위한" 살아있는 가이드다. 새 함정을 규명할 때마다 §2에 추가한다.*
