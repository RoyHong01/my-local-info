# AI Rules for My Local Info Blog Project

이 프로젝트를 작업하는 AI 어시스턴트는 항상 이 파일의 규칙을 준수해야 합니다.

## 1. SEO 및 E-E-A-T 최적화 원칙
블로그 포스트(.md)를 작성하거나 자동화 스크립트를 구현 및 수정할 때 아래 사항을 반드시 적용하세요.
- **출처 표기 의무**: 공공데이터나 외부 API를 가공한 글의 경우, 본문 하단이나 상단에 항상 원본 출처(예: `출처: 공공데이터포털 API`)와 원문 링크를 포함시켜야 합니다.
- **사용자 중심 콘텐츠(Helpful Content)**: 정보 나열보다는 독자의 관점에서 명확하게 읽히도록 `지원 대상`, `신청 방법` 등을 직관적으로 구조화(E-E-A-T의 Experience/Trust)해야 합니다.
- **구조화된 데이터 (JSON-LD)**: 상세 페이지 컴포넌트(`src/app/blog/[slug]/page.tsx` 등)를 작업할 때 `Article` 또는 `BlogPosting` 스키마 마크업을 동적으로 적용하는 것을 염두하세요.
- **동적 사이트맵 연동**: 블로그 페이지가 추가될 때를 대비해 웹 크롤러가 수집할 수 있도록 동적인 접근성(`sitemap.xml` 및 `robots.txt`)을 고려해야 합니다.

## 2. 코드 및 아키텍처 규칙
- **프레임워크**: Next.js (App Router), React Server Components (RSC) 지향
- **언어 및 문법**: TypeScript (엄격한 타입 선언 지향)
- **스타일링**: Tailwind CSS v4 (따로 설정 파일 없이 전역 `globals.css`의 `@plugin` 및 `@import` 사용을 기본으로 함)
- **의존성 최소화**: 패키지를 설치할 때는 가급적 Node.js 기본 구문(`fetch`, `fs/promises`)을 우선적으로 활용하여 패키지 크기를 최적화하세요.

## 3. 메모리 연동 훅 (Session End Protocol)
- 어떤 새로운 작업 세션(기능 추가, 코드 리팩토링, 오류 수정 등)이 완전히 종료되면, AI는 사용자에게 다음을 물어봐야 합니다:
  > **"현재 세션의 작업이 완료되었습니다. `PROJECT_MEMORY.md` 파일에 이번 작업 내용과 현재 상태를 업데이트 할까요?"**
- 사용자가 동의(또는 긍정)하면, 즉시 `PROJECT_MEMORY.md` 파일의 로그와 상태를 최신화하여 기록해야 합니다.
