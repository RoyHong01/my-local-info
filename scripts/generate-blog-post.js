const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const BLOG_MAX_GENERATION_SECONDS = Number(process.env.BLOG_MAX_GENERATION_SECONDS || 900);
const BLOG_MAX_CANDIDATES_PER_CATEGORY = Number(process.env.BLOG_MAX_CANDIDATES_PER_CATEGORY || 8);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const ALLOW_GEMINI_PRO = process.env.ALLOW_GEMINI_PRO === 'true';
if (/\bpro\b/i.test(GEMINI_MODEL) && !ALLOW_GEMINI_PRO) {
  throw new Error(`안전장치: Pro 모델(${GEMINI_MODEL})은 차단됩니다. 필요하면 ALLOW_GEMINI_PRO=true를 명시하세요.`);
}
const BLOG_GEMINI_MIN_DELAY_MS = Number(process.env.BLOG_GEMINI_MIN_DELAY_MS || 5000);
const BLOG_MAX_API_CALLS = Number(process.env.BLOG_MAX_API_CALLS || 12);
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 8192);
const BLOG_DAILY_BUDGET_KRW = Number(process.env.BLOG_DAILY_BUDGET_KRW || 0);
const GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS = Number(process.env.GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS || 0);
// 특정 카테고리만 실행 (예: "전국 축제·여행"). 미설정 시 전체 실행
const BLOG_ONLY_CATEGORY = process.env.BLOG_ONLY_CATEGORY || '';
// 후보 텍스트(title/name/addr1/overview)에 키워드가 포함된 항목만 생성
const BLOG_ONLY_KEYWORD = (process.env.BLOG_ONLY_KEYWORD || '').trim();
const BLOG_ONLY_KEYWORD_MATCH = String(process.env.BLOG_ONLY_KEYWORD_MATCH || 'contains').trim().toLowerCase();
const BLOG_PUBLISHED_BY = String(process.env.BLOG_PUBLISHED_BY || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
const ALLOW_EXISTING_BLOG_POST_OVERWRITE = process.env.ALLOW_EXISTING_BLOG_POST_OVERWRITE === 'true';
const SHORT_MODE = process.env.SHORT_MODE === 'true';

let geminiApiCallCount = 0;
let lastGeminiCallAt = 0;
let estimatedCostKrw = 0;
let budgetStopped = false;
let budgetStopReason = '';
let midImageInsertedCount = 0;
let midImageOmittedCount = 0;

const budgetEnabled = BLOG_DAILY_BUDGET_KRW > 0 && GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS > 0;

function setGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  try {
    const safe = String(value ?? '').replace(/\r?\n/g, ' ');
    fsSync.appendFileSync(outputPath, `${key}=${safe}\n`);
  } catch {
    // ignore output write failures
  }
}

function publishBudgetOutputs() {
  setGithubOutput('budget_enabled', budgetEnabled ? 'true' : 'false');
  setGithubOutput('budget_limit_krw', BLOG_DAILY_BUDGET_KRW);
  setGithubOutput('estimated_cost_krw', estimatedCostKrw.toFixed(2));
  setGithubOutput('budget_stopped', budgetStopped ? 'true' : 'false');
  setGithubOutput('budget_stop_reason', budgetStopReason || '');
  setGithubOutput('mid_image_inserted_count', midImageInsertedCount);
  setGithubOutput('mid_image_omitted_count', midImageOmittedCount);
}

