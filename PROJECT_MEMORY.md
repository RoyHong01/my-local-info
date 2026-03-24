# Project Memory & Status

이 파일은 프로젝트의 과거 작업 이력, 현재 상태, 그리고 앞으로 해야 할 작업들을 기록하여 AI 어시스턴트가 프로젝트의 전체 컨텍스트를 빠르고 정확하게 파악할 수 있도록 돕는 핵심 메모리 파일입니다.

## 1. 현재 프로젝트 상태 (Current Status)
- **기술 스택**: Next.js App Router, Tailwind CSS v4, TypeScript
- **환경 기반**: 정적 HTML 배포 (`next.config.ts`의 `output: "export"` 적용)
- **배포 플랫폼**: Cloudflare Pages (GitHub Actions `deploy.yml` 통해 자동 배포)
- **핵심 기능**: 공공데이터포털 API 연동, Gemini 2.5 Flash를 활용한 블로그 포스트(.md) 자동 생성화 스크립트

## 2. 최근 완료한 주요 작업 (Recently Completed)
- **UI 및 기본 라우팅 완성**: 메인 URL(`my-local-info.pages.dev` 또는 `my-local-info-2gs`)에 성남 기반의 공공 데이터 카드 및 `/blog` 상세 페이지 라우팅 적용 완료
- **스크립트 고도화**:
  - `fetch-public-data.js` (성남/경기 공공 데이터 최신화 체크, 중복 방지)
  - `generate-blog-post.js` (마크다운 기반 SEO 및 Frontmatter 자동 생성 분리 파싱 완료)
- **CI/CD 워크플로우 구성**: `.github/workflows/deploy.yml` 작성 및 Cloudflare 권한 Secret 세팅 통과(성공적인 Build & Deploy)
- **가이드라인 도입**: SEO/E-E-A-T 가이드라인을 정의한 `AI_RULES.md` 생성 완료

## 3. 앞으로 해결해야 할 과제 / 백로그 (Backlog & Next Steps)
- [ ] 블로그 상세 페이지(`app/blog/[slug]/page.tsx`) 구조화된 JSON-LD 데이터 추가 및 Meta 데이터(OpenGraph 등) 확충 작업
- [ ] 사이트맵(`sitemap.js/ts`) 및 웹 로봇(`robots.txt`) 추가하여 신규 글들에 대한 크롤링 최적화 진행
- [ ] 에러 핸들링 및 자동화 모니터링: 스크립트 실행 오류 시 Slack이나 이메일 등으로 결과를 알림받는 알림 채널 검토
