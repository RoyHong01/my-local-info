# 정적 웹사이트 구축 시 주의사항

> **작성 배경**: 2026-08-06 ~ 08-10, 픽앤조이(pick-n-joy.com)에서 발생한
> "배포 3일 중단 → 전체 페이지 다운 → 클라이언트 네비게이션 먹통" 연쇄 사고의
> 실측 기록을 일반화한 문서다.
>
> **목적**: 같은 조합(Next.js App Router + 정적 export + 파일 수 제한이 있는 호스팅)을
> 쓰는 프로젝트에서 **같은 함정에 빠지지 않기 위한** 체크리스트.
>
> 이 문서는 "무엇이 옳은가"보다 **"무엇을 확인하지 않으면 조용히 깨지는가"**에 집중한다.

---

## 0. 한 줄 요약

정적 export는 **HTML 페이지 수 ≠ 실제 파일 수**다.
페이지 하나가 파일 6~9개를 만든다. 이걸 모르고 호스팅을 고르면 어느 날 갑자기 배포가 멈춘다.

---

## 1. 핵심 사실 — RSC payload란 무엇인가

### 1-1. 왜 `.txt` 파일이 생기는가

Next.js App Router는 **클라이언트 사이드 네비게이션**을 지원한다.
링크를 클릭했을 때 페이지 전체를 다시 받지 않고, 바뀌는 부분만 받아서 교체하는 방식이다.

이걸 위해 각 라우트의 렌더 결과를 **RSC(React Server Component) Flight payload**로 미리 직렬화해둔다.

| 렌더 모드 | payload 저장 위치 |
|---|---|
| SSR (서버 있음) | 요청 시 서버가 실시간 생성 |
| **정적 export (`output: "export"`)** | **빌드 시 `.txt` 파일로 디스크에 저장** |

즉 서버가 없으니 미리 파일로 구워두는 것이다. **이건 버그가 아니라 설계다.**

### 1-2. 페이지 하나가 만드는 파일들

실측 기준(Next.js 16, App Router, `output: "export"`):

| 파일명 패턴 | 역할 | 언제 요청되나 |
|---|---|---|
| `__next._tree.txt` | 라우터 트리 구조 | **prefetch** (링크가 화면에 보일 때 미리) |
| `__next._head.txt` | `<head>` 메타데이터 | **prefetch** |
| `__next._index.txt` | 인덱스 세그먼트 | **실제 네비게이션** |
| `__next.<route>.txt` | 라우트 세그먼트 본체 | **실제 네비게이션** |
| `__next.<route>.__PAGE__.txt` | 페이지 세그먼트 | **실제 네비게이션** |
| `__next._full.txt` | 전체 payload | 상황에 따라 |
| `index.txt` | 초기 payload | 초기 로드 |
| `$d$id.txt` / `$d$slug.txt` | 동적 라우트 세그먼트 | **실제 네비게이션** |

**⛔ 가장 중요한 구분**

```
prefetch용        → 지워도 성능만 약간 손해. 기능은 정상
실제 네비게이션용  → 지우면 클릭이 먹통이 된다
```

이름만 보면 다 똑같은 `__next.*.txt`처럼 보인다. **여기가 함정이다.**

### 1-3. 실측 수치 (페이지 2,246개 사이트)

```
out/ 전체 파일        20,347개
그중 .txt             17,918개  (88%)
실제 HTML 페이지       2,246개  (11%)
```

| 종류 | 개수 |
|---|---|
| `_tree` | 2,241 |
| `_head` | 2,241 |
| `_index` | 2,241 |
| `__PAGE__` | 2,241 |
| `<route>` | **4,481** |
| 기타 (`$d$id`, `index.txt` 등) | 4,473 |

**⚠️ 종류별로 균등하지 않다.** `<route>`가 두 배다.
"6종이니까 총량 ÷ 6" 같은 추정은 틀린다. **반드시 실제로 세어봐야 한다.**

---

## 2. 호스팅 선택 시 반드시 확인할 것

### 2-1. 파일 수 제한 (가장 많이 놓치는 항목)

