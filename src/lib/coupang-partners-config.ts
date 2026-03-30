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
 * 🛑 규정 준수 (Compliance) — 필수 사항 (어기면 수익금 미지급 or 계정 정지)
 * 이 항목들을 무시하면 광고주 신분 박탈, 수익금 체결 거부, 쿠팡과의 법적 분쟁 발생 가능
 */
export const COUPANG_COMPLIANCE = {
  /** 대가성 문구: 모든 포스팅에 필수 삽입 */
  disclosureText: {
    required: true,
    mandatoryText: '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    purpose: '소비자가 대가성 있는 광고임을 명확히 인식',
    placement: {
      primary: '글 제목 아래 또는 본문 첫 부분 (가장 눈에 띄는 곳)',
      acceptable: '글 하단 (덜 권장)',
      notAcceptable: '글 중간 어딘가 (부주의한 배치)',
    },
    visual: {
      recommendation: '진하게 표시하기, 배경 색상 다르게, 박스로 강조',
      reason: '소비자가 명확히 인식 가능해야 FTC/공정위 규정 준수',
    },
    verifyChecklist: [
      '[ ] 메인 제목 아래 또는 본문 첫 문장 다음에 배치되었는가?',
      '[ ] 다른 텍스트보다 눈에 띄게 표시했는가?',
      '[ ] 예시: **[쿠팡 파트너스 활동]** 이 포스팅은 쿠팡 파트너스의 일환으로 수수료를 제공받습니다.',
    ],
  },

  /** 금지된 홍보 방식 */
  prohibitedMethods: [
    '❌ 수신자 동의 없는 SMS/메신저 홍보',
    '❌ 타인 블로그 댓글에 쿠팡 링크 남기기',
    '❌ 본문 내용을 가리는 플로팅 배너/팝업 배너',
    '❌ 오도하는 링크 텍스트 (예: "클릭해서 혜택받기" 후 다른 사이트)',
    '❌ 자동 리다이렉션 또는 속임수성 마케팅',
  ],

  /** 지식재산권 보호 */
  intellectualProperty: {
    logoUsage: '쿠팡 공식 로고 변형 사용 금지 (탈퇴 사유)',
    companySpoofing: '쿠팡 공식 활동으로 오인하게 만드는 사칭 금지',
    examples: [
      '❌ "쿠팡 공식 추천" (쿠팡과의 공식 협약이 아님)',
      '❌ 쿠팡 로고 변형/재편집',
      '❌ "쿠팡 내부자 정보" 같은 허위 주장',
    ],
    consequence: '위반 시 파트너 계정 영구 정지',
  },

  /** 컴플라이언스 자동 검증 */
  autoValidationChecks: {
    hasDisclosureText: '대가성 문구 포함 여부',
    disclosurePosition: '문구 위치 (상단 이상적)',
    hasProhibitedMethods: '금지된 홍보 방식 사용 여부',
    logoIntegrity: '쿠팡 로고 무결성',
    linkAccuracy: '파트너 ID 정확성',
  },
} as const;

/**
 * 🚀 콘텐츠 전략 (Content Strategy) — 클릭과 구매를 부르는 설계
 * 이 전략들을 따르면 평범한 추천글도 "저장해두고 싶은 핫플" 수준으로 격상됨
 */