// 블로그 글 생성: 기본 모델은 비용 최적화를 위해 gemini-2.5-flash-lite
async function callGemini(prompt) {
  if (budgetStopped) {
    throw new Error(`BLOG_BUDGET_STOP:${budgetStopReason || '일일 예산 상한 도달'}`);
  }

  if (geminiApiCallCount >= BLOG_MAX_API_CALLS) {
    throw new Error(`Gemini API 호출 상한 도달: ${BLOG_MAX_API_CALLS}회`);
  }

  const elapsedSinceLastCall = Date.now() - lastGeminiCallAt;
  if (lastGeminiCallAt > 0 && elapsedSinceLastCall < BLOG_GEMINI_MIN_DELAY_MS) {
    await sleep(BLOG_GEMINI_MIN_DELAY_MS - elapsedSinceLastCall);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res;
  try {
    geminiApiCallCount++;
    lastGeminiCallAt = Date.now();
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.92,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        },
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Gemini API 타임아웃: ${GEMINI_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${err}`);
  }
  const data = await res.json();
  const candidate = data?.candidates?.[0] || {};

  const outputTokens = Number(data?.usageMetadata?.candidatesTokenCount || data?.usageMetadata?.outputTokenCount || 0);
  if (budgetEnabled && outputTokens > 0) {
    estimatedCostKrw += (outputTokens / 1000) * GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS;

    if (estimatedCostKrw >= BLOG_DAILY_BUDGET_KRW) {
      budgetStopped = true;
      budgetStopReason = `일일 예산 상한 도달 (추정 ${estimatedCostKrw.toFixed(2)}원 / 한도 ${BLOG_DAILY_BUDGET_KRW}원)`;
      console.warn(`  ⛔ ${budgetStopReason}`);
    }
  }

  return {
    text: candidate?.content?.parts?.[0]?.text || '',
    finishReason: candidate?.finishReason || '',
  };
}

function looksIncompleteGeminiOutput(text) {
  const value = (text || '').trim();
  if (!value) return true;

  // frontmatter 기본 구조 확인
  if (!value.startsWith('---\n') || value.indexOf('\n---\n', 4) === -1) return true;

  // FILENAME은 누락돼도 fallback으로 생성 가능하므로 필수 조건으로 두지 않음

  // 본문 최소 길이 가드 (짤린 글 방지)
  const withoutFilename = value
    .split('\n')
    .filter((line) => !line.trim().startsWith('FILENAME:'))
    .join('\n')
    .trim();
  if (withoutFilename.length < 1000) return true;

  // 핵심 소제목 개수 확인 (중간 절단 방지)
  const h3Count = (withoutFilename.match(/^###\s+/gm) || []).length;
  if (h3Count < 2) return true;

  // 이미지 캡션/이미지 줄에서 끝나면 절단 가능성이 높음
  const tail = withoutFilename.split('\n').map((line) => line.trim()).filter(Boolean).slice(-2).join('\n');
  if (/^!\[[^\]]*\]\([^\)]*\)$/.test(tail) || /\*현장 분위기를 미리 느낄 수 있는 대표 이미지예요\.\*/.test(tail)) {
    return true;
  }

  return false;
}

function normalizeMatchText(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeKeywordMatchMode(mode) {
  const value = String(mode || '').trim().toLowerCase();
  if (value === 'exact-first' || value === 'exact-only' || value === 'contains') return value;
  return 'contains';
}

function getKeywordNameFields(item) {
  return [item?.['서비스명'], item?.['title'], item?.['name']].filter((value) => typeof value === 'string' && value.trim());
}

function isExactKeywordMatch(field, keyword) {
  const a = String(field || '').trim();
  const b = String(keyword || '').trim();
  if (!a || !b) return false;
  // 1순위: 원문 기준 완전일치
  if (a === b) return true;
  // 2순위: 공백/특수문자 정규화 후 완전일치
  return normalizeMatchText(a) === normalizeMatchText(b);
}

function getKeywordHaystack(item) {
  return [
    item?.['서비스명'],
    item?.['title'],
    item?.['name'],
    item?.['addr1'],
    item?.['location'],
    item?.['overview'],
  ]
    .filter(Boolean)
    .join(' ');
}

function toDateRankValue(raw) {
  const text = String(raw || '').trim();
  if (!text) return 0;
  if (/^\d{8}$/.test(text)) return Number(text);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number(text.replace(/-/g, ''));
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return Number(text.replace(/\./g, ''));
  return 0;
}

function getScheduleRank(item) {
  return Math.max(
    toDateRankValue(item?.eventstartdate),
    toDateRankValue(item?.startDate),
    toDateRankValue(item?.eventenddate),
    toDateRankValue(item?.endDate)
  );
}

function getImageRank(item) {
  return item?.firstimage || item?.firstimage2 || item?.image || item?.thumbnail ? 1 : 0;
}

function getViewRank(item) {
  const raw = item?.['조회수'] ?? item?.viewCount ?? item?.readCount ?? item?.hit ?? 0;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sortExactMatchesWithTieBreaker(items) {
  return [...items].sort((a, b) => {
    // 1) 최신 일정 우선
    const dateDiff = getScheduleRank(b) - getScheduleRank(a);
    if (dateDiff !== 0) return dateDiff;

    // 2) 이미지 보유 우선
    const imageDiff = getImageRank(b) - getImageRank(a);
    if (imageDiff !== 0) return imageDiff;

    // 3) 조회수 우선
    const viewDiff = getViewRank(b) - getViewRank(a);
    if (viewDiff !== 0) return viewDiff;

    return 0;
  });
}

function filterItemsByKeyword(items, keyword, matchMode) {
  const mode = normalizeKeywordMatchMode(matchMode);
  const normalizedKeyword = normalizeMatchText(keyword);
  if (!normalizedKeyword) return { mode, selectedMode: 'none', items };

  const exactMatches = items.filter((item) =>
    getKeywordNameFields(item).some((field) => isExactKeywordMatch(field, keyword))
  );
  const exactMatchesSorted = sortExactMatchesWithTieBreaker(exactMatches);

  if (mode === 'exact-only') {
    return { mode, selectedMode: 'exact-only', items: exactMatchesSorted };
  }

  if (mode === 'exact-first' && exactMatches.length > 0) {
    // 완전일치가 있으면 비완전일치 후보는 즉시 배제
    return { mode, selectedMode: 'exact-only-when-found', items: exactMatchesSorted };
  }

  const containsMatches = items.filter((item) => normalizeMatchText(getKeywordHaystack(item)).includes(normalizedKeyword));
  const selectedMode = mode === 'exact-first' ? 'contains-fallback' : 'contains';
  return { mode, selectedMode, items: containsMatches };
}

function extractFrontmatterValue(content, key) {
  const m = content.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

function quoteYamlScalar(value) {
  return `"${String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\"/g, '"')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim()}"`;
}

function ensureQuotedFrontmatterField(content, key) {
  const fieldRegex = new RegExp(`^(${key}:\\s*)(.+)$`, 'm');
  return content.replace(fieldRegex, (match, prefix, rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value || value === '""' || value === "''") {
      return `${prefix}""`;
    }

    // YAML block scalar(>|)는 그대로 유지
    if (value === '|' || value === '>') {
      return match;
    }

    const unwrapped = value.replace(/^['"]|['"]$/g, '');
    return `${prefix}${quoteYamlScalar(unwrapped)}`;
  });
}

function buildSourceSnapshotKey({ title, startDate, endDate, addr1 }) {
  const t = normalizeMatchText(title);
  const s = String(startDate || '').trim();
  const e = String(endDate || '').trim();
  const a = normalizeMatchText(addr1);
  if (!t) return '';
  return `${t}|${s}|${e}|${a}`;
}

function upsertFrontmatterField(content, key, rawValue) {
  if (!rawValue) return content;
  const value = String(rawValue).replace(/"/g, '\\"').trim();
  if (!value) return content;

  const line = `${key}: "${value}"`;
  const fieldRegex = new RegExp(`^${key}:.*$`, 'm');
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, line);
  }

  if (/^source_id:.*$/m.test(content)) {
    return content.replace(/^source_id:.*$/m, `$&\n${line}`);
  }
  if (/^image:.*$/m.test(content)) {
    return content.replace(/^image:.*$/m, `$&\n${line}`);
  }
  if (/^tags:\s*\[.*\]$/m.test(content)) {
    return content.replace(/^(tags:\s*\[.*\])$/m, `$1\n${line}`);
  }
  return content;
}

// 카테고리별 우선순위 정렬 함수
function sortByPriority(items, category) {
  const todayISO = new Date().toISOString().split('T')[0];
  const toNum = (value) => {
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const normalizeDate = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^\d{8}$/.test(text)) {
      return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return text.replace(/\./g, '-');
    return '';
  };
  const getDeadline = (item) =>
    normalizeDate(item.endDate || item.eventenddate || item['신청기한'] || item['신청기간'] || item['접수기간']);
  const getViews = (item) => toNum(item['조회수'] ?? item.viewCount ?? item.readCount ?? item.hit ?? 0);
  const getModified = (item) =>
    String(item.modifiedtime || item['수정일시'] || item.updatedAt || item.modifiedAt || item.collectedAt || '').trim();

  return [...items].sort((a, b) => {
    const aDeadline = getDeadline(a);
    const bDeadline = getDeadline(b);
    const aHasDeadline = aDeadline >= todayISO ? 1 : 0;
    const bHasDeadline = bDeadline >= todayISO ? 1 : 0;

    if (aHasDeadline !== bHasDeadline) return bHasDeadline - aHasDeadline;
    if (aHasDeadline && bHasDeadline && aDeadline !== bDeadline) return aDeadline < bDeadline ? -1 : 1;

    const aViews = getViews(a);
    const bViews = getViews(b);
    if (aViews !== bViews) return bViews - aViews;

    return getModified(b).localeCompare(getModified(a));
  });
}

function getCategoryTargetCount(category) {
  const defaults = {
    '인천 지역 정보': 1,
    '전국 축제·여행': 1,
    '전국 보조금·복지 정책': 2,
  };

  const envByCategory = {
    '인천 지역 정보': process.env.BLOG_POSTS_INCHEON,
    '전국 축제·여행': process.env.BLOG_POSTS_FESTIVAL,
    '전국 보조금·복지 정책': process.env.BLOG_POSTS_SUBSIDY,
  };

  const raw = Number.parseInt(String(envByCategory[category] ?? ''), 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return defaults[category] || 1;
}

function isSeoulSubsidyItem(item) {
  const fields = [
    item?.['서비스명'],
    item?.['소관기관명'],
    item?.['접수기관명'],
    item?.location,
    item?.addr1,
  ]
    .map((value) => String(value || ''))
    .join(' ');

  return /서울|서울시|서울특별시/.test(fields);
}

function parseIsoDateFromFilename(filename) {
  const base = path.basename(String(filename || ''));
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function getDateDiffDays(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

async function hasRecentSeoulSubsidyPost(postsDir, withinDays = 7) {
  const todayISO = new Date().toISOString().split('T')[0];
  const files = await fs.readdir(postsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const dated = parseIsoDateFromFilename(file);
    if (!dated) continue;
    const age = getDateDiffDays(dated, todayISO);
    if (age < 0 || age > withinDays) continue;

    const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
    const category = extractFrontmatterValue(content, 'category');
    if (category !== 'subsidy') continue;

    const haystack = [
      extractFrontmatterValue(content, 'title'),
      extractFrontmatterValue(content, 'source_title'),
      extractFrontmatterValue(content, 'source_addr1'),
      extractFrontmatterValue(content, 'source_locality'),
      content,
    ]
      .map((value) => String(value || ''))
      .join(' ');

    if (/서울|서울시|서울특별시/.test(haystack)) {
      return true;
    }
  }

  return false;
}

// 이미 작성된 블로그 글의 source_id 및 파일명 목록 가져오기
async function getExistingPosts(postsDir) {
  // source_id가 있는 파일: ID로 정확 매칭
  const serviceIds = new Set();
  // source_id가 없는 파일: 파일명 키워드로 부분 매칭
  const filenameKeywords = [];
  // 기존 포스트 제목 키워드
  const titleKeys = [];
  // source snapshot key (title+date+addr)
  const sourceSnapshotKeys = new Set();

  try {
    const files = await fs.readdir(postsDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(postsDir, file), 'utf-8');

      const titleValue = extractFrontmatterValue(content, 'title');
      const sourceTitle = extractFrontmatterValue(content, 'source_title');
      const sourceStartDate = extractFrontmatterValue(content, 'source_start_date');
      const sourceEndDate = extractFrontmatterValue(content, 'source_end_date');
      const sourceAddr1 = extractFrontmatterValue(content, 'source_addr1');
      const sourceSnapshotKey = extractFrontmatterValue(content, 'source_snapshot_key')
        || buildSourceSnapshotKey({
          title: sourceTitle || titleValue,
          startDate: sourceStartDate,
          endDate: sourceEndDate,
          addr1: sourceAddr1,
        });

      if (titleValue) {
        titleKeys.push(normalizeMatchText(titleValue));
      }
      if (sourceSnapshotKey) {
        sourceSnapshotKeys.add(sourceSnapshotKey);
      }

      // source_id 추출 — 따옴표 제거 후 저장
      const idMatch = content.match(/^source_id:\s*(.+)\s*$/m);
      if (idMatch) {
        serviceIds.add(idMatch[1].trim().replace(/^["']|["']$/g, ''));
      } else {
        // source_id 없는 파일은 파일명(날짜 제외)을 키워드로 보관
        const keyword = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
        filenameKeywords.push(keyword);
      }
    }
  } catch (_) {}

  return { serviceIds, filenameKeywords, titleKeys, sourceSnapshotKeys };
}

// 30초 대기
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// KST 기준 오늘 날짜 반환 (YYYYMMDD) — GitHub Actions 04:00 KST = UTC 19:00 전일 오차 보정
function getTodayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '');
}

// 종료일이 이미 지났거나 리드타임 이내인 항목 판별 (날짜 기반)
// festival: eventenddate (YYYYMMDD) — 종료 N일 이내 또는 이미 종료 시 제외
// incheon/subsidy: endDate (YYYY-MM-DD) — 오늘 이전 종료 시만 제외
function isEndDatePassed(item) {
  const todayKST = getTodayKST();
  const minDaysBeforeEnd = Number(process.env.BLOG_FESTIVAL_MIN_DAYS_BEFORE_END || '7');

  // 축제: eventenddate (YYYYMMDD)
  const eventEnd = (item.eventenddate || '').trim();
  if (eventEnd && /^\d{8}$/.test(eventEnd)) {
    // 오늘 기준 N일 후 날짜 계산 (KST)
    const threshold = new Date(Date.now() + 9 * 60 * 60 * 1000);
    threshold.setDate(threshold.getDate() + minDaysBeforeEnd);
    const thresholdStr = threshold.toISOString().split('T')[0].replace(/-/g, '');
    return eventEnd <= thresholdStr; // 7일 이내 종료 또는 이미 종료 → 제외
  }

  // 인천/보조금: endDate (YYYY-MM-DD)
  const endDate = (item.endDate || '').trim();
  if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return endDate.replace(/-/g, '') < todayKST;
  }

  // 종료일 없으면 (상시 등) 만료 아님
  return false;
}

function splitMarkdownSections(markdown) {
  const normalized = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: '', body: normalized };
  }

  const frontmatter = normalized.slice(0, end + 5);
  const body = normalized.slice(end + 5).trim();
  return { frontmatter, body };
}

function extractTitleFromFrontmatter(frontmatter) {
  const m = frontmatter.match(/^title:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function buildHookFromTitle(title, fallback) {
  const seed = (title || fallback || '이번 소식').trim();
  const cleaned = seed
    .replace(/["'“”‘’]/g, '')
    .replace(/[!?.,:;]+$/g, '')
    .trim();
  const core = cleaned.split(/[,:]/)[0].trim() || cleaned;
  return `## ${core}, 핵심부터 빠르게 볼까요?`;
}

const FESTIVAL_BANNED_LEAD_PATTERNS = [
  /^\s*솔직히(?:\s|$)/i,
  /^\s*진심으로\s*말씀드려요[.!?…\s]*/i,
  /^\s*진실(?:을)?\s*말씀드릴게요[.!?…\s]*/i,
];

function stripHeadingPrefix(text) {
  return String(text || '').replace(/^#{1,6}\s+/, '').trim();
}

function hasFestivalBannedLead(text) {
  const normalized = String(text || '')
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, '')
    .trim();
  return FESTIVAL_BANNED_LEAD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasFestivalLeadRepetitionInGeneratedText(text) {
  const raw = String(text || '');
  if (!raw) return false;

  const titleMatch = raw.match(/^title:\s*(.+)$/m);
  if (titleMatch && hasFestivalBannedLead(titleMatch[1])) return true;

  const firstHookMatch = raw.match(/^##\s+(.+)$/m);
  if (firstHookMatch && hasFestivalBannedLead(firstHookMatch[1])) return true;

  return false;
}

function normalizeFestivalTitleDiversity(title, itemName) {
  if (!hasFestivalBannedLead(title)) return title;
  const base = String(itemName || title || '이번 주말 여행').trim();
  return `${base}, 이번 주말 포인트만 콕 볼까요? 🌸`;
}

function normalizeFestivalHookDiversity(body, seedTitle, itemName) {
  const lines = String(body || '').split('\n');
  const firstHookIndex = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (firstHookIndex < 0) return String(body || '');

  const hookText = stripHeadingPrefix(lines[firstHookIndex]);
  if (!hasFestivalBannedLead(hookText)) return String(body || '');

  lines[firstHookIndex] = buildHookFromTitle(seedTitle, itemName);
  return lines.join('\n');
}

function enforceFestivalLeadDiversity(markdown, itemName) {
  const { frontmatter, body } = splitMarkdownSections(markdown);
  if (!frontmatter) return markdown;

  const currentTitle = extractTitleFromFrontmatter(frontmatter);
  const nextTitle = normalizeFestivalTitleDiversity(currentTitle, itemName);

  let nextFrontmatter = frontmatter;
  if (nextTitle && nextTitle !== currentTitle) {
    const escapedTitle = nextTitle.replace(/"/g, '\\"');
    nextFrontmatter = nextFrontmatter.replace(/^title:.*$/m, `title: "${escapedTitle}"`);
  }

  const nextBody = normalizeFestivalHookDiversity(body, nextTitle || currentTitle, itemName);
  return `${nextFrontmatter}\n\n${nextBody}`.trim();
}

function normalizeNumberedInlineSections(content) {
  const lines = content.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const numberedBoldInline = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*[:：]?\s+(.+)$/);
    if (numberedBoldInline) {
      out.push(`### ${numberedBoldInline[1]}. ${numberedBoldInline[2].trim()}`);
      out.push('');
      out.push(numberedBoldInline[3].trim());
      out.push('');
      continue;
    }

    const numberedBoldOnly = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*$/);
    if (numberedBoldOnly) {
      out.push(`### ${numberedBoldOnly[1]}. ${numberedBoldOnly[2].trim()}`);
      out.push('');
      continue;
    }

    const standaloneBoldNumber = trimmed.match(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/);
    if (standaloneBoldNumber) {
      out.push(`### ${standaloneBoldNumber[1]}. ${standaloneBoldNumber[2].trim()}`);
      out.push('');
      continue;
    }

    const emojiNumberHeading = trimmed.match(/^\*\*([1-9])(?:\uFE0F?\u20E3)\s+(.+?)\*\*\s*$/u);
    if (emojiNumberHeading) {
      out.push(`### ${emojiNumberHeading[1]}. ${emojiNumberHeading[2].trim()}`);
      out.push('');
      continue;
    }

    const emojiPlainHeading = trimmed.match(/^([1-9])(?:\uFE0F?\u20E3)\s+(.+)$/u);
    if (emojiPlainHeading) {
      out.push(`### ${emojiPlainHeading[1]}. ${emojiPlainHeading[2].trim()}`);
      out.push('');
      continue;
    }

    const plainWithDesc = trimmed.match(
      /^(\d+)\.\s+(.+?(?:니다|요|됩니다|있습니다|합니다|간단합니다|큽니다|좋습니다|가능합니다))\s+(.+)$/
    );
    if (plainWithDesc) {
      out.push(`### ${plainWithDesc[1]}. ${plainWithDesc[2].trim()}`);
      out.push('');
      out.push(plainWithDesc[3].trim());
      out.push('');
      continue;
    }

    const standalonePlainNumber = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (standalonePlainNumber) {
      out.push(`### ${standalonePlainNumber[1]}. ${standalonePlainNumber[2].trim()}`);
      out.push('');
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function removeFalseCodeBlockIndentation(content) {
  return content
    .split('\n')
    .map((line) => {
      if (!/^\s+/.test(line)) return line;
      if (/^\s*(```|~~~)/.test(line)) return line;
      if (/^\s*>/.test(line)) return line;
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) return line;
      return line.trimStart();
    })
    .join('\n');
}

function calculateToneScore(content) {
  const emotionalKeywords = [
    '따스', '설렘', '기분', '여유', '기다리고', '추천', '즐겨', '함께',
    '소중한', '특별한', '가볍게', '산책', '봄바람', '감성', '마음', '따뜻'
  ];

  let score = 0;
  if (/\?/.test(content)) score += 20;
  if (/##\s+/.test(content)) score += 15;
  if (/###\s+1\./.test(content) && /###\s+2\./.test(content) && /###\s+3\./.test(content)) score += 25;

  const hitCount = emotionalKeywords.reduce((acc, keyword) => {
    return acc + (content.includes(keyword) ? 1 : 0);
  }, 0);
  score += Math.min(30, hitCount * 5);

  if (content.length >= 1000) score += 10;
  return Math.min(100, score);
}

function ensureEmotionalIntro(body, category) {
  const paragraphs = body.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return body;

  const introText = paragraphs.slice(0, 2).join(' ');
  const hasEmotion = /(따스|설렘|여유|기분|함께|특별한|소중한|가볍게|마음)/.test(introText);
  if (hasEmotion) return body;

  const fallbackByCategory = {
    '전국 축제·여행': '여행의 설렘이 필요한 주말이라면, 잠깐의 발걸음으로도 기분 좋은 추억을 만들 수 있어요.',
    '전국 보조금·복지 정책': '복잡하게 느껴지는 정책도 생활 속 언어로 풀어보면, 지금 바로 도움이 되는 정보가 됩니다.',
    '인천 지역 정보': '우리 동네의 작은 변화가 일상을 더 따뜻하게 만들 수 있다는 점, 그래서 더 반갑게 느껴집니다.',
  };

  const fallback = fallbackByCategory[category] || '오늘 정보가 여러분의 하루를 조금 더 가볍고 따뜻하게 만들어주길 바랍니다.';

  // 훅 바로 다음에 감성 도입 단락 추가
  if (/^##\s+.+/m.test(body)) {
    return body.replace(/^(##\s+.+)$/m, `$1\n\n${fallback}`);
  }
  return `${fallback}\n\n${body}`;
}

function injectMidArticleImage(body, imageUrl, itemName) {
  if (!body || !imageUrl) {
    return { body, status: 'omitted(no_alt_image)' };
  }

  // 이미 본문에 이미지가 있으면 중복 삽입 방지
  if (/!\[[^\]]*\]\([^\)]+\)/.test(body)) {
    return { body, status: 'omitted(existing_image_in_body)' };
  }

  const lines = body.split('\n');
  const h3Indexes = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^###\s+/.test(lines[i].trim())) h3Indexes.push(i);
  }

  const imageBlock = [
    `![${itemName || '축제 현장'} 관련 이미지](${imageUrl})`,
    '',
    '*현장 분위기를 미리 느낄 수 있는 대표 이미지예요.*',
    ''
  ];

  // 가장 자연스러운 위치: 첫 번째 ### 섹션이 끝나고 두 번째 ### 시작 직전
  if (h3Indexes.length >= 2) {
    const insertAt = h3Indexes[1];
    const next = [...lines.slice(0, insertAt), '', ...imageBlock, ...lines.slice(insertAt)];
    return { body: next.join('\n').replace(/\n{3,}/g, '\n\n').trim(), status: 'inserted(between_sections)' };
  }

  // 대체 위치: 구분선(---) 직전
  const dividerIndex = lines.findIndex((line) => /^---\s*$/.test(line.trim()));
  if (dividerIndex > 0) {
    const next = [...lines.slice(0, dividerIndex), '', ...imageBlock, ...lines.slice(dividerIndex)];
    return { body: next.join('\n').replace(/\n{3,}/g, '\n\n').trim(), status: 'inserted(before_divider)' };
  }

  // 마지막 대체: 본문 끝
  return {
    body: `${body.trim()}\n\n${imageBlock.join('\n')}`.replace(/\n{3,}/g, '\n\n').trim(),
    status: 'inserted(at_end)'
  };
}

function getCandidateText(candidate, keys) {
  for (const key of keys) {
    const value = candidate?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function normalizeInlineInfo(value) {
  if (!value) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\|\|/g, ' / ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\|/g, ' / ')
    .trim();
}

function inferFestivalTravelKind(candidate) {
  const source = [
    getCandidateText(candidate, ['서비스명', 'title', 'name']),
    getCandidateText(candidate, ['overview', '지원내용']),
    getCandidateText(candidate, ['tags']),
  ].join(' ');

  if (/축제/.test(source)) return 'festival';
  if (/여행|관광|투어|트레킹|코스/.test(source)) return 'travel';
  if (/행사|페스티벌|박람회|전시|공연/.test(source)) return 'event';
  return 'event';
}

function getFestivalTravelLabels(candidate) {
  const kind = inferFestivalTravelKind(candidate);
  if (kind === 'festival') {
    return {
      heading: '### 📌 한눈에 보는 축제 정보',
      name: '축제명',
      period: '축제기간',
      content: '축제정보',
    };
  }

  if (kind === 'travel') {
    return {
      heading: '### 📌 한눈에 보는 여행 정보',
      name: '여행명',
      period: '여행기간',
      content: '여행정보',
    };
  }

  return {
    heading: '### 📌 한눈에 보는 행사 정보',
    name: '행사명',
    period: '행사기간',
    content: '행사정보',
  };
}

function buildOneGlanceRows(candidate, category) {
  const rows = [];
  const pushRow = (label, value) => {
    const normalized = normalizeInlineInfo(value);
    if (!normalized) return;
    rows.push([label, normalized]);
  };

  const startDate = getCandidateText(candidate, ['eventstartdate', 'startDate']);
  const endDate = getCandidateText(candidate, ['eventenddate', 'endDate']);
  const eventPeriod = startDate && endDate ? `${startDate} ~ ${endDate}` : '';

  if (category === '전국 축제·여행') {
    const labels = getFestivalTravelLabels(candidate);
    pushRow(labels.name, getCandidateText(candidate, ['서비스명', 'title', 'name']));
    pushRow(labels.period, eventPeriod || endDate || startDate);
    pushRow(labels.content, getCandidateText(candidate, ['지원내용', 'overview']));
    pushRow('문의전화', getCandidateText(candidate, ['전화문의', 'tel']));
    pushRow('주소', getCandidateText(candidate, ['addr1', 'addr2', 'location']));
    pushRow('상세정보', getCandidateText(candidate, ['상세조회URL', 'homepage', 'link']));
    return rows;
  }

  pushRow('서비스명', getCandidateText(candidate, ['서비스명', 'title', 'name']));
  pushRow('신청기한', getCandidateText(candidate, ['신청기한', 'endDate']));
  pushRow('지원내용', getCandidateText(candidate, ['지원내용', 'overview']));
  pushRow('지원대상', getCandidateText(candidate, ['지원대상', 'target']));
  pushRow('신청방법', getCandidateText(candidate, ['신청방법']));
  pushRow('접수기관', getCandidateText(candidate, ['접수기관', '접수기관명', 'location']));
  pushRow('문의전화', getCandidateText(candidate, ['전화문의', 'tel']));
  pushRow('소관기관', getCandidateText(candidate, ['소관기관명']));
  pushRow('주소', getCandidateText(candidate, ['addr1', 'addr2', 'location']));
  pushRow('지원유형', getCandidateText(candidate, ['지원유형']));
  pushRow('상세정보', getCandidateText(candidate, ['상세조회URL', 'homepage', 'link']));

  return rows;
}

function getOneGlanceHeadingByCategory(category) {
  if (category === '전국 축제·여행') return '### 📌 한눈에 보는 행사 정보';
  return '### 📌 한눈에 보는 신청 정보';
}

function hasStructuredApplicationInfo(candidate, category) {
  if (category === '전국 축제·여행') return false;

  const keys = [
    ['신청기한', 'endDate'],
    ['지원내용', 'overview'],
    ['지원대상', 'target'],
    ['신청방법'],
    ['접수기관', '접수기관명', 'location'],
    ['전화문의', 'tel'],
    ['소관기관명'],
    ['상세조회URL', 'homepage', 'link'],
  ];

  return keys.some((group) => getCandidateText(candidate, group));
}

function buildApplicationInfoPrompt(candidate, category) {
  if (!hasStructuredApplicationInfo(candidate, category)) return '';

  const proseRule = SHORT_MODE
    ? '- SHORT_MODE=true일 때만 표 전후 설명을 간결하게 작성하되, 맥락이 끊기지 않도록 표 위/아래 각각 최소 1문장 이상 유지할 것'
    : '- 표 전후로 본문 내용을 충분히 배치하여 정보의 맥락을 완성할 것 (최소 2~3문단 권장)';

  return `
[신청 정보 표 규칙 - 반드시 적용]
- 이 글에 신청/접수 정보가 있으면 본문에 반드시 \`### 📌 한눈에 보는 신청 정보\` 섹션을 넣고, 바로 아래에 마크다운 표를 작성할 것
- 표 헤더는 반드시 \`| 항목 | 내용 |\` 형식으로 작성할 것
- JSON에 존재하는 신청기한, 지원내용, 지원대상, 신청방법, 접수기관, 문의전화, 소관기관, 상세정보를 표에 우선 정리할 것
- \`신청 방법\`을 별도 번호 리스트(1. 2. 3.) 섹션으로 다시 풀어쓰지 말 것
- \`**신청 방법**\` 같은 굵은 문단 제목도 사용하지 말 것
- 표 바로 위에는 신청 요점/대상 맥락을 연결하고, 표 바로 아래에는 주의사항·실행 팁·다음 행동을 자연스러운 문단으로 이어서 설명할 것
${proseRule}
`.trim();
}

function buildOneGlanceInfoSection(candidate, category) {
  const rows = buildOneGlanceRows(candidate, category);
  if (rows.length === 0) return '';

  const heading = category === '전국 축제·여행'
    ? getFestivalTravelLabels(candidate).heading
    : getOneGlanceHeadingByCategory(category);

  const lines = [
    heading,
    '',
    '| 항목 | 내용 |',
    '|------|------|',
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  ];

  return lines.join('\n').trim();
}

function buildOneGlanceInfoTable(candidate, category) {
  const rows = buildOneGlanceRows(candidate, category);
  if (rows.length === 0) return '';

  const lines = [
    '| 항목 | 내용 |',
    '|------|------|',
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  ];

  return lines.join('\n').trim();
}

function upsertMarkdownTable(sectionBody, tableMarkdown) {
  if (!tableMarkdown) return sectionBody;

  const body = (sectionBody || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!body) return tableMarkdown;

  const tableRegex = /(?:^|\n)(\|[^\n]*\|\s*\n\|[-:| ]+\|\s*(?:\n\|[^\n]*\|\s*)*)/m;
  const match = body.match(tableRegex);
  if (!match || match.index === undefined) {
    return `${body}\n\n${tableMarkdown}`.trim();
  }

  const tableStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
  const tableEnd = tableStart + match[1].length;

  const before = body.slice(0, tableStart).trimEnd();
  const after = body.slice(tableEnd).trimStart();
  return [before, tableMarkdown, after].filter(Boolean).join('\n\n').trim();
}

function stripExtraPipeBlocksAfterCanonicalTable(sectionBody) {
  const body = (sectionBody || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!body) return body;

  const lines = body.split('\n');
  const out = [];
  let inCanonicalTable = false;
  let canonicalTableEnded = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isPipeLine = /^\|.*\|\s*$/.test(trimmed);

    if (!inCanonicalTable && !canonicalTableEnded && /^\|\s*항목\s*\|\s*내용\s*\|\s*$/u.test(trimmed)) {
      inCanonicalTable = true;
      out.push(line);
      continue;
    }

    if (inCanonicalTable) {
      if (isPipeLine) {
        out.push(line);
      } else {
        inCanonicalTable = false;
        canonicalTableEnded = true;
        out.push(line);
      }
      continue;
    }

    // canonical table 이후에 나오는 추가 pipe 블록은 중복 원데이터로 간주해 제거
    if (canonicalTableEnded && isPipeLine) {
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureOneGlanceInfoSection(body, candidate, category) {
  const section = buildOneGlanceInfoSection(candidate, category);
  const tableMarkdown = buildOneGlanceInfoTable(candidate, category);
  if (!section || !tableMarkdown) return body;

  const normalized = (body || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return section;

  const headingRegex = /^###\s+.*한눈에 보는.*(?:신청 정보|축제 정보|행사 정보|여행 정보|정보 요약|핵심 정보).*$/m;
  const headingMatch = normalized.match(headingRegex);

  if (!headingMatch || headingMatch.index === undefined) {
    return `${normalized}\n\n${section}`.replace(/\n{3,}/g, '\n\n').trim();
  }

  const start = headingMatch.index;
  const lineEnd = normalized.indexOf('\n', start);
  const headingLine = lineEnd >= 0 ? normalized.slice(start, lineEnd).trim() : headingMatch[0].trim();
  const afterHeading = lineEnd >= 0 ? normalized.slice(lineEnd + 1) : '';
  const nextHeadingIdx = afterHeading.search(/^###\s+/m);

  const before = normalized.slice(0, start).trimEnd();
  const sectionBody = nextHeadingIdx >= 0 ? afterHeading.slice(0, nextHeadingIdx).trim() : afterHeading.trim();
  const normalizedSectionBody = stripExtraPipeBlocksAfterCanonicalTable(
    upsertMarkdownTable(sectionBody, tableMarkdown)
  );
  const tail = nextHeadingIdx >= 0 ? afterHeading.slice(nextHeadingIdx).trimStart() : '';

  return [before, headingLine, normalizedSectionBody, tail]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function postProcessGeneratedMarkdown(markdown, context) {
  const { frontmatter, body } = splitMarkdownSections(markdown);
  let normalizedBody = (body || '').trim();

  // 본문 H1은 H2로 낮춰 카드 메인 제목보다 과도하게 커 보이지 않게 처리
  normalizedBody = normalizedBody
    .split('\n')
    .map((line) => line.replace(/^#\s+/, '## '))
    .join('\n');

  // 훅 누락 시 자동 삽입
  const firstNonEmpty = normalizedBody.split('\n').find((line) => line.trim().length > 0) || '';
  if (!/^##\s+/.test(firstNonEmpty)) {
    const title = extractTitleFromFrontmatter(frontmatter) || context.itemName;
    normalizedBody = `${buildHookFromTitle(title, context.itemName)}\n\n${normalizedBody}`;
  }

  normalizedBody = normalizeNumberedInlineSections(normalizedBody);
  normalizedBody = removeFalseCodeBlockIndentation(normalizedBody);
  normalizedBody = ensureEmotionalIntro(normalizedBody, context.category);

  let midImageStatus = 'not_applicable';

  // 전국 축제·여행 카테고리는 "상단 대표 이미지와 다른 URL"이 있을 때만 본문 중간 이미지 삽입
  if (context.category === '전국 축제·여행') {
    const midImageResult = injectMidArticleImage(normalizedBody, context.midImageUrl, context.itemName);
    normalizedBody = midImageResult.body;
    midImageStatus = midImageResult.status;
  }

  // 표 헤더만 남는 케이스/핵심 항목 누락 케이스를 방지하기 위해 source 데이터를 기준으로 표 서식만 보정
  normalizedBody = ensureOneGlanceInfoSection(normalizedBody, context.candidate || {}, context.category);

  // 범위 표시 ~ 를 - 로 치환 (remarkGfm이 ~text~를 취소선으로 해석하는 문제 방지)
  // ~~취소선~~ 은 건드리지 않고, 단독 ~ 만 교체
  normalizedBody = normalizedBody
    .split('\n')
    .map((line) => line.replace(/(?<!~)~(?!~)/g, '-'))
    .join('\n');

  normalizedBody = normalizedBody.replace(/\n{3,}/g, '\n\n').trim();

  const toneScore = calculateToneScore(normalizedBody);
  const summary = {
    toneScore,
    hasHook: /^##\s+/.test((normalizedBody.split('\n').find((line) => line.trim()) || '')),
    hasReasonStructure: /###\s+1\./.test(normalizedBody) && /###\s+2\./.test(normalizedBody) && /###\s+3\./.test(normalizedBody),
    length: normalizedBody.length,
    midImageStatus,
  };

  return {
    content: `${frontmatter}\n\n${normalizedBody}`.trim(),
    summary,
  };
}

// 블로그 글 1편 생성
async function generatePost(candidate, postsDir) {
  const defaultImages = {
    '인천 지역 정보': 'https://pick-n-joy.com/images/default-incheon.svg',
    '전국 보조금·복지 정책': 'https://pick-n-joy.com/images/default-subsidy.svg',
    '전국 축제·여행': 'https://pick-n-joy.com/images/default-festival.svg',
  };
  const nationalTokenPool = ['서울', '부산', '제주', '경주', '강릉', '전주', '여수'];
  const internalNationalLandmarkImages = [
    'https://pick-n-joy.com/images/gyeongbokgung-hero.png',
    'https://pick-n-joy.com/images/changdeokgung-hero.png',
    'https://pick-n-joy.com/images/changgyeonggung-hero.png',
    'https://pick-n-joy.com/images/incheon-family-month-hero.jpg',
    'https://pick-n-joy.com/images/incheon-spring-festival-2026.jpg',
  ];
  let imageUrl = candidate.firstimage || candidate.firstimage2 || '';
  if (!imageUrl && process.env.TOUR_API_KEY) {
    try {
      const { extractRegionTokens, getRegionalLandmark } = require('./lib/landmark-engine');
      const regionText = [
        candidate['소관기관명'],
        candidate['접수기관명'],
        candidate['서비스명'],
        candidate.title,
        candidate.location,
        candidate.addr1,
      ].filter(Boolean).join(' ');
      const tokens = extractRegionTokens(regionText);
      const fallbackTokens = tokens.length > 0 ? tokens : ['대한민국'];
      const expandedTokens = [];
      const seenTokens = new Set();
      for (const token of fallbackTokens) {
        const value = String(token || '').trim();
        if (!value) continue;
        if (value === '대한민국') {
          for (const nationalToken of nationalTokenPool) {
            if (!seenTokens.has(nationalToken)) {
              seenTokens.add(nationalToken);
              expandedTokens.push(nationalToken);
            }
          }
        } else if (!seenTokens.has(value)) {
          seenTokens.add(value);
          expandedTokens.push(value);
        }
      }
      if (!generatePost._landmarkCache) generatePost._landmarkCache = new Map();
      const lmCache = generatePost._landmarkCache;
      for (const token of expandedTokens) {
        const result = await getRegionalLandmark({
          regionName: token,
          tourApiKey: process.env.TOUR_API_KEY,
          cache: lmCache,
          numOfRows: 15,
        });
        if (result?.imageUrl) {
          imageUrl = result.imageUrl;
          break;
        }
      }
    } catch (_err) {
      // 랜드마크 조회 실패 시 기본 이미지로 fallback
    }
  }
  if (!imageUrl && candidate._category === '전국 보조금·복지 정책') {
    const seedText = String(candidate['서비스ID'] || candidate['id'] || candidate['서비스명'] || candidate.title || 'national');
    let seedHash = 0;
    for (let i = 0; i < seedText.length; i++) {
      seedHash = ((seedHash << 5) - seedHash) + seedText.charCodeAt(i);
      seedHash |= 0;
    }
    imageUrl = internalNationalLandmarkImages[Math.abs(seedHash) % internalNationalLandmarkImages.length];
  }
  if (!imageUrl) {
    imageUrl = defaultImages[candidate._category] || 'https://pick-n-joy.com/images/default-og.svg';
  }
  const midImageUrl = (candidate.firstimage && candidate.firstimage2 && candidate.firstimage2 !== candidate.firstimage)
    ? candidate.firstimage2
    : '';

  const itemName = candidate['서비스명'] || candidate['title'] || candidate['name'] || '';
  const sourceId = candidate['서비스ID'] || candidate['contentid'] || candidate['id'] || '';
  const sourceTitle = itemName;
  const sourceStartDate = candidate['eventstartdate'] || candidate['startDate'] || '';
  const sourceEndDate = candidate['eventenddate'] || candidate['endDate'] || '';
  const sourceAddr1 = candidate['addr1'] || candidate['location'] || '';
  const sourceSnapshotKey = buildSourceSnapshotKey({
    title: sourceTitle,
    startDate: sourceStartDate,
    endDate: sourceEndDate,
    addr1: sourceAddr1,
  });
  const today = new Date().toISOString().split('T')[0];

  // 전국 축제·여행 전용 스타일 오버라이드
  const isFestival = candidate._category === '전국 축제·여행';
  const festivalStyleOverride = isFestival ? `
[전국 축제·여행 카테고리 전용 추가 규칙 - 아래 내용이 기존 규칙보다 우선 적용됨]

■ 제목 규칙 (기존 title 생성 규칙에 추가):
- 제목에 연도('2026', '2025' 등)를 넣지 마. 제목이 보고서처럼 무거워 보여.
- '완전정복', '총정리', '핵심정리' 같은 딱딱한 단어도 금지.
- 대신 그 축제의 핵심 즐길 거리 2~3개를 조합한 스토리텔링형 제목을 써줘.
- 같은 어투/같은 문장 시작을 반복하지 마. 특히 아래 시작 문구는 제목/훅에서 절대 사용 금지:
  - "솔직히 말할게요", "진심으로 말씀드려요"
- 제목 스타일은 매번 다르게 선택해. 아래 유형 중 하나를 랜덤하게 선택:
  - 질문형 / 정보요약형 / 감성형 / 숫자활용형
- 제목에는 지역명 + 축제명(또는 행사명)을 자연스럽게 반드시 포함해.
  - 좋은 예: "딸기 향 가득한 봄날, 논산에서 인생샷 찍고 왔어요 🍓"
  - 좋은 예: "한강 + 벚꽃 + 치맥 = 여의도 봄꽃 축제, 핵심부터 빠르게 볼까요?"
  - 나쁜 예: "논산딸기축제 2026: 인생 딸기 맛보러 갈 사람 바로 여기 붙어!"

■ 소제목 구조 규칙 (기존 규칙 6번 대체):
- 소제목에 '1.', '2.', '3.' 숫자 번호를 붙이지 마. 블로그가 아니라 보고서처럼 보여.
- 대신 그 단락의 내용을 매력적으로 압축한 '감성 소제목'을 써줘.
  - 나쁜 예: "### 1. 마트에서 사 먹는 딸기랑 차원이 달라요"
  - 좋은 예: "### 마트 딸기와는 차원이 다른 압도적인 달콤함 🍓"
  - 나쁜 예: "### 2. 그냥 보는 축제가 아니라, 직접 만드는 축제예요"
  - 좋은 예: "### 보기만 하면 손해인 체험 프로그램들 🎪"
- 소제목은 2~4개 자유롭게 구성 (반드시 3개일 필요 없음)

■ 분리선 사용 규칙:
- 본문에서 '---' 또는 '***' 분리선은 전체 글에서 최대 1번만 사용해.
- 단락 구분은 분리선 대신 자연스러운 문맥 흐름이나 빈 줄로 처리해.

■ 본문 이미지 배치 규칙:
- 본문 중간 이미지는 선택 사항이며, 상단 대표 이미지와 "다른" 이미지 URL이 있을 때만 1장 추가해.
- 상단 image 필드 URL과 동일한 이미지는 본문 중간에 절대 다시 쓰지 마.
- 위치는 첫 번째 핵심 소제목(###) 설명이 끝난 뒤, 다음 소제목으로 넘어가기 직전이 가장 자연스럽게 보이도록 배치해.
- TourAPI에 추가 이미지가 없으면 본문 중간 이미지는 생략해.
` : '';

  const prompt = `아래 공공서비스/행사/정보를 바탕으로 블로그 글을 작성해줘.
카테고리: ${candidate._category}

정보: ${JSON.stringify(candidate, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목. 콜론(:) 포함 시 반드시 큰따옴표로 감싸기)
date: ${today}
summary: (130~160자 한국어 요약. 핵심 키워드를 앞에 배치. Google 검색 결과에 표시되는 문장이므로 금액·날짜·장소 등 구체적 정보 포함)
description: (summary와 동일한 내용)
category: ${candidate._category}
published_by: ${BLOG_PUBLISHED_BY}
tags: [태그1, 태그2, 태그3, 태그4, 태그5]
---

※ 이미지 주의사항:
- image 필드에는 반드시 글의 핵심 주제와 직접 관련된 이미지 URL을 사용할 것
- 벚꽃 글에 일본 사진, 산수유 글에 벚꽃 사진처럼 관련 없는 이미지는 절대 사용 금지
- TourAPI firstimage가 있으면 그것을 최우선 사용 (가장 관련성 높음)
- TourAPI 이미지가 없으면 카테고리 기본 SVG 사용 (잘못된 외부 이미지보다 낫다)
- 절대로 주제와 무관한 Unsplash 또는 외부 이미지 URL을 임의로 삽입하지 말 것

[정보 완전성 규칙 - 가장 중요, 반드시 지킬 것]
제공된 JSON 데이터에 있는 아래 항목들을 본문에 빠짐없이 모두 포함할 것.
단 하나도 생략하지 말 것:

서비스명/title/name: 서비스 정확한 이름
서비스목적요약/summary/description: 서비스 목적
지원내용: 구체적인 지원 금액, 혜택, 횟수 등 모든 세부 내용
지원대상: 자격 조건 전체 (나이, 거주지, 소득 기준 등 모든 조건)
신청방법: 신청 절차, 방법, 기간, 기한 등
접수기관명/location: 신청 장소
전화문의/tel: 연락처 (반드시 포함)
소관기관명: 담당 기관
선정기준: 선정 기준이 있으면 반드시 포함
eventstartdate/eventenddate/startDate/endDate: 일정/기간
addr1/addr2: 주소
overview: 상세 설명 전체
※ 위 항목 중 JSON에 있는 것은 하나도 빠뜨리지 말 것. 정보 누락 = 잘못된 글.

${buildApplicationInfoPrompt(candidate, candidate._category)}

(본문: 1500자 이상, 아래 스타일 가이드 반드시 적용)
${festivalStyleOverride}
[글쓰기 스타일 가이드 - 반드시 따를 것]
- 페르소나: 30대 초반의 감각적인 여행·생활정보 에디터. 친절하고 세련된 형/오빠가 동생에게 추천해주는 톤.
- 종결어미 규칙 (절대 준수):
  · 금지: '~이다', '~한다', '~됐다', '~있다' 같은 평어체 종결어미
  · 필수: '~해요', '~거든요', '~입니다', '~네요', '~예요', '~있어요' 경어체만 사용
  · 틀림 예: "고창은 전북에 위치한 도시다."
  · 맞음 예: "고창은 전북에 있는 작은 도시인데요, 진짜 한 번쯤은 가볼 만해요."
- AI 금지어 (절대 사용 금지): 결론적으로 / 무엇보다도 / 다양한 / 인상적인 / 포착한 / 주목할 만한 / 대표적인 / 각광받는 / 눈길을 끄는 / ~의 대명사가 됐다 / ~를 선사한다 / 즐길 수 있다 / 만끽할 수 있다
- 대신 쓸 표현: '진짜 대박인 건', '여긴 꼭 가봐야 해요', '생각보다 훨씬', '가보면 알아요', '핵심만 먼저 볼게요'
- 정보 나열 전에 반드시 시각적 묘사나 현장 기분을 먼저 써줄 것
  예: "초록색 바다에 들어와 있는 것 같은 기분이었어요."
- 숫자·통계는 딱딱하게 쓰지 말고 비유로 풀어줄 것
  예: "77만㎡면 여의도 공원 두 배 크기예요. 진짜 말이 안 되는 넓이거든요."
- 마무리는 "함께 가면 좋은 사람" 같은 공식 추천 문구 절대 금지. 대신 작가의 주관적인 한 줄 평이나 '이런 상황에 가면 딱이다'는 짧은 여운으로 끝낼 것
  예1: "저는 다음에 부모님 모시고 한 번 더 오려고요. 효도 점수 제대로 딸 것 같거든요. 😉"
  예2: "혼자 조용히 생각 정리하고 싶을 때, 여기 창가 자리가 제일 먼저 떠오를 것 같네요."
  예3: "다들 벚꽃만 보러 가는데, 저는 개인적으로 이 초록색 청보리가 더 마음을 울리더라고요."
- 이모지 1~2개 자연스럽게 사용 (남발 금지)

(본문 작성 규칙 - MZ 감성 스타일 적용)
1) 본문 첫 줄은 반드시 훅(Hook) 소제목으로 시작: "## ..." 형식 (절대 "#" 사용 금지)
2) 훅 첫 문장은 짧고 강렬하게, 1~2줄로 독자를 바로 끌어당길 것
  - 예시: "이번 주말, 여기로 방향 정하면 고민이 줄어요." / "꽃비 내릴 때 딱 맞춰 움직여볼까요?" / "핵심 동선만 먼저 잡아볼게요."
  - 금지: "솔직히 말할게요" / "진심으로 말씀드려요"로 시작하는 훅
3) 문체는 경어체 필수. '~해요/~거든요/~입니다/~네요' 종결어미만 사용할 것.
  - '~이다/~한다/~됐다' 평어체 종결어미는 절대 금지
  - 'AI 금지어' (결론적으로/다양한/인상적인 등) 사용 금지
  - 정보 설명 전에 시각적 묘사나 현장 기분을 먼저 쓸 것
  - 단, 과장/허위/확인되지 않은 정보는 절대 작성 금지
4) 이모지 자연스럽게 활용 (섹션 제목에 1~2개, 과하지 않게)
5) 꿀팁/주의사항은 불릿 대신 이모지 리스트로 표현
  - 예: 🚗 주차는 일찍 / 📸 포토존은 오전 / ☕ 근처 카페도 필수
6) 추천 이유 3가지는 반드시 아래 형식으로 작성
  ### 1. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 2. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 3. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)
7) 소제목과 설명은 반드시 줄바꿈으로 분리 (한 줄에 붙여 쓰지 말 것)
8) 표(table)를 적절히 활용하면 가독성 UP (방문 시간대, 코스 비교 등)
9) 전체 1000자 이상, 신청/방문 방법 안내 포함
10) 마무리는 "함께 가면 좋은 사람" 같은 공식 추천 문구 금지. 작가 본인의 솔직한 한 줄 소감이나 특정 상황/감정을 자연스럽게 언급하며 끝낼 것
11) 강제 줄바꿈: 문단은 길게 쓰지 말고, 최대 2~3문장마다 반드시 줄바꿈(Enter)할 것
12) 문단 길이 제한: 한 문단이 스마트폰 화면 기준 4~5줄을 넘지 않도록 짧게 끊을 것
13) 문단 전환 시 시각 포인트: 필요한 곳에 이모지(예: ✨ 🌸 📌)를 가볍게 활용해 가독성을 높일 것 (남발 금지)

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;

  let generatedText = '';
  let lastFinishReason = '';
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryHint = attempt > 1
      ? `\n\n[재시도 지시]\n방금 응답은 중간에 끊겼어요. 처음부터 다시 완성본으로 작성하고, 마지막 줄 FILENAME까지 반드시 출력해줘.`
      : '';

    let gemini;
    try {
      gemini = await callGemini(`${prompt}${retryHint}`);
    } catch (err) {
      if (String(err?.message || '').startsWith('BLOG_BUDGET_STOP:')) {
        throw err;
      }
      if (attempt < maxAttempts) {
        console.warn(`  ⚠️ Gemini 호출 실패(시도 ${attempt}/${maxAttempts}): ${err.message}`);
        await sleep(2000);
        continue;
      }
      throw err;
    }

    generatedText = gemini.text || '';
    lastFinishReason = gemini.finishReason || '';

    if (isFestival && hasFestivalLeadRepetitionInGeneratedText(generatedText)) {
      if (attempt < maxAttempts) {
        console.warn(`  ⚠️ 금지 시작문구(솔직히 계열) 감지. 재시도 ${attempt + 1}/${maxAttempts}`);
        await sleep(2000);
        continue;
      }
    }

    const isIncomplete =
      lastFinishReason === 'MAX_TOKENS' ||
      looksIncompleteGeminiOutput(generatedText);

    if (!isIncomplete) break;

    if (attempt < maxAttempts) {
      console.warn(`  ⚠️ 응답 불완전 감지(finishReason=${lastFinishReason || 'N/A'}). 재시도 ${attempt + 1}/${maxAttempts}`);
      await sleep(2000);
    }
  }

  if (!generatedText || looksIncompleteGeminiOutput(generatedText)) {
    console.error(`Gemini 응답 불완전(최종 finishReason=${lastFinishReason || 'N/A'})`);
    console.error('Gemini API 응답 없음');
    return false;
  }

  // 파일명 추출
  const lines = generatedText.split('\n');
  let filename = '';
  const contentLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  let finalContent = contentLines.join('\n').trim();
  if (finalContent.startsWith('```markdown')) finalContent = finalContent.substring(11);
  else if (finalContent.startsWith('```')) finalContent = finalContent.substring(3);
  if (finalContent.endsWith('```')) finalContent = finalContent.slice(0, -3);
  finalContent = finalContent.trim();

  // image 필드 삽입 (이미 있으면 덮어쓰기, 없으면 tags 뒤에 삽입)
  if (/^image:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^image:.*$/m, `image: "${imageUrl}"`);
  } else {
    finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nimage: "${imageUrl}"`);
  }

  // source_id 반드시 삽입
  if (sourceId) {
    if (/^image:/m.test(finalContent)) {
      finalContent = finalContent.replace(/^(image:.*)$/m, `$1\nsource_id: "${sourceId}"`);
    } else {
      // image 필드가 없으면 tags 바로 뒤에 삽입
      finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nsource_id: "${sourceId}"`);
    }
  }

  finalContent = upsertFrontmatterField(finalContent, 'source_title', sourceTitle);
  finalContent = upsertFrontmatterField(finalContent, 'source_start_date', sourceStartDate);
  finalContent = upsertFrontmatterField(finalContent, 'source_end_date', sourceEndDate);
  finalContent = upsertFrontmatterField(finalContent, 'source_addr1', sourceAddr1);
  finalContent = upsertFrontmatterField(finalContent, 'source_snapshot_key', sourceSnapshotKey);
  finalContent = upsertFrontmatterField(finalContent, 'published_by', BLOG_PUBLISHED_BY);
  finalContent = upsertFrontmatterField(finalContent, 'image_source', candidate.image_source || '');
  finalContent = upsertFrontmatterField(finalContent, 'image_source_note', candidate.image_source_note || '');

  // YAML 파싱 안정성을 위해 문자열 frontmatter는 항상 따옴표로 정규화
  finalContent = ensureQuotedFrontmatterField(finalContent, 'title');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'summary');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'description');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'source_title');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'source_addr1');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'published_by');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'image_source');
  finalContent = ensureQuotedFrontmatterField(finalContent, 'image_source_note');

  if (!filename) {
    filename = `${today}-post-${Date.now()}`;
  }
  if (!filename.endsWith('.md')) filename += '.md';

  // slug 삽입: 파일명(확장자 제거)을 slug로 사용
  const slugValue = filename.replace(/\.md$/, '');
  if (/^source_id:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^(source_id:.*)$/m, `$1\nslug: "${slugValue}"`);
  } else if (!/^slug:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nslug: "${slugValue}"`);
  }

  // 생성 후 자동 후처리(구조 보정 + 감성 품질 점검)
  const postProcessed = postProcessGeneratedMarkdown(finalContent, {
    itemName,
    category: candidate._category,
    imageUrl,
    midImageUrl,
    candidate,
  });
  finalContent = postProcessed.content;
  if (candidate._category === '전국 축제·여행') {
    finalContent = enforceFestivalLeadDiversity(finalContent, itemName);
  }
  console.log(`  🔎 품질 점검: tone=${postProcessed.summary.toneScore}/100, hook=${postProcessed.summary.hasHook ? 'Y' : 'N'}, reasons=${postProcessed.summary.hasReasonStructure ? 'Y' : 'N'}, len=${postProcessed.summary.length}`);
  if (candidate._category === '전국 축제·여행') {
    const midStatus = postProcessed.summary.midImageStatus || 'unknown';
    if (midStatus.startsWith('inserted')) midImageInsertedCount++;
    if (midStatus.startsWith('omitted')) midImageOmittedCount++;
    console.log(`  🖼️ 중간 이미지 상태: ${midStatus}`);
  }

  const outputPath = path.join(postsDir, filename);
  let outputExists = false;
  try {
    await fs.access(outputPath);
    outputExists = true;
  } catch {
    outputExists = false;
  }

  if (outputExists && !ALLOW_EXISTING_BLOG_POST_OVERWRITE) {
    console.warn(`안전장치: 기존 블로그 글이 이미 존재하여 덮어쓰지 않습니다. (${filename})`);
    return false;
  }

  await fs.writeFile(outputPath, finalContent, 'utf-8');
  console.log(`✅ 생성 완료: ${filename} (${itemName})`);
  return true;
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    publishBudgetOutputs();
    return;
  }

  console.log(`GEMINI_MODEL: ${GEMINI_MODEL}`);
  console.log(`GEMINI_MAX_OUTPUT_TOKENS: ${GEMINI_MAX_OUTPUT_TOKENS}`);
  console.log(`BLOG_GEMINI_MIN_DELAY_MS: ${BLOG_GEMINI_MIN_DELAY_MS}`);
  console.log(`BLOG_MAX_API_CALLS: ${BLOG_MAX_API_CALLS}`);
  if (budgetEnabled) {
    console.log(`BLOG_DAILY_BUDGET_KRW: ${BLOG_DAILY_BUDGET_KRW}`);
    console.log(`GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS: ${GEMINI_ESTIMATED_KRW_PER_1K_OUTPUT_TOKENS}`);
  } else {
    console.log('BLOG_DAILY_BUDGET_KRW: 비활성 (예산 제한 없음)');
  }

  const dataFiles = [
    { file: 'incheon.json', category: '인천 지역 정보' },
    { file: 'subsidy.json', category: '전국 보조금·복지 정책' },
    { file: 'festival.json', category: '전국 축제·여행' }
  ];

  const targetFiles = BLOG_ONLY_CATEGORY
    ? dataFiles.filter(d => d.category === BLOG_ONLY_CATEGORY)
    : dataFiles;
  if (BLOG_ONLY_CATEGORY) {
    console.log(`\n🎯 BLOG_ONLY_CATEGORY="${BLOG_ONLY_CATEGORY}" — 해당 카테고리만 실행합니다.`);
  }
  if (BLOG_ONLY_KEYWORD) {
    console.log(`🎯 BLOG_ONLY_KEYWORD="${BLOG_ONLY_KEYWORD}" — 키워드 포함 항목만 생성합니다.`);
    console.log(`🎯 BLOG_ONLY_KEYWORD_MATCH="${normalizeKeywordMatchMode(BLOG_ONLY_KEYWORD_MATCH)}"`);
  }

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  const { serviceIds, filenameKeywords, titleKeys, sourceSnapshotKeys } = await getExistingPosts(postsDir);
  console.log(`기존 블로그 글: source_id ${serviceIds.size}건, 파일명 키워드 ${filenameKeywords.length}건, 제목 키워드 ${titleKeys.length}건, 스냅샷키 ${sourceSnapshotKeys.size}건`);
  const runStartedAt = Date.now();

  let totalGenerated = 0;

  for (const { file, category } of targetFiles) {
    if (budgetStopped) {
      console.log(`\n⛔ 예산 상한으로 블로그 생성 중단: ${budgetStopReason}`);
      break;
    }

    console.log(`\n📂 카테고리: ${category}`);
    const dataPath = path.join(process.cwd(), 'public', 'data', file);
    let items = [];
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      items = JSON.parse(content);
    } catch (_) {
      console.log(`${file} 없음, 건너뜀`);
      continue;
    }

    // 만료 제외 + 종료일 지난 항목 제외 + 키워드 필터 + 우선순위 정렬
    const baseItems = items.filter(item => !item.expired).filter(item => !isEndDatePassed(item));
    const keywordFiltered = BLOG_ONLY_KEYWORD
      ? filterItemsByKeyword(baseItems, BLOG_ONLY_KEYWORD, BLOG_ONLY_KEYWORD_MATCH)
      : { mode: 'none', selectedMode: 'none', items: baseItems };

    if (BLOG_ONLY_KEYWORD) {
      console.log(`  키워드 매칭 결과: ${keywordFiltered.items.length}개 (${keywordFiltered.selectedMode})`);
      if (keywordFiltered.selectedMode === 'exact-only-when-found') {
        console.log('  ✅ 완전일치 후보 발견: 부분일치 후보는 무시하고 즉시 생성 대상을 확정합니다.');
        if (keywordFiltered.items.length >= 2) {
          const topName = keywordFiltered.items[0]?.['서비스명'] || keywordFiltered.items[0]?.['title'] || keywordFiltered.items[0]?.['name'] || 'unknown';
          console.log(`  ✅ 타이브레이커 적용(최신 일정 > 이미지 > 조회수): 1순위 후보 "${topName}"`);
        }
      }
    }

    const validItems = sortByPriority(keywordFiltered.items, category);

    // [보조금 한정] 기존 포스트 source_id → 전화문의+서비스명 매칭용 Map
    // 동일 기관의 "유사 서비스"만 중복 방지 (범죄피해 구조금 vs 범죄피해자 경제적 지원 케이스)
    // 같은 기관이라도 다른 정책(예: 장애인차량 vs 다자녀자동차)은 허용
    const usedPhoneServices = new Map(); // phone → [{ name, normalizedPrefix }]
    if (category === '전국 보조금·복지 정책') {
      for (const existId of serviceIds) {
        const match = items.find(x => String(x['서비스ID'] || '') === existId);
        if (match && match['전화문의'] && match['서비스명']) {
          const phone = String(match['전화문의']).trim();
          const name = match['서비스명'];
          // 핵심 키워드 추출: 정규화 후 앞 6글자 (한글 기준 핵심 명사 위치)
          const normalizedPrefix = normalizeMatchText(name).slice(0, 6);
          if (!usedPhoneServices.has(phone)) {
            usedPhoneServices.set(phone, []);
          }
          usedPhoneServices.get(phone).push({ name, normalizedPrefix });
        }
      }
      if (usedPhoneServices.size > 0) {
        const totalServices = [...usedPhoneServices.values()].reduce((sum, arr) => sum + arr.length, 0);
        console.log(`  전화문의+유사도 체크: 기존 ${usedPhoneServices.size}개 번호(${totalServices}건 서비스) 등록`);
      }
    }
    
    // 서비스명 유사도 판정 함수: 앞 6글자 정규화 후 4글자 이상 겹치면 유사 서비스
    function isSimilarService(newName, existingServices) {
      const newPrefix = normalizeMatchText(newName).slice(0, 6);
      if (newPrefix.length < 4) return false;
      return existingServices.some(({ normalizedPrefix }) => {
        if (normalizedPrefix.length < 4) return false;
        // 앞 4글자가 동일하면 유사 서비스로 판정
        return newPrefix.slice(0, 4) === normalizedPrefix.slice(0, 4);
      });
    }

    // 중복 체크: source_id 정확 매칭 우선, 없으면 파일명 키워드 부분 매칭
    let candidates = validItems.filter(item => {
      const name = item['서비스명'] || item['title'] || item['name'] || '';
      const id = String(item['서비스ID'] || item['contentid'] || item['id'] || '');
      const startDate = item['eventstartdate'] || item['startDate'] || '';
      const endDate = item['eventenddate'] || item['endDate'] || '';
      const addr1 = item['addr1'] || item['location'] || '';
      const snapshotKey = buildSourceSnapshotKey({ title: name, startDate, endDate, addr1 });
      const normalizedName = normalizeMatchText(name);
      if (!name) return false;

      // 1순위: source_id 정확 매칭
      if (id && serviceIds.has(id)) return false;

      // 1.5순위: 제목+일정+주소 스냅샷 키 매칭
      if (snapshotKey && sourceSnapshotKeys.has(snapshotKey)) return false;

      // 1.7순위: [보조금 한정] 전화문의+유사도 — 동일 기관의 유사 서비스만 제외
      // 같은 전화번호라도 서비스명이 다르면(예: 장애인차량 vs 다자녀자동차) 허용
      if (category === '전국 보조금·복지 정책' && item['전화문의']) {
        const phone = String(item['전화문의']).trim();
        const existingServices = usedPhoneServices.get(phone);
        if (existingServices && isSimilarService(name, existingServices)) {
          return false;
        }
      }

      // 2순위: source_id 없는 기존 파일의 파일명 키워드 부분 매칭
      if (filenameKeywords.some(kw => name.includes(kw) || kw.includes(name.slice(0, 6)))) return false;

      // 3순위: 기존 제목 키워드 정규화 부분 매칭 (수동 포스트 중복 방지)
      if (normalizedName && titleKeys.some((tk) => tk.length >= 6 && (tk.includes(normalizedName.slice(0, 6)) || normalizedName.includes(tk.slice(0, 6))))) {
        return false;
      }

      return true;
    });

    console.log(`  미작성 항목: ${candidates.length}개`);

    if (category === '전국 보조금·복지 정책' && candidates.length > 0) {
      // 권역-요일 분산 필터 적용 (활성화 시)
      if (process.env.SUBSIDY_REGION_WEEKDAY_FILTER === 'true') {
        const { regions, allowNational } = getSubsidyRegionByWeekday();
        const kstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const weekdayName = ['일', '월', '화', '수', '목', '금', '토'][kstDate.getDay()];
        console.log(`  🗓️ 권역-요일 분산 활성화: ${weekdayName}요일 → ${regions.join('/')}${allowNational ? ' + 전국공통' : ''}`);
        const filtered = filterSubsidiesByRegionWeekday(candidates);
        if (filtered.length > 0 && filtered.length !== candidates.length) {
          console.log(`  필터 적용 후: ${filtered.length}건 (기존 ${candidates.length}건에서 축소)`);
          candidates = filtered;
        } else if (filtered.length === 0) {
          console.log(`  ⚠️ 해당 권역 후보 0건: 원본 ${candidates.length}건 유지`);
        } else {
          console.log(`  ✅ 권역 필터 매칭: ${candidates.length}건`);
        }
      }
      
      // 기존 서울 주간 보강 로직 (권역 필터 비활성화 시에만)
      if (process.env.SUBSIDY_REGION_WEEKDAY_FILTER !== 'true') {
        const hasRecentSeoul = await hasRecentSeoulSubsidyPost(postsDir, 7);
        if (!hasRecentSeoul) {
          const seoulCandidates = candidates.filter((item) => isSeoulSubsidyItem(item));
          if (seoulCandidates.length > 0) {
            const pinned = seoulCandidates[0];
            const pinnedId = String(pinned['서비스ID'] || pinned.id || pinned['서비스명'] || pinned.name || '');
            const rest = candidates.filter((item) => {
              const id = String(item['서비스ID'] || item.id || item['서비스명'] || item.name || '');
              return id !== pinnedId;
            });
            candidates = [pinned, ...rest];
            console.log(`  📌 서울 보조금 주간 보강 적용: "${pinned['서비스명'] || pinned.name || pinned.title || 'unknown'}" 우선 배치`);
          } else {
            console.log('  ℹ️ 서울 보조금 주간 보강 대상 없음(이번 배치 후보 내 서울 항목 없음)');
          }
        } else {
          console.log('  ✅ 최근 7일 내 서울 보조금 포스트 존재: 주간 보강 스킵');
        }
      }
    }

    const categoryTargetCount = getCategoryTargetCount(category);
    console.log(`  카테고리 목표 발행량: ${categoryTargetCount}건`);

    // 카테고리별 목표 건수만큼 생성
    let generated = 0;
    let triedCandidates = 0;
    for (const candidate of candidates) {
      const elapsedSec = Math.floor((Date.now() - runStartedAt) / 1000);
      if (elapsedSec >= BLOG_MAX_GENERATION_SECONDS) {
        console.log(`  ⏱️ 전체 생성 시간 상한 도달(${BLOG_MAX_GENERATION_SECONDS}s): 생성 루프 종료`);
        break;
      }

      if (budgetStopped) {
        console.log(`  ⛔ 예산 상한 도달: ${budgetStopReason}`);
        break;
      }

      if (geminiApiCallCount >= BLOG_MAX_API_CALLS) {
        console.log(`  ⛔ Gemini API 호출 상한 도달(${BLOG_MAX_API_CALLS}회): 생성 루프 종료`);
        break;
      }

      if (triedCandidates >= BLOG_MAX_CANDIDATES_PER_CATEGORY) {
        console.log(`  ⏱️ 카테고리 후보 시도 상한 도달(${BLOG_MAX_CANDIDATES_PER_CATEGORY}건): 다음 카테고리로 이동`);
        break;
      }

      if (generated >= categoryTargetCount) break;
      triedCandidates++;
      try {
        const ok = await generatePost({ ...candidate, _category: category }, postsDir);
        if (ok) {
          generated++;
          totalGenerated++;
          if (generated < 2) {
            console.log('  ⏳ 5초 대기 중...');
            await sleep(5000);
          }
        }
      } catch (err) {
        if (String(err?.message || '').startsWith('BLOG_BUDGET_STOP:')) {
          budgetStopped = true;
          budgetStopReason = String(err.message).replace(/^BLOG_BUDGET_STOP:/, '').trim();
          console.log(`  ⛔ 예산 상한 도달: ${budgetStopReason}`);
          break;
        }
        console.error(`  생성 오류: ${err.message}`);
      }
    }

    if (generated === 0) {
      console.log(`  ⚠️ 생성할 새 항목 없음`);
    }
  }

  console.log(`\n🎉 총 ${totalGenerated}편 생성 완료`);
  console.log(`📊 Gemini API 호출 횟수: ${geminiApiCallCount}회`);
  console.log(`🖼️ 축제 중간 이미지: 삽입 ${midImageInsertedCount}건 / 생략 ${midImageOmittedCount}건`);
  if (budgetEnabled) {
    console.log(`💰 Gemini 추정 비용: ${estimatedCostKrw.toFixed(2)}원 / ${BLOG_DAILY_BUDGET_KRW}원`);
  }

  publishBudgetOutputs();
}

run();