| 호스팅 | 배포당 파일 수 제한 |
|---|---|
| Cloudflare Pages (Free) | **20,000** |
| Cloudflare Pages (Pro/Business/Enterprise) | 100,000 (조건부, §2-2 참조) |
| Vercel | 사실상 제한 없음 |
| Netlify | 사실상 제한 없음 |
| GitHub Pages | 저장소 1GB, 파일 수 제한은 별도 없음 |

**⛔ 이 제한은 요금제 페이지 첫 화면에 안 나온다.**
Cloudflare Free 플랜 설명에는 `Pages: unlimited static sites`라고 적혀 있다.
"unlimited"는 **사이트 개수**를 말하는 것이고, **배포당 파일 수는 별개 항목**이다.
문서의 Limits 페이지를 직접 찾아봐야 한다.

**확인 방법**: 호스팅 문서에서 "limits" 페이지를 찾아 다음 세 가지를 확인한다.
1. Files per deployment / per site
2. Max file size
3. Build minutes / builds per month

### 2-2. 유료 전환이 실제로 해결하는지 확인

Cloudflare 사례 (2026-01 기준):

- 유료 플랜에서 100,000개로 상향됨
- **단, 환경 변수 `PAGES_WRANGLER_MAJOR_VERSION=4`를 프로젝트 설정에 넣어야 적용된다**
- 이걸 모르고 결제하면 20,000 그대로다. 실제로 커뮤니티에 그런 문의가 올라와 있다

**⚠️ "유료 플랜"이 어느 유료인지 확인할 것.**
Cloudflare에는 두 개의 다른 요금 체계가 있다.

| 체계 | 위치 | 가격 | 파일 수 제한 |
|---|---|---|---|
| Workers Paid | Workers & Pages → Plans | $5/월 | **무관** |
| **Zone(도메인) Pro** | 도메인 → Plans | **$20/월** | ✅ 20,000 → 100,000 |

이름이 비슷해서 헷갈린다. 문서가 말하는 "Paid plans (Pro, Business, Enterprise)"는 **후자**다.

### 2-3. 판단 기준

```
예상 페이지 수 × 7 ≈ 예상 파일 수
```

이 값이 호스팅 제한의 **50%를 넘으면** 다른 호스팅을 고려하거나
처음부터 prefetch 최적화를 넣는다.

매일 콘텐츠가 늘어나는 사이트라면 **증가율까지 계산**한다.

```
하루 24페이지 발행 → 하루 약 144~170개 파일 증가
                   → 한 달 약 4,500개
```

---

## 3. ⛔ 절대 하지 말아야 할 것 — 와일드카드 일괄 삭제

### 3-1. 실제 사고

파일 수 한도를 넘자 배포 스크립트에 이 명령을 넣었다.

```bash
find out -type f -name '__next.*.txt' -delete
find out -type f -name '__PAGE__.txt' -delete
find out -type f -name '$d$id.txt' -delete
find out -type f -name 'index.txt' -delete
```

결과: 20,347 → 2,425개. 배포는 정상화됐다.

**그런데 클라이언트 네비게이션에 필요한 파일까지 전부 지워졌다.**

증상은 나흘 뒤에야 드러났다.

- 목록에서 페이지 번호를 클릭해도 **무반응**
- 카테고리 탭 전환 **무반응**
- 상단 네비게이션 **무반응** (같은 페이지로 이동할 때)
- 다른 메뉴에 갔다 오면 **다시 됨** (하드 네비게이션은 정상이므로)
- 최악의 경우 `global-error` 화면 ("This page couldn't load")

### 3-2. 왜 즉시 안 드러났나

당시 모든 목록이 **"더보기" 방식**이었다.

| 방식 | URL 변경 | 클라이언트 네비게이션 | payload 필요 |
|---|---|---|---|
| 더보기 (load more) | ❌ 없음 | ❌ 발생 안 함 | ❌ |
| **번호 페이지네이션** | ✅ `?page=N` | ✅ 매번 발생 | ✅ |

