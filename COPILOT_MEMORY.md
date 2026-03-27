# COPILOT_MEMORY.md — 픽앤조이 작업 메모

이 파일은 GitHub Copilot 작업 기준의 운영 메모입니다.
Claude Code의 `CLAUDE.md`, 프로젝트 공통 메모인 `PROJECT_MEMORY.md`와 항상 동기화합니다.

## 시작 전 체크리스트

1. `CLAUDE.md` 확인
2. `.github/copilot-instructions.md` 확인
3. `PROJECT_MEMORY.md` 확인
4. 이 파일(`COPILOT_MEMORY.md`) 확인

## 운영 규칙

- 세션 시작 시 위 4개 파일의 최신 상태를 확인한다.
- 세션 종료 전 사용자 확인 여부와 관계없이, 작업 이력이 있으면 문서/메모리 동기화를 수행한다.
- 업데이트 시 최소 `CLAUDE.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`를 함께 반영한다.
- 코드 변경 후에는 반드시 `npm run build`로 검증한다.
- 코드 작업 완료 시 반드시 `git add → git commit → git push`를 수행한다.
- **작업 종료 체크리스트(필수)**: build 성공 + commit/push 완료 + 4개 문서 동기화

## 핵심 프로젝트 요약

- 사이트: 픽앤조이 (`https://pick-n-joy.com`)
- 스택: Next.js 16 App Router + TypeScript + Tailwind CSS v4
- 배포: Cloudflare Pages + GitHub Actions(매일 07:00 KST)
- 데이터 소스: 공공데이터포털 + 한국관광공사 TourAPI + Claude API(claude-haiku-4-5)

## 최근 중요 반영 사항

- 네비 메뉴명 통일: 인천시 정보 / 전국 보조금·복지 정책 / 전국 축제·여행 정보
- 헤더 UI 확대: 로고 `text-3xl`, 네비 `text-base`
- 축제 설명 보강: `scripts/collect-festival.js`에서 `detailCommon2`로 `overview` 수집
- 주의: KorService2 `detailCommon2`는 `defaultYN`, `overviewYN` 파라미터를 사용하면 오류 발생 (파라미터 없이 호출)
- 축제 상세 데이터 복구(2026-03-27):
  - `overview` 200자 절삭 제거 → 상세 원문 보존
  - 오래된 샘플 3건(`festival-001~003`) API 원본 매핑/교체 로직 추가
  - 매칭 실패 샘플 자동 제거 + `contentid/id` 기준 중복 제거
  - `festival.json` 재수집 완료
- 상세 페이지 typography/prose 개선(2026-03-27):
  - `@tailwindcss/typography` 활성화 및 상세 페이지 본문 `prose` 적용
  - 상세 4페이지 폭 `max-w-5xl → 7xl → 6xl` 사용자 피드백 기반 조정
- 블로그 가독성 규칙 강화(2026-03-27):
  - 본문 훅(Hook) 시작 강제, H1→H2 자동 보정
  - 번호 소제목 자동 변환: `1.`/`1️⃣` 패턴을 `### 1.` 헤딩 + 설명 단락으로 분리
  - 번호 항목 아래 들여쓰기 코드블록 오인(`pre`) 제거 로직 추가
  - 생성 스크립트(`generate-blog-post.js`)에 훅/번호 소제목 형식 가이드 반영
- 상세 콘텐츠 블로그형 고도화(2026-03-27):
  - 상세 3페이지 본문을 `ReactMarkdown + prose` 렌더링으로 전환
  - `description_markdown` 우선 렌더링, 미존재 시 필드 기반 fallback markdown 생성
  - 수집 스크립트 3종에 Anthropic 기반 `description_markdown` 생성 및 해시 캐시 적용
  - 로그에 input/output 토큰 사용량 출력(비용 모니터링)
  - `DESCRIPTION_MARKDOWN_BATCH_LIMIT`(기본 10)로 실행당 AI 가공 수 제한
  - **description_markdown 전체 백필 완료 (2026-03-27)**: incheon 103건, subsidy 103건, festival 107건 모두 100% 생성 완료
  - 실측 Anthropic 비용: 10건당 ~$0.037, 1건당 ~$0.004(₩5), 월 10건/일 기준 ~$1.10/월
- 카드 UI 전역 인터랙션 정리(2026-03-27):
  - `globals.css`에 `.menu-card`, `.menu-card-icon` 추가 (미세 확대/배경 틴트/아이콘 톤다운)
  - 인천/보조금/축제/블로그/홈 카드에 공통 적용
- 카드 그리드 높이 복구(2026-03-27):
  - 인천/보조금 목록에서 `auto-rows-fr`, `h-full` 강제 적용 제거
  - 카드가 과도하게 커지는 문제 해결, 축제/블로그와 유사한 자연 높이 유지
