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
- 세션 종료 전 사용자에게 문서 업데이트 여부를 확인한다.
- 업데이트 시 최소 `CLAUDE.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`, `PROJECT_MEMORY.md`를 함께 반영한다.
- 코드 변경 후에는 `npm run build`로 검증한다.

## 핵심 프로젝트 요약

- 사이트: 픽앤조이 (`https://pick-n-joy.com`)
- 스택: Next.js 14 App Router + TypeScript + Tailwind CSS v4
- 배포: Cloudflare Pages + GitHub Actions(매일 07:00 KST)
- 데이터 소스: 공공데이터포털 + 한국관광공사 TourAPI + Gemini(gemini-2.0-flash)

## 최근 중요 반영 사항

- 네비 메뉴명 통일: 인천시 정보 / 전국 보조금·복지 정책 / 전국 축제·여행 정보
- 헤더 UI 확대: 로고 `text-3xl`, 네비 `text-base`
- 축제 설명 보강: `scripts/collect-festival.js`에서 `detailCommon2`로 `overview` 수집
- 주의: KorService2 `detailCommon2`는 `defaultYN`, `overviewYN` 파라미터를 사용하면 오류 발생 (파라미터 없이 호출)