더보기는 순수 React state라 URL을 안 바꾼다. 그래서 payload를 요청할 일이 없었고,
**"클라이언트 네비게이션 정상 동작 확인"이라고 기록까지 남겼다.**

일어나지 않는 동작을 확인하고 정상이라고 판정한 것이다.

나흘 뒤 번호 페이지네이션으로 전환하자마자 사이트 전체가 터졌다.

### 3-3. 올바른 접근

**① 삭제 전에 종류별로 세어본다**

```powershell
$txt = Get-ChildItem out -Recurse -File -Filter '*.txt'
$txt | Group-Object Name | Sort-Object Count -Descending |
  Select-Object -First 20 Count, Name | Format-Table
```

```bash
find out -name '*.txt' -type f -printf '%f\n' | sort | uniq -c | sort -rn | head -20
```

**② prefetch용만 지운다**

```bash
find out -type f -name '__next._tree.txt' -delete
find out -type f -name '__next._head.txt' -delete
```

나머지(`_index`, `<route>`, `__PAGE__`, `$d$id`, `index.txt`)는 **보존**한다.

**③ 삭제 기준과 카운트 기준을 반드시 일치시킨다**

파일 수를 세는 로직과 삭제하는 로직이 다른 패턴을 쓰면
"카운트는 통과인데 업로드는 초과" 또는 그 반대가 되어 원인 추적이 불가능해진다.

**④ BEFORE → AFTER를 로그에 남긴다**

```bash
BEFORE=$(find out -type f | wc -l)
# ... 삭제 ...
AFTER=$(find out -type f | wc -l)
echo "RSC payload 제거: $BEFORE → $AFTER"
```

숫자가 안 찍히면 패턴이 안 먹은 것이다.

---

## 4. ⛔ 배포 가드는 반드시 `exit 1`

### 4-1. 실제 사고

파일 수 한도 초과를 감지하는 가드를 넣었는데 **`exit 0`으로 스킵**하게 만들었다.

결과:

| 표시 | 상태 |
|---|---|
| GitHub Actions | ✅ 초록불 |
| Cloudflare 배포 step | ✅ success |
| 텔레그램 리포트 | ✅ "전체 정상 완료" |
| **실제 사이트** | ❌ **3일간 갱신 안 됨** |

발견 경로는 자동화가 아니라 **사람이 직접 쓴 글이 사이트에 안 보여서**였다.

### 4-2. 규칙

```
스킵 = 실패다.
건너뛸 수밖에 없는 상황이면 exit 1 + 명시적 에러로 실패시켜야 누군가 알아챈다.
```

```bash
FILE_COUNT=$(find out -type f | wc -l)

if [ "$FILE_COUNT" -gt 20000 ]; then
  echo "::error::파일 수 $FILE_COUNT 가 한도 20,000 을 초과했습니다"
  exit 1                          # ⛔ exit 0 금지
fi

if [ "$FILE_COUNT" -gt 16000 ]; then
  echo "::warning::파일 수 $FILE_COUNT — 한도의 80%를 넘었습니다"
fi
```

**조기 경보선(80%)을 반드시 넣는다.** 한도에 도달한 뒤에는 이미 늦다.

---

## 5. 정적 export 특유의 함정들

### 5-1. `trailingSlash: true` — 링크 규칙을 문서화하라

`next.config`에 `trailingSlash: true`를 켰다면 **모든 내부 링크에 slash를 붙여야 한다.**

```tsx
// ❌
<Link href="/blog">블로그</Link>
router.push('/blog?category=festival')

// ✅
<Link href="/blog/">블로그</Link>
router.push('/blog/?category=festival')
```

**왜 위험한가**: slash 없는 링크도 **대부분 정상 동작한다.**
서버가 308 리다이렉트로 고쳐주기 때문이다. 그래서 문제를 못 느낀다.

그런데 **현재 pathname과 목적지 pathname이 같고 쿼리만 다른 경우**
클라이언트 라우터가 처리하지 못해 조용히 무시될 수 있다.

