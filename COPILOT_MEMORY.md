# COPILOT_MEMORY.md — 픽앤조이 작업 메모

이 파일은 GitHub Copilot 작업 기준의 운영 메모입니다.
Copilot 기준 문서는 `.github/copilot-instructions.md`와 `WORK_LOG.md`를 함께 관리합니다.

## 시작 전 체크리스트

1. `.github/copilot-instructions.md` 확인
2. 이 파일(`COPILOT_MEMORY.md`) 확인
3. 최근 작업 이력(`WORK_LOG.md`) 확인

## 운영 규칙

- 세션 시작 시 위 3개 파일의 최신 상태를 확인한다.
- 세션 종료 전 사용자 확인 여부와 관계없이, 작업 이력이 있으면 문서/메모리 동기화를 수행한다.
- 업데이트 시 최소 `WORK_LOG.md`, `.github/copilot-instructions.md`, `COPILOT_MEMORY.md`를 함께 반영한다.
- 코드 변경 후에는 반드시 `npm run build`로 검증한다.
- 코드 작업 완료 시 반드시 `git add → git commit → git push`를 수행한다.
- **작업 종료 체크리스트(필수)**: build 성공 + commit/push 완료 + 3개 문서 동기화

## 핵심 프로젝트 요약

- 사이트: 픽앤조이 (`https://pick-n-joy.com`)
- 스택: Next.js 16 App Router + TypeScript + Tailwind CSS v4
- 배포: Cloudflare Pages + GitHub Actions(매일 07:00 KST)
- 데이터 소스: 공공데이터포털 + 한국관광공사 TourAPI + Claude API(claude-haiku-4-5)

## 최근 변경 요약 (압축판)

- 상세 이력은 `WORK_LOG.md`를 기준 문서로 사용하고, 이 파일은 작업 규칙과 최신 상태만 유지한다.
- 2026-03-31 핵심 반영:
  - 홈페이지 전면 개편: 태허 철학관 참고 디자인 기반 `page.tsx` 완전 재작성
  - copy.md 카피 적용 (Problem 섹션, CTA, 히어로 부제, 카테고리 상세)
  - Features + CTA를 주황색 그라데이션 단일 섹션으로 통합
  - 블로그 목록에서 초이스 포스트 필터링 + 썸네일 50% 축소
  - 깨진 블로그 글 6편 삭제 (3/28 Gemini API 인코딩 오류분)
- 이전(~03-30) 핵심:
  - 초이스 카테고리 신설 + 수동 리뷰 포스트 2편
  - 맛집 자동화 고도화 / 블로그·배포 안정화

## 고정 운영 사실 (반복 참조용)

- 쿠팡 파트너스: `AF5831775`
- 사이드바 배너: `976244` / 하단 배너: `976089`
- 쿠팡 iframe은 공식 URL 직접 사용 + `referrerPolicy="unsafe-url"` 유지
- `CoupangBanner.tsx`는 `'use client'` 유지 (Hydration mismatch 방지)

## 유지 백로그 (요약)

- [ ] Google AdSense 설정
- [ ] 자동화 에러 알림/모니터링 강화
- [ ] 맛집 포스트 이미지 소스 전략 고도화
