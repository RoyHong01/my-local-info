/**
 * 인천 지역 정보 fallback 마크다운 생성기 — 고품질 표준 템플릿
 * SSG ([id]/page.tsx) 공유
 */

function mdEscape(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** 신청기한 텍스트를 읽기 쉬운 형태로 정규화 */
function normalizeDeadline(raw: string): string {
  const trimmed = raw.trim();

  if (/상시/i.test(trimmed)) return '상시 신청 (연중 접수)';

  let result = trimmed;

  // YYYY.MM.DD. → YYYY년 M월 D일
  result = result.replace(
    /(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/g,
    (_, y, m, d) => `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`,
  );

  // YYYY-MM-DD → YYYY년 M월 D일
  result = result.replace(
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    (_, y, m, d) => `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`,
  );

  return result;
}

/** 신청방법 텍스트 포매팅 (|| 구분자를 리스트로 분리) */
function formatMethod(raw: string): string {
  const methods = raw
    .split('||')
    .map((m) => m.trim())
    .filter(Boolean);
  if (methods.length <= 1) return mdEscape(raw);
  return methods.map((m) => `- ${mdEscape(m)}`).join('\n');
}

/** 문맥 기반 경고 문구 자동 생성 */
function generateWarnings(params: {
  deadline: string;
  target: string;
  method: string;
  content: string;
}): string[] {
  const warnings: string[] = [];

  if (/예산\s*소진/i.test(params.deadline) || /예산\s*소진/i.test(params.content)) {
    warnings.push('예산 소진 시 조기 마감될 수 있습니다.');
  }

  if (/선착순/i.test(params.method) || /선착순/i.test(params.content)) {
    warnings.push('선착순 접수이므로 조기 마감될 수 있습니다.');
  }

  if (/인천시|인천광역시/i.test(params.target)) {
    warnings.push('인천시 거주자 또는 소재 기관 대상 서비스입니다.');
  }

  return warnings;
}

export interface IncheonMarkdownParams {
  name: string;
  summary: string;
  content: string;
  target: string;
  method: string;
  deadline: string;
  supportType: string;
  userType: string;
  criteria: string;
  field: string;
  office: string;
  dept: string;
  phone: string;
  org: string;
}

/** 서술형 인트로 생성: 서비스분야 + 서비스명 + 지원대상 + 지원유형을 자연어 문장으로 조합 */
function buildNarrativeIntro(params: IncheonMarkdownParams): string {
  const parts: string[] = [];

  // 1. 서비스분야 + 서비스명 서술
  if (params.field) {
    parts.push(
      `**${params.name}**은(는) ${mdEscape(params.field)} 분야의 인천시 지원 사업입니다.`,
    );
  } else if (params.summary) {
    parts.push(
      `**${params.name}**은(는) ${mdEscape(params.summary).replace(/\.$/, '')}을 위한 인천시 정책입니다.`,
    );
  }

  // 2. 지원대상 요약 (첫 문장만 추출)
  if (params.target) {
    const firstSentence = params.target
      .split(/[\r\n]+/)[0]
      .replace(/^○\s*/, '')
      .replace(/^\s*[-·]\s*/, '')
      .trim();
    if (firstSentence && firstSentence.length > 5) {
      parts.push(
        `주요 지원 대상은 ${mdEscape(firstSentence).replace(/\.$/, '')}입니다.`,
      );
    }
  }

  // 3. 지원유형 언급
  if (params.supportType) {
    const types = params.supportType
      .split('||')
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length > 0) {
      parts.push(`${types.join(', ')} 형태로 지원됩니다.`);
    }
  }

  return parts.join(' ');
}

export function buildIncheonMarkdown(params: IncheonMarkdownParams): string {
  const parts: string[] = [];

  // ── 핵심 안내 ──
  parts.push(`## ${params.name} — 핵심 안내`);

  // 서술형 인트로 (자연어 요약)
  const intro = buildNarrativeIntro(params);
  if (intro) {
    parts.push(intro);
  }

  parts.push(
    params.summary
      ? mdEscape(params.summary)
      : '상세 내용은 공식 사이트를 확인해주세요.',
  );

  // ── 지원 내용 ──
  parts.push('### ✨ 어떤 지원인가요?');
  parts.push(
    params.content
      ? mdEscape(params.content)
      : '상세 지원 내용은 공식 사이트를 확인해주세요.',
  );

  // ── 지원 대상 ──
  parts.push('### 👥 지원 대상');
  parts.push(
    params.target
      ? mdEscape(params.target)
      : '지원 대상 정보는 공식 사이트에서 확인해주세요.',
  );

  // ── 선정 기준 (자격) ──
  if (params.criteria) {
    parts.push('### ✅ 선정 기준');
    parts.push(mdEscape(params.criteria));
  }

  // ── 신청 방법 ──
  parts.push('### 📝 신청 방법');
  parts.push(
    params.method
      ? formatMethod(params.method)
      : '신청 방법은 담당 기관에 문의하시기 바랍니다.',
  );

  // ── 신청 기한 ──
  parts.push('### 📅 신청 기한');
  parts.push(
    params.deadline
      ? normalizeDeadline(params.deadline)
      : '신청 기한 정보가 등록되지 않았습니다. 담당 기관에 확인하세요.',
  );

  // ── 문의 및 접수 안내 (테이블) ──
  const contactRows: [string, string][] = [];
  if (params.org) contactRows.push(['소관 기관', mdEscape(params.org)]);
  if (params.dept) contactRows.push(['담당 부서', mdEscape(params.dept)]);
  if (params.office) contactRows.push(['접수 기관', mdEscape(params.office)]);
  if (params.phone) contactRows.push(['전화 문의', mdEscape(params.phone)]);
  if (params.supportType) contactRows.push(['지원 유형', mdEscape(params.supportType)]);
  if (params.userType) contactRows.push(['대상 구분', mdEscape(params.userType)]);
  if (params.field) contactRows.push(['서비스 분야', mdEscape(params.field)]);

  if (contactRows.length > 0) {
    parts.push('### 📞 문의 및 접수 안내');
    parts.push('| 항목 | 내용 |');
    parts.push('|------|------|');
    contactRows.forEach(([k, v]) => parts.push(`| ${k} | ${v} |`));
  }

  // ── 경고 문구 ──
  const warnings = generateWarnings(params);
  if (warnings.length > 0) {
    parts.push('---');
    parts.push(warnings.map((w) => `> ⚠️ ${w}`).join('\n>\n'));
  }

  return parts.join('\n\n').trim();
}