```
/blog/?category=festival  →  /blog     ❌ 먹통 가능
/blog/                    →  /festival ✅ 정상
```

**대응**: 프로젝트 규칙 문서(`copilot-instructions.md` 등)에 한 줄 넣는다.

```
내부 링크는 반드시 trailing slash를 붙인다. 예: '/blog/', '/blog/?category=X'
```

**⚠️ 규칙을 안 적어두면 어떤 AI 모델을 쓰든 절반은 틀린다.**
코드베이스에 slash 있는 사례와 없는 사례가 섞여 있으면, 주변 코드를 보고 따라 쓰기 때문이다.
이건 모델 문제가 아니라 **규약 부재 문제**다.

### 5-2. `useSearchParams` — Suspense는 조건 분기 **밖**에 둔다

정적 export에서 `useSearchParams()`를 쓰는 클라이언트 컴포넌트는
**Suspense 경계 안**에 있어야 한다. 없으면 빌드가 실패한다.

문제는 **있긴 한데 위치가 틀린 경우**다.

```tsx
// ❌ 조건 분기 안쪽 — 빌드는 통과하는데 배포 후 깨진다
{items.length === 0 ? (
  <p>항목이 없습니다</p>
) : (
  <Suspense fallback={<div className="min-h-[600px]" />}>
    <CardList items={items} />
  </Suspense>
)}

// ✅ 조건 분기 전체를 감싼다
<Suspense fallback={<div className="min-h-[600px]" />}>
  {items.length === 0 ? (
    <p>항목이 없습니다</p>
  ) : (
    <CardList items={items} />
  )}
</Suspense>
```

**왜 조건부가 위험한가**: 서버 프리렌더와 클라이언트 하이드레이션에서
Suspense 경계의 트리 위치가 어긋날 수 있다. hydration mismatch가 루트까지 전파되면
헤더·푸터도 안 보이는 `global-error` 화면이 뜬다.

**⚠️ 이 실패 모드의 특징**

| 검사 | 결과 |
|---|---|
| `npm run build` | ✅ 통과 |
| `npx tsc --noEmit` | ✅ 통과 |
| 로컬 dev 서버 | ✅ 정상 |
| 로컬 `npx serve out` | ✅ 정상 |
| **프로덕션 배포** | ❌ **깨짐** |

**배포해봐야만 드러난다.** 그래서 한 번에 여러 페이지를 바꾸면 안 된다(§7 참조).

### 5-3. 탭·필터 상태를 URL로 옮길 때

더보기 → 번호 페이지네이션 전환처럼 **상태를 URL로 옮기면**
그때부터 URL이 상태의 유일한 소스가 된다.

체크리스트:

- [ ] 기존 `sessionStorage` 복원 로직 중 **URL이 대체하는 것**은 제거했는가
      (스크롤 위치, visibleCount 등)
- [ ] 기존 `sessionStorage` 중 **URL이 대체 못 하는 것**은 유지했는가
      (탭 선택 상태를 쿼리로 안 옮겼다면 유지 필요)
- [ ] 훅 시그니처가 바뀌었다면 **호출부의 구조분해 변수**를 전부 갱신했는가
      (`visibleItems`, `loadMore` 등이 남아 있으면 런타임에 터진다)
- [ ] 탭/카테고리 전환 시 **페이지를 1로 리셋**하는가
      (3페이지에서 탭을 바꾸면 빈 화면이 나온다)
- [ ] 이중 파라미터 조합(`?tab=X&page=2`)으로 **직접 진입**해도 정상인가

---

## 6. 검증 방법 — 무엇이 위음성을 만드는가

### 6-1. 쓰면 안 되는 판정 기준

| 지표 | 왜 무의미한가 |
|---|---|
| **HTTP 200** | 정적 HTML은 렌더가 깨져도 항상 200 |
| **`pageerror` 이벤트 0** | uncaught 에러만 잡는다. **error boundary가 잡은 에러는 안 잡힌다** |
| **빌드 성공** | 하이드레이션 실패는 빌드가 못 잡는다 |
| **`tsc --noEmit` 통과** | 타입만 본다. 런타임 동작과 무관 |
| **`npx serve out` 정상** | `_redirects`/`_headers` 등 호스팅 전용 파일을 해석하지 않는다 |