export const COUPANG_CONTENT_STRATEGY = {
  /** 구체적인 세부 키워드 공략 (Specificity) */
  keywordStrategy: {
    principle: '단순 분류 → 구체적 요구사항으로 타겟팅',
    examples: [
      {
        generic: '자전거 추천',
        specific: '50만원대 입문형 로드자전거 (통근용)',
        reasoning: '구매 확률 높은 고객 유입',
      },
      {
        generic: '캠핑 장비',
        specific: '2인 텐트 / 300g 초경량 / 바람에 강한',
        reasoning: '검색자의 구체적 필요 해결',
      },
    ],
    implementation: 'generate-coupang-posts.mjs의 제목/description 생성 시 구체성 우선',
  },

  /** 문제 해결형 서사 (Needs-focused Narrative) */
  needsFocusedApproach: {
    principle: '상품 설명 → 고객의 실제 고민에서 출발',
    antiPatterns: [
      '❌ "캠핑 장비 뭐 살지 고민되시죠?" (수사적 질문)',
      '❌ "최고의 자전거입니다." (추상적 포장)',
      '❌ "당신이 원하던 바로 그것!" (가정적 표현)',
    ],
    bestPractices: [
      '✅ "유튜브 시작할 때 장비 세팅까지 다 알려주는 사람 어디 없나?" → 이 상품이 해결',
      '✅ "모니터 암이 있으면 책상이 넓어진다는 거, 알아?" → 실제 경험 공유',
      '✅ "캠핑 초보인데 밤이 추워서..." → 문제 → 이 침낭 구매 후 해결',
    ],
    implementation: '프롬프트에 "고객의 pain point에서 시작하세요" 규칙 추가',
  },

  /** 자연스러운 표현과 가독성 (Natural & Readable) */
  writingGuidelines: {
    avoidAbstraction: [
      '❌ "최고", "최저가", "최강" 같은 상위 표현',
      '❌ "다양한", "인상적인", "포착한" (AI 금지어)',
      '❌ 과장된 수식어',
    ],
    useConcreteExperience: [
      '✅ 실제 사용 경험 기반 설명',
      '✅ 수치/데이터 기반 주장',
      '✅ "제 경험상", "많은 사람들이 언급하는" 같은 신뢰도 표현',
    ],
    mobileOptimization: {
      recommendation: 'short paragraphs (2-3줄), bullet points, 적절한 여백',
      reason: '모바일 사용자 60% 이상 (가독성 필수)',
    },
  },

  /** 데이터 교차 검증 (Data Cross-validation) */
  dataValidation: {
    principle: 'AI 생성 콘텐츠 + 객관적 데이터 결합',
    examples: [
      {
        strategy: '구글 평점 4.2 이상 필터 (이미 맛집에 적용중)',
        application: 'Coupang 상품도 동일한 별점 기준 적용 가능',
        benefit: '독자의 신뢰도 폭발',
      },
      {
        strategy: '구매 후기 / 리뷰 수 (검증된 인기도)',
        application: 'frontmatter에 rating, reviewCount 필드 저장',
        benefit: '소비자 신뢰성 강화',
      },
    ],
    implementation: 'collect-coupang-products.mjs에서 평점/리뷰수 필터링 로직 추가',
  },
} as const;

/**
 * 🛠️ 기술적 최적화 (Technical Specification) — 실적 정상 집계
 * 이 부분을 무시하면 열심히 글을 써도 수익이 인정되지 않음
 */
