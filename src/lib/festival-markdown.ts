/**
 * 축제·여행 fallback 마크다운 생성기 — 고품질 표준 템플릿
 * SSG ([id]/page.tsx) 공유
 */

function mdEscape(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

/** YYYYMMDD → YYYY년 M월 D일 */
function formatDate(d: string): string {
  if (!d || d.length !== 8) return d || '';
  const y = d.slice(0, 4);
  const m = parseInt(d.slice(4, 6));
  const dd = parseInt(d.slice(6, 8));
  return `${y}년 ${m}월 ${dd}일`;
}

/** 날짜 범위를 읽기 쉬운 형태로 포매팅 */
function formatDateRange(start: string, end: string): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (!s && !e) return '';
  if (!e) return s;
  if (!s) return e;
  // 같은 연도면 종료 날짜에서 연도 생략
  if (start.slice(0, 4) === end.slice(0, 4)) {
    const m = parseInt(end.slice(4, 6));
    const d = parseInt(end.slice(6, 8));
    return `${s} ~ ${m}월 ${d}일`;
  }
  return `${s} ~ ${e}`;
}

/** D-day 또는 진행 상태 계산 (KST 기준) */
function getStatusLabel(start: string, end: string): string {
  if (!start || !end || start.length !== 8 || end.length !== 8) return '';

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().slice(0, 10).replace(/-/g, '');

  if (todayStr > end) return '종료된 행사';
  if (todayStr >= start && todayStr <= end) return '🎉 현재 진행 중';

  // D-day 계산
  const startDate = new Date(
    `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`,
  );
  const today = new Date(kst.toISOString().slice(0, 10));
  const diff = Math.ceil(
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff > 0 && diff <= 30) return `D-${diff}`;
  return '';
}

/** overview를 의미 단위 문단으로 분리 */
function splitOverview(text: string): string[] {
  if (!text) return [];
  const normalized = mdEscape(text);

  // 빈 줄 기준 분리
  const byBlank = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  // 문장 기준 분리 (긴 텍스트)
  const sentences = normalized
    .split(/(?<=[.!?다요])\s+(?=[가-힣A-Za-z0-9""'])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return [normalized];

  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '));
  }
  return chunks;
}

export interface FestivalMarkdownParams {
  name: string;
  overview: string;
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  addr1: string;
  addr2: string;
  tel: string;
  homepage: string;
}

/** 서술형 인트로 생성: 축제명 + 일정 + 지역을 자연어 문장으로 조합 */
function buildNarrativeIntro(params: FestivalMarkdownParams): string {
  const parts: string[] = [];

  // 1. 축제명 + 일정
  const dateRange = formatDateRange(params.startDate, params.endDate);
  if (dateRange) {
    parts.push(`**${params.name}**이(가) ${dateRange} 동안 개최됩니다.`);
  } else {
    parts.push(`**${params.name}**에 대한 안내입니다.`);
  }

  // 2. 지역 언급
  if (params.addr1) {
    const region = params.addr1.split(' ').slice(0, 2).join(' ');
    parts.push(`${region}에서 만나볼 수 있는 이 축제의 주요 정보를 확인해보세요.`);
  }

  return parts.join(' ');
}

export function buildFestivalMarkdown(params: FestivalMarkdownParams): string {
  const parts: string[] = [];

  const dateRange = formatDateRange(params.startDate, params.endDate);
  const status = getStatusLabel(params.startDate, params.endDate);

  // ── 핵심 안내 ──
  parts.push(`## ${params.name} — 축제 안내`);

  // 서술형 인트로 (자연어 요약)
  const intro = buildNarrativeIntro(params);
  if (intro) {
    parts.push(intro);
  }

  // ── 일정 정보 ──
  if (dateRange || status) {
    parts.push('### 📅 일정');
    const dateInfo: string[] = [];
    if (dateRange) dateInfo.push(`- **기간**: ${dateRange}`);
    if (status) dateInfo.push(`- **상태**: ${status}`);
    parts.push(dateInfo.join('\n'));
  }

  // ── 축제 소개 ──
  const overviewParagraphs = splitOverview(params.overview);
  if (overviewParagraphs.length > 0) {
    parts.push('### ✨ 축제 소개');
    overviewParagraphs.forEach((p) => parts.push(p));
  } else {
    parts.push('### ✨ 축제 소개');
    parts.push('축제에 대한 상세 소개 정보는 공식 사이트를 확인해주세요.');
  }

  // ── 방문 정보 (테이블) ──
  const visitRows: [string, string][] = [];
  if (params.addr1) {
    const fullAddr = params.addr2
      ? `${params.addr1} ${params.addr2}`
      : params.addr1;
    visitRows.push(['주소', mdEscape(fullAddr)]);
  }
  if (dateRange) visitRows.push(['일정', dateRange]);
  if (params.tel) visitRows.push(['전화', mdEscape(params.tel)]);
  if (params.homepage) visitRows.push(['공식 홈페이지', mdEscape(params.homepage)]);

  if (visitRows.length > 0) {
    parts.push('### 📌 방문 정보');
    parts.push('| 항목 | 내용 |');
    parts.push('|------|------|');
    visitRows.forEach(([k, v]) => parts.push(`| ${k} | ${v} |`));
  }

  return parts.join('\n\n').trim();
}