### 6-2. 써야 하는 판정 기준

```
1. 브라우저에서 직접 연다 (헤드리스 스크립트 X)
2. DevTools Console 을 열어둔 채로 조작한다
3. Network 탭에서 실패한 요청의 이름과 상태 코드를 본다
4. DOM 에 기대한 콘텐츠가 실제로 있는지 확인한다
```

**Network 탭 확인 요령**

- 필터를 `All`로 두고 (CSS/JS 필터가 켜져 있으면 아무것도 안 보인다)
- Filter 입력칸에 `txt` 입력
- 클릭·전환을 수행하면서 실시간으로 관찰

| 관찰 | 의미 |
|---|---|
| `.txt`가 **304/200** | 파일 존재. 정상 |
| `.txt`가 **404** | 파일 없음. 네비게이션 실패 가능 |
| 요청 자체가 없음 | 코드가 네비게이션을 시도하지 않음 |

**⚠️ 404를 뭉뚱그리지 말 것.**
`_tree.txt` 404는 prefetch 실패라 **무해**하고,
`_index.txt` / `<route>.txt` 404는 **치명적**이다.
개수만 세지 말고 **파일명과 스택을 종류별로 구분**해야 한다.
(이 구분을 안 해서 진단이 몇 시간 옆길로 샜다.)

### 6-3. 배포 환경에서만 재현되는 문제

로컬은 되는데 배포에서만 깨진다면 후보는 이것들이다.

| 후보 | 확인 방법 |
|---|---|
| `_redirects` / `_headers` / `_routes.json` | 로컬 서버는 이 파일을 안 읽는다. 내용 직접 확인 |
| 빌드 후처리 (파일 삭제 등) | 로컬에서도 **동일한 후처리를 적용**한 뒤 테스트 |
| 엣지 캐시 혼재 | preview 배포(새 서브도메인)로 재현 |
| 업로드 누락 / 부분 배포 | 배포 로그의 파일 수·업로드 결과를 정상 배포와 비교 |

**preview 배포로 안전하게 재현하기** (프로덕션 무영향):

```bash
npx wrangler pages deploy out --project-name=<프로젝트> --branch=repro-test
```

⚠️ `--branch`에 프로덕션 브랜치명(`main` 등)을 넣으면 **프로덕션이 덮어씌워진다.**

---

## 7. 배포 사고를 줄이는 작업 절차

### 7-1. 한 번에 하나만 바꾼다

이번 사고의 결정적 원인 중 하나는 **5개 페이지를 한 번에 전환한 것**이었다.
9개 커밋을 한 번에 push했고, 사이트 전체가 다운됐고, 어느 커밋이 원인인지 알 수 없었다.

**올바른 순서**

```
1. 정상 동작하는 사례를 하나 확보한다 (대조군)
2. 실패 사례 하나만 골라 대조군과 코드를 직접 비교한다
3. 차이를 하나만 바꾼다
4. 배포 → 확인
5. 실패하면 즉시 revert (1커밋)
6. 성공하면 다음 하나
```

**⛔ "다 고쳤으니 한 번에 올리자"는 원인 규명을 불가능하게 만든다.**

실제로 이번에도, 배포 로그·`_redirects`·엣지 캐시를 몇 시간 뒤진 끝에
**정상 페이지와 실패 페이지의 코드를 나란히 놓고 보자마자** 차이가 한 줄로 나왔다.

### 7-2. 파일 수정은 한 파일씩

여러 파일을 한 프롬프트에서 동시에 수정하면 파일이 손상되는 사례가 반복된다.
(특정 AI 모델의 문제가 아니라 여러 모델에서 공통으로 발생한다.)

```
파일 수정 → 문법 검사(node --check / tsc) → git diff --stat 확인 → 다음 파일
```

