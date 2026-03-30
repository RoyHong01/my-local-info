/**
 * 쿠팡 파트너스 자동 블로그 글 생성을 위한 정책 & 규칙 데이터
 * 참고: https://partners.coupang.com (가이드 문서 기반)
 */

/**
 * 쿠팡 파트너스 기본 정책 규칙
 */
export const COUPANG_PARTNERS_POLICY = {
  /** 실적 인정 범위: 링크를 통해 접속한 후 24시간 내 구매한 모든 상품 */
  attributionWindow: '24시간',
  attributionDescription: '링크를 통해 접속한 고객이 24시간 내에 구매한 모든 상품에 대해 실적 반영',

  /** 링크 유효성: 절대 변경 금지, 1글자 오류도 실적 미인정 */
  linkValidation: {
    rule: '정확성 필수 (1글자 오류도 미인정)',
    warning: 'URL 주소가 1글자라도 잘못 입력되거나 누락되면 실적 인정에서 제외될 수 있음',
    checkpoints: ['도메인 정확성', '파라미터 정확성', '파트너ID 정확성', '트래킹 코드 정확성'],
  },

  /** 글 작성 추천 형식 */
  postFormat: {
    recommended: '이미지 + 텍스트 조합 (클릭률 높음)',
    basic: '텍스트 링크만 (클릭률 낮음)',
    htmlTag: '블로그형 태그 HTML',
  },

  /** HTML 삽입 시 주의사항 */
  htmlInsertion: {
    step1: '블로그 설정에서 HTML 기본 지원 여부 확인 필수',
    step2: '글쓰기 입력창에서 HTML 모드로 전환',
    step3: '쿠팡에서 복사한 HTML 코드 붙여넣기',
    step4: '에디터 모드로 다시 돌아와 미리보기로 정상 삽입 확인',
  },

  /** 배너/위젯 배치 (수익 극대화) */
  bannerStrategy: {
    highestRevenue: '블로그에 항상 노출되는 배너/위젯 설정',
    benefit: '방문자가 언제든 클릭 가능 → 수익 발생 가능성 최고',
    types: ['배너 HTML', '검색 위젯'],
  },

  /** 현재 쿠팡 파트너 정보 (픽앤조이) */
  currentPartner: {
    partnerId: 'AF5831775',
    sidebarBannerId: '976244',
    bottomBannerId: '976089',
    status: '활성화',
  },
} as const;

/**
 * 쿠팡 링크 생성 규칙 (API 연결 후 사용)
 */
export const COUPANG_LINK_RULES = {
  /** 상품 고유 URL 추출 방법 */
  productUrlExtraction: {
    source: '쿠팡 파트너스 > 상품 링크 메뉴',
    method: '상품명 검색 후 링크 생성 버튼 클릭',
  },

  /** 링크 생성 후 필수 포함 요소 */
  requiredElements: {
    partnerId: 'AF5831775',
    domain: 'partners.coupang.com',
    productSlug: '(각 상품마다 고유한 slug)',
    trackingCode: '(파트너 링크 고유 추적 코드)',
  },

  /** HTML 템플릿 : 이미지 + 텍스트 형식 */
  htmlTemplates: {
    imageWithText: `
<!-- 쿠팡 파트너스 이미지+텍스트 링크 -->
<a href="[COUPANG_AFFILIATE_LINK]" target="_blank" rel="noopener noreferrer">
  <img src="[PRODUCT_IMAGE_URL]" alt="[PRODUCT_NAME]" style="width: 100%; border: 1px solid #ddd; border-radius: 8px;" />
  <p style="margin-top: 8px; font-weight: bold;">[PRODUCT_NAME]</p>
</a>`,
    textOnly: `<a href="[COUPANG_AFFILIATE_LINK]" target="_blank" rel="noopener noreferrer">[PRODUCT_NAME] (쿠팡 파트너스)</a>`,
  },

  /** 블로그 포스트 내 삽입 위치 (권장) */
  insertionPositions: {
    primary: '글 본문 중간 (관련 내용 설명 후)',
    secondary: '글 하단 (결론 or 추천 섹션)',
    widget: '사이드바 또는 상단 고정 배너 (항상 노출)',
  },
} as const;

/**
 * 쿠팡 물품 블로그 포스트 자동 생성 규칙 (미래 API 연결 시)
 */
