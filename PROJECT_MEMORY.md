# Project Memory & Status

이 파일은 프로젝트의 과거 작업 이력, 현재 상태, 그리고 앞으로 해야 할 작업들을 기록하여 AI 어시스턴트가 프로젝트의 전체 컨텍스트를 빠르고 정확하게 파악할 수 있도록 돕는 핵심 메모리 파일입니다.

## 1. 현재 프로젝트 상태 (Current Status)
- **기술 스택**: Next.js App Router, Tailwind CSS v4, TypeScript
- **환경 기반**: 정적 HTML 배포 (`next.config.ts`의 `output: "export"` 적용)
- **배포 플랫폼**: Cloudflare Pages (GitHub Actions `deploy.yml` 통해 자동 배포)
- **핵심 기능**: 공공데이터포털 API 연동, Gemini 2.5 Flash를 활용한 블로그 포스트(.md) 자동 생성화 스크립트

## 2. 최근 완료한 주요 작업 (Recently Completed)

- **멀티카테고리 구조 전면 재설계**: 인천/전국 보조금/축제·여행 3개 카테고리 + 블로그
- **SEO 전면 보강 (2026-03-27)**:
  - sitemap.xml 도메인 수정 (pages.dev → pick-n-joy.com)
  - 전 페이지 metadata export 추가 (title, description, OG, canonical)
  - og:image 자동화 (TourAPI firstimage → frontmatter, 카테고리별 기본 SVG)
  - favicon 추가 (ico + svg)
  - robots.txt 도메인 수정
- **블로그 자동 생성**: Gemini 2.0-flash + 공공데이터 기반 블로그 포스트 자동 생성 스크립트
- **CI/CD 워크플로우**: GitHub Actions (매일 07:00 KST) + Cloudflare Pages 자동 배포
- **RSS 피드**: /rss.xml 경로 제공
- **네이버 서치어드바이저**: 사이트 인증 완료

## 3. 앞으로 해결해야 할 과제 / 백로그 (Backlog & Next Steps)

- [x] 블로그 상세 페이지 구조화된 JSON-LD 데이터 추가 및 Meta 데이터(OpenGraph 등) 확충 작업
- [x] 사이트맵(`sitemap.xml`) 및 웹 로봇(`robots.txt`) 추가하여 신규 글들에 대한 크롤링 최적화 진행
- [ ] Google Analytics (NEXT_PUBLIC_GA_ID) 설정
- [ ] Google AdSense (NEXT_PUBLIC_ADSENSE_ID) 설정
- [ ] 에러 핸들링 및 자동화 모니터링: 스크립트 실행 오류 시 알림 채널 검토
- [ ] 2단계: 전국 맛집 기능 (restaurant.json, 카카오 API 연동)