`git diff --stat`에서 **예상보다 큰 변경량이 보이면 즉시 중단**하고
자체 편집으로 복구하지 말고 `git restore`로 되돌린다.

### 7-3. 조사와 수정을 분리한다

```
1차: 조사 전용 프롬프트 (수정·커밋·push 전부 금지)
     → 사실만 보고받는다
2차: 조사 결과를 보고 수정 범위를 확정
3차: 수정 전용 프롬프트 (파일 1개, 범위 명시)
```

조사와 수정을 한 프롬프트에 섞으면
**추측으로 고치고 나서 "고쳤다"고 보고**하는 일이 생긴다.

### 7-4. 진단이 빗나가면 즉시 실측으로 전환

같은 증상에 대해 **가설이 두 번 빗나가면 코드 추론을 멈춘다.**
실행 중인 브라우저의 콘솔·네트워크를 보는 것이 유일하게 확실한 방법이다.

이번 사고에서 빗나간 가설들:

| 가설 | 왜 틀렸나 |
|---|---|
| RSC payload 404가 원인 | 404 종류를 구분 안 함. 본 건 전부 prefetch용이었다 |
| 업로드 누락 / 부분 배포 | 배포 로그가 정상 배포와 수치 완전 동일 |
| sessionStorage 잔여 참조 | 전환 커밋이 이미 깨끗하게 제거함 |
| trailing slash 누락 | 4개월 전부터 있던 코드. 그동안 정상 동작 |

**정답은 "정상 페이지와 실패 페이지를 코드로 직접 비교"에서 나왔다.**

---

## 8. 프로젝트 시작 시 체크리스트

### 8-1. 호스팅 선택 전

- [ ] 예상 최종 페이지 수 × 7 = 예상 파일 수 계산
- [ ] 호스팅의 **배포당 파일 수 제한** 확인 (요금제 요약 말고 Limits 문서)
- [ ] 유료 전환 시 제한이 실제로 풀리는지, **추가 설정이 필요한지** 확인
- [ ] 매일 콘텐츠가 증가한다면 **증가율과 한도 도달 시점** 계산

### 8-2. 프로젝트 설정 시

- [ ] `trailingSlash` 설정값을 정하고 **링크 작성 규칙을 문서화**
- [ ] `output: "export"`라면 payload 파일 증가를 인지
- [ ] 페이지 수가 많을 것으로 예상되면 **처음부터 `<Link prefetch={false}>` 검토**
- [ ] 배포 파이프라인에 **파일 수 카운트 + 80% 경고 + `exit 1` 가드** 넣기

### 8-3. 배포 파이프라인 작성 시

- [ ] 모든 가드는 `exit 1`. `exit 0` 스킵 금지
- [ ] BEFORE → AFTER 수치를 로그에 남길 것
- [ ] 파일 삭제 시 **와일드카드 금지**, 명시적 패턴만
- [ ] 삭제 기준과 카운트 기준을 **동일하게** 유지
- [ ] 조기 경보선(한도의 80%) 설정
- [ ] 실패 시 알림(Telegram/Slack 등). 단 러너 배정 실패는 못 잡는다는 점 인지

### 8-4. 배포 후 확인 (매번)

- [ ] Actions 로그에서 **파일 수 수치가 기대값인지**
- [ ] 실제 사이트에서 **클라이언트 네비게이션** 동작 확인
      - 목록 페이지 번호 클릭
      - 탭/카테고리 전환
      - 같은 섹션 내 네비게이션 메뉴 클릭
      - 상세 페이지 → 뒤로가기
- [ ] URL 파라미터를 포함한 **직접 진입** (`/blog/?category=X&page=2`)
- [ ] 변경하지 않은 다른 페이지의 **회귀 여부**

---

## 9. 근본 대응 옵션 (파일 수 문제)