export const COUPANG_AUTO_POST_RULES = {
  /** 포스트 카테고리 */
  category: '픽앤조이 초이스',
  subcategory: '추천 물품',

  /** 포스트 구조 (추천) */
  postStructure: {
    title: '[상황/감성] + [상품명] 조합 (예: "책상에 꽂아만 해도 기분 좋은 미니 식물들")',
    hero: '상품 이미지 (쿠팡 파트너스 이미지 사용)',
    hook: '감성적 훅 문장 1-2개',
    problem: '이 물품이 해결하는 실제 문제/불편함',
    solution: '이 물품으로 어떻게 해결되는지',
    description: '상품 상세 설명 (이미지 포함 HTML)',
    tips: '사용 팁 또는 추가 활용법',
    cta: '쿠팡 링크와 함께 구매 권장 맥락',
  },

  /** 포스트 톤 & 스타일 */
  tone: {
    style: '감성 큐레이션 + 실용 정보 혼합',
    voiceType: '친절한 라이프스타일 에디터 (30대 초반 여성 관점)',
    perspective: '실제 사용자 입장에서 문제 해결',
    avoidKeywords: ['다양한', '인상적인', '포착한', '결론적으로'],
  },

  /** 이미지 우선순위 */
  imagePriority: {
    priority1: '쿠팡 공식 상품 이미지',
    priority2: '사용자 리뷰 이미지 (신뢰도 높음)',
    priority3: '카테고리 기본 SVG (최후의 수단)',
  },

  /** SEO 최적화 */
  seo: {
    metaDescription: '상품명 + 감정 키워드 + 카테고리 조합',
    keywords: ['픽앤조이 초이스', '[상품 카테고리]', '[상품명]', '[감정/상황 키워드]'],
    ogImage: '상품 이미지',
    canonicalUrl: 'https://pick-n-joy.com/blog/[slug]',
  },

  /** 실적 추적 을 위한 필수 정보 */
  trackingRequirements: {
    linkPlacement: '글 본문 내 clear & visible',
    linkTextFormat: '[상품명] (쿠팡 파트너스)',
    attributionText: '이 글의 추천 링크를 통해 구매 시, 쿠팡 파트너스로부터 일부 수수료를 받을 수 있습니다.',
    updateFrequency: '월 1-2회 (상품 추가/업데이트 시)',
  },

  /** Frontmatter 필수 필드 */
  frontmatterFields: {
    title: 'string',
    date: 'YYYY-MM-DD',
    slug: 'string (영문 조합)',
    category: '픽앤조이 초이스',
    subcategory: '추천 물품',
    productName: 'string (쿠팡 상품명)',
    productUrl: 'string (쿠팡 파트너 링크)',
    productImage: 'string (이미지 URL or 경로)',
    rating: 'number (1-5, 선택)',
    price: 'string (선택)',
    description: 'string (검색용 요약)',
    tags: 'string[] (예: ["초이스", "추천물품", "생활용품"])',
  },
} as const;

/**
 * 쿠팡 API 준비 체크리스트 (미래용)
 */
export const COUPANG_API_READINESS = {
  currentStatus: '미활성화 (API 미발급)',
  requiredSteps: [
    '1. 쿠팡 파트너스 계정 상태: 정상 (✅ AF5831775)',
    '2. API 신청: 미신청 (⏳ 추후 신청 필요)',
    '3. API 인증 방식: OAuth 2.0 또는 API Key (확인 필요)',
    '4. 레이트 리밋: 시간당 [개수] 요청 (API 문서 확인 필요)',
    '5. 응답 포맷: JSON (추정)',
  ],
  expectedApiEndpoints: {
    productSearch: '/api/v1/products/search',
    productDetails: '/api/v1/products/{productId}',
    linkGeneration: '/api/v1/links/generate',
  },
  notes: '쿠팡 API가 공개되면, 상품 검색 → 링크 생성 → 글 생성 자동화 파이프라인 구축 가능',
} as const;

/**
 * 유틸리티: 쿠팡 링크 유효성 검증 (기초)
 */
export function validateCoupangLink(url: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!url) {
    errors.push('링크가 비어있음');
    return { isValid: false, errors };
  }

  if (!url.includes('partners.coupang.com')) {
    errors.push('쿠팡 파트너스 도메인 확인 필요');
  }

  if (!url.includes('AF5831775')) {
    errors.push('파트너 ID (AF5831775) 누락 가능성');
  }

  if (url.length < 50) {
    errors.push('URL이 너무 짧음 (트래킹 코드 누락?)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 유틸리티: 쿠팡 HTML 코드 정제 (소독)
 */
export function sanitizeCoupangHtml(html: string): string {
  // XSS 방지: 위험한 태그 제거, 안전한 속성만 유지
  const sanitized = html
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // script 태그 제거
    .replace(/on\w+\s*=/gi, '') // 이벤트 핸들러 제거
    .replace(/javascript:/gi, ''); // javascript: 프로토콜 제거

  return sanitized;
}

/**
 * 자동 생성 준비 상태 (체크리스트)
 */
export const AUTOMATION_READINESS = {
  phase1_foundation: {
    status: '✅ 완료',
    components: ['정책 데이터화', '링크 규칙 정의', '포스트 구조 설계'],
    dueDate: '2026-03-30',
  },
  phase2_api_prep: {
    status: '⏳ 대기 중',
    components: ['쿠팡 API 신청', 'API 문서 분석', '링크 생성 엔드포인트 연결'],
    dueDate: '쿠팡 API 발급 후',
  },
  phase3_script: {
    status: '⏳ 대기 중',
    components: ['collect-coupang-products.mjs (스크립트)', 'generate-coupang-posts.mjs (스크립트)', 'deploy.yml 통합'],
    dueDate: '2026-Q2',
  },
} as const;