export const COUPANG_TECHNICAL_OPTIMIZATION = {
  /** 정확한 링크 생성 (Link Accuracy) */
  linkGeneration: {
    rule: '단순 URL 복사 ❌ → 쿠팡 파트너스 공식 생성 URL/HTML ✅',
    reason: '추적 코드 포함 필수 (실적 집계 기준)',
    methods: [
      {
        method: '쿠팡 파트너스 홈페이지 "상품 링크" 메뉴',
        step: '상품 검색 → 링크 생성 버튼 → URL/HTML 복사',
        format: '고유 slug + 파트너 ID + 추적 코드 자동 포함',
      },
    ],
    validation: {
      requirement: 'URL은 AF5831775(파트너 ID) + tracking code 반드시 포함',
      checkBeforePublish: [
        '[ ] URL에 AF5831775 포함되어 있는가?',
        '[ ] 추적 코드(캐릭터 30자 이상)가 있는가?',
        '[ ] 도메인이 partners.coupang.com인가?',
      ],
    },
  },

  /** HTML 및 위젯 활용 (HTML & Widget Strategy) */
  htmlWidgetUsage: {
    principle: '텍스트 링크만 ❌ → 이미지 + 텍스트 HTML ✅',
    metrics: {
      textLinkClickRate: '~1-2% (낮음)',
      imageTextHtmlClickRate: '~5-10% (5배 높음)',
    },
    bestPractices: [
      {
        type: '이미지 + 텍스트 HTML',
        format: '쿠팡 파트너스에서 생성한 "블로그형 태그"',
        placement: '글 본문 중간 (관련 설명 후) + 하단 (결론 섹션)',
      },
      {
        type: '배너/위젯 (수익 극대화)',
        format: '사이드바 고정 배너 (항상 노출)',
        benefit: '방문자가 언제든 클릭 가능 → 수익 발생 최고',
      },
    ],
    implementation: [
      '1. 쿠팡 파트너스 "배너" 메뉴 → 카테고리별 시스템 HTML 복사',
      '2. 블로그 관리 > 레이아웃/위젯 > "위젯 직접 등록" > HTML 코드 붙여넣기',
      '3. 블로그 미리보기에서 정상 표시 확인',
    ],
  },

  /** 글 생성 시 자동 포함 규칙 */
  autoPostGenerationRules: {
    disclosureText: {
      whenToInclude: '모든 포스트',
      placement: '글 제목 아래, 본문 시작 전',
      format: '**[쿠팡 파트너스 활동]** 이 포스팅은 쿠팡 파트너스의 일환으로 일정 수수료를 제공받습니다.',
    },
    productLink: {
      format: '쿠팡 파트너스 공식 HTML (API로 생성)',
      placement: '본문 중간 + 하단',
      validation: 'AF5831775 + tracking code 검증',
    },
    htmlStructure: {
      recommended: '마크다운 + HTML 혼합 (prose 렌더링)',
      example: '본문은 마크다운 → 상품 소개는 HTML 삽입',
    },
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
 * 유틸리티: 대가성 공시 문구 검증 (Compliance Check)
 * 포스트에 대가성 문구가 포함되었는지, 위치가 적절한지 검증
 */
export function validateDisclosureText(
  content: string,
  options?: { minPositionRatio?: number }
): {
  hasDisclosure: boolean;
  position: null | number; // 0-1 범위의 위치 (0=상단, 1=하단)
  isTopPlacement: boolean; // 상단 25% 이내인가?
  warnings: string[];
} {
  const { minPositionRatio = 0.25 } = options || {};
  const mandatoryText = '쿠팡 파트너스';
  const warnings: string[] = [];

  const hasDisclosure = content.includes(mandatoryText);

  if (!hasDisclosure) {
    warnings.push('대가성 문구 누락: "쿠팡 파트너스" 관련 문구가 없습니다.');
    return {
      hasDisclosure: false,
      position: null,
      isTopPlacement: false,
      warnings,
    };
  }

  const position = content.indexOf(mandatoryText) / content.length;
  const isTopPlacement = position <= minPositionRatio;

  if (!isTopPlacement) {
    warnings.push(
      `⚠️ 대가성 문구 위치 주의: 텍스트의 ${(position * 100).toFixed(0)}% 지점에 위치 중단에 있습니다. 상단(25% 이내)으로 이동 권장.`
    );
  }

  return {
    hasDisclosure: true,
    position,
    isTopPlacement,
    warnings,
  };
}

/**
 * 유틸리티: 금지된 홍보 방식 감지
 */
export function checkProhibitedMethods(content: string): {
  hasProhibited: boolean;
  detectedMethods: string[];
} {
  const prohibitedPatterns = [
    /수신자.*?(동의|허락|승인).*?(없|미).*?(SMS|메신저)/gi,
    /타인.*?블로그.*?댓글.*?링크/gi,
    /플로팅.*?(배너|팝업)/gi,
    /오도하|속임|기만|가짜/gi,
  ];

  const detectedMethods: string[] = [];

  for (const pattern of prohibitedPatterns) {
    if (pattern.test(content)) {
      detectedMethods.push(`의심 패턴: ${pattern.source}`);
    }
  }

  return {
    hasProhibited: detectedMethods.length > 0,
    detectedMethods,
  };
}

/**
 * 유틸리티: 글 생성 시 필수 체크리스트
 */
export function getCoupangPostChecklistItems(): Array<{
  id: string;
  category: 'compliance' | 'content' | 'technical';
  item: string;
  critical: boolean;
  reason: string;
}> {
  return [
    // Compliance
    {
      id: 'disclosure-presence',
      category: 'compliance',
      item: '대가성 공시 문구 포함 확인',
      critical: true,
      reason: '공정위 규정 필수 (미포함 시 벌금 대상)',
    },
    {
      id: 'disclosure-position',
      category: 'compliance',
      item: '공시 문구가 상단(25% 이내)에 배치',
      critical: true,
      reason: '소비자가 명확히 인식해야 함',
    },
    {
      id: 'no-spoofing',
      category: 'compliance',
      item: '쿠팡 로고 변형/사칭 없음',
      critical: true,
      reason: '계정 정지 사유',
    },
    
    // Content
    {
      id: 'specific-keywords',
      category: 'content',
      item: '제목/설명에 구체적 키워드 사용',
      critical: false,
      reason: '검색 유입 + 관심층 타겟팅',
    },
    {
      id: 'needs-focused',
      category: 'content',
      item: '문제 해결형 서사 구성',
      critical: false,
      reason: 'engage율 + 클릭률 증가',
    },
    {
      id: 'avoid-abstract',
      category: 'content',
      item: '최고/최저가/다양한 등 추상어 제외',
      critical: false,
      reason: '신뢰도 + 자연스러운 톤',
    },
    {
      id: 'data-validation',
      category: 'content',
      item: '상품 평점/리뷰수 등 객관 데이터 포함',
      critical: false,
      reason: '독자 신뢰도 증가',
    },

    // Technical
    {
      id: 'partner-id-accuracy',
      category: 'technical',
      item: '링크에 파트너 ID (AF5831775) + 트래킹 코드 포함',
      critical: true,
      reason: '링크 실적 미인정 방지',
    },
    {
      id: 'html-not-text',
      category: 'technical',
      item: '텍스트 링크 대신 이미지+텍스트 HTML 사용',
      critical: false,
      reason: 'CTR 5배 높음',
    },
    {
      id: 'link-placement',
      category: 'technical',
      item: '링크가 본문 중간 + 하단에 배치',
      critical: false,
      reason: '가시성 + 클릭 기회 증가',
    },
  ];
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