| 방안 | 비용 | 효과 | 리스크 |
|---|---|---|---|
| **prefetch 비활성화** (`<Link prefetch={false}>`) | $0 | `_tree`/`_head` 생성 자체가 줄어듦 | 초기 네비게이션 체감 속도 소폭 저하 |
| prefetch용 파일만 삭제 | $0 | 약 22% 감소 | 없음 (검증됨) |
| 호스팅 유료 전환 | 월 $20 (Cloudflare Zone Pro) | 20,000 → 100,000 | wrangler 메이저 버전 변경 필요 = 배포 동작 변화 |
| 파일 수 제한 없는 호스팅으로 이전 | 이전 비용 | 문제 소멸 | 마이그레이션 작업 |
| URL 동기화 포기 (더보기 방식) | $0 | payload를 안 쓰므로 전부 삭제 가능 | UX 후퇴, SEO상 페이지 접근성 저하 |

**권장 순서**: prefetch 비활성화 → 선별 삭제 → 호스팅 재검토 → 유료 전환

정적 사이트에서 prefetch는 체감 이득이 크지 않은 반면
파일 수에 미치는 영향은 크다. **가장 비용 효율이 높은 대응이다.**

---

## 10. 이 문서가 다루는 실패 패턴 요약

| # | 패턴 | 왜 안 보이나 |
|---|---|---|
| 1 | 페이지 수 ≠ 파일 수 | 빌드 로그가 페이지 수만 보여준다 |
| 2 | 와일드카드 삭제가 필수 파일까지 제거 | 이름이 비슷해서 종류 구분이 안 된다 |
| 3 | 가드 `exit 0` 스킵 | 초록불 + 정상 리포트가 나간다 |
| 4 | "클라이언트 네비게이션 정상" 오검증 | 네비게이션이 안 일어나는 상태에서 확인했다 |
| 5 | Suspense가 조건 분기 안쪽 | 빌드·타입 검사 전부 통과한다 |
| 6 | trailing slash 누락 | 대부분 정상 동작하고, 특정 조건에서만 깨진다 |
| 7 | 상태를 URL로 옮길 때 잔여 참조 | 타입 검사를 통과할 수 있다 |
| 8 | 한 번에 여러 개 변경 | 원인 커밋을 특정할 수 없다 |

**공통점: 전부 "에러 없이 조용히 깨진다."**
그래서 자동 검사가 아니라 **사람이 실제로 클릭해보는 확인**이 필요하다.

---

## 부록 A. 유용한 진단 명령

### 파일 종류별 개수 (PowerShell)

```powershell
$txt = Get-ChildItem out -Recurse -File -Filter '*.txt'
Write-Host "총 .txt: $($txt.Count)"
$txt | Group-Object Name | Sort-Object Count -Descending |
  Select-Object -First 20 Count, Name | Format-Table
```

### 파일 종류별 개수 (bash)

```bash
find out -name '*.txt' -type f -printf '%f\n' | sort | uniq -c | sort -rn | head -20
```

### 내부 링크 trailing slash 전수 조사 (PowerShell)

```powershell
Get-ChildItem src -Recurse -Include *.tsx,*.ts |
  Select-String -Pattern 'href="/[a-z]', "router\.push\('/[a-z]" |
  ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
```

### 배포 로그 비교 (GitHub Actions)

```powershell
gh run list --limit 10 --json databaseId,number,displayTitle,headSha,conclusion
gh run view <ID> --log > run.txt
Select-String -Path run.txt -Pattern '파일 수','Uploading','::warning','::error'
```

### 정상 배포 vs 실패 배포 대조

같은 워크플로의 **직전 정상 run**과 **문제 run**의 로그를 나란히 비교한다.
수치가 동일하면 배포 과정은 결백하고, 원인은 코드나 서빙 계층에 있다.

---

## 부록 B. 참고 링크

- Cloudflare Pages Limits: https://developers.cloudflare.com/pages/platform/limits
- Pages 파일 제한 상향 공지 (2026-01-23): https://developers.cloudflare.com/changelog/post/2026-01-23-pages-file-limit-increase/
- 관련 이슈 (파일 수 제한): https://github.com/cloudflare/workers-sdk/issues/5537

---

*이 문서는 실제 사고 기록에서 도출됐다. 새로운 함정을 발견할 때마다 §5·§10에 추가한다.*
