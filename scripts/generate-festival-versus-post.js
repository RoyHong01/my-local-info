const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);

const FORCE_RUN = process.env.FESTIVAL_VERSUS_FORCE === 'true';
const FORCED_MODE = String(process.env.FESTIVAL_VERSUS_MODE || 'weekend').trim().toLowerCase();
const ENABLE_FRIDAY = process.env.FESTIVAL_VERSUS_ENABLE_FRIDAY !== 'false';
const ENABLE_HOLIDAY_EVE = process.env.FESTIVAL_VERSUS_ENABLE_HOLIDAY_EVE !== 'false';
const HOLIDAY_MIN_STREAK = Number(process.env.FESTIVAL_VERSUS_HOLIDAY_MIN_STREAK || 2);

const WEEKEND_PICK_COUNT = Math.max(2, Number(process.env.FESTIVAL_VERSUS_WEEKEND_COUNT || 2));
const HOLIDAY_PICK_COUNT = Math.max(2, Math.min(3, Number(process.env.FESTIVAL_VERSUS_HOLIDAY_COUNT || 3)));

const BLOG_PUBLISHED_BY = String(process.env.BLOG_PUBLISHED_BY || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
const DEFAULT_IMAGE = 'https://pick-n-joy.com/images/default-festival.svg';

function toKstDate(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDayOfWeekKst(isoDate) {
  const d = new Date(`${isoDate}T00:00:00+09:00`);
  return d.getDay();
}

function isoToCompact(isoDate) {
  return String(isoDate || '').replace(/-/g, '');
}

function normalizeDateToIso(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return text.replace(/\./g, '-');
  return '';
}

function normalizeMatchText(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

async function fetchPublicHolidays(year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((row) => String(row.date || '').trim()).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function buildHolidaySet(todayIso) {
  const year = Number(todayIso.slice(0, 4));
  const [y1, y2] = await Promise.all([
    fetchPublicHolidays(year),
    fetchPublicHolidays(year + 1),
  ]);

  const merged = new Set([...y1, ...y2]);
  return merged;
}

function isNonWorkingDay(isoDate, holidaySet) {
  const day = getDayOfWeekKst(isoDate);
  const weekend = day === 0 || day === 6;
  const holiday = holidaySet.has(isoDate);
  return weekend || holiday;
}

function getNonWorkingStreakFrom(startIso, holidaySet, maxDays = 7) {
  let streak = 0;
  for (let i = 0; i < maxDays; i += 1) {
    const day = addDays(startIso, i);
    if (!isNonWorkingDay(day, holidaySet)) break;
    streak += 1;
  }
  return streak;
}

function decideRunMode(todayIso, holidaySet) {
  if (FORCE_RUN) {
    if (FORCED_MODE === 'holiday') return 'holiday';
    return 'weekend';
  }

  const day = getDayOfWeekKst(todayIso);
  if (ENABLE_FRIDAY && day === 5) return 'weekend';

  if (ENABLE_HOLIDAY_EVE) {
    const tomorrow = addDays(todayIso, 1);
    const tomorrowIsNonWorking = isNonWorkingDay(tomorrow, holidaySet);
    if (tomorrowIsNonWorking) {
      const streak = getNonWorkingStreakFrom(tomorrow, holidaySet, 7);
      if (streak >= HOLIDAY_MIN_STREAK) {
        return 'holiday';
      }
    }
  }

  return 'skip';
}

function chooseFestivals(items, todayIso, count) {
  const todayCompact = isoToCompact(todayIso);

  const active = items
    .filter((item) => !item.expired)
    .filter((item) => {
      const endIso = normalizeDateToIso(item.eventenddate || item.endDate);
      if (!endIso) return true;
      return isoToCompact(endIso) >= todayCompact;
    })
    .map((item) => {
      const startIso = normalizeDateToIso(item.eventstartdate || item.startDate);
      const endIso = normalizeDateToIso(item.eventenddate || item.endDate);
      const views = Number(String(item['조회수'] ?? item.viewCount ?? item.hit ?? 0).replace(/,/g, '')) || 0;
      const hasImage = item.firstimage || item.firstimage2 ? 1 : 0;

      let distanceScore = 9999;
      if (startIso) {
        const diff = Math.abs(new Date(`${startIso}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime());
        distanceScore = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      return {
        ...item,
        _startIso: startIso,
        _endIso: endIso,
        _views: views,
        _hasImage: hasImage,
        _distanceScore: distanceScore,
      };
    })
    .sort((a, b) => {
      if (a._distanceScore !== b._distanceScore) return a._distanceScore - b._distanceScore;
      if (a._hasImage !== b._hasImage) return b._hasImage - a._hasImage;
      if (a._views !== b._views) return b._views - a._views;
      return String(b.modifiedtime || b.updatedAt || '').localeCompare(String(a.modifiedtime || a.updatedAt || ''));
    });

  const picked = [];
  const seenRegion = new Set();

  for (const item of active) {
    const region = String(item.lDongRegnCd || item.areacode || '').trim();
    if (region && seenRegion.has(region) && active.length > count + 2) {
      continue;
    }
    picked.push(item);
    if (region) seenRegion.add(region);
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    for (const item of active) {
      if (picked.includes(item)) continue;
      picked.push(item);
      if (picked.length >= count) break;
    }
  }

  return picked.slice(0, count);
}

function buildVersusPrompt({ mode, todayIso, candidates }) {
  const targetLabel = mode === 'holiday' ? '이번 연휴' : '이번 주말';
  const festivalCount = candidates.length;
  const compareLabel = festivalCount >= 3 ? 'A vs B vs C' : 'A vs B';
  const sourceJson = JSON.stringify(candidates.map((item, index) => ({
    slot: index === 0 ? 'A' : index === 1 ? 'B' : 'C',
    contentid: item.contentid,
    title: item.title,
    eventstartdate: item.eventstartdate,
    eventenddate: item.eventenddate,
    addr1: item.addr1,
    tel: item.tel,
    overview: item.overview,
    firstimage: item.firstimage || item.firstimage2 || '',
  })), null, 2);

  return `아래 축제 데이터를 기준으로 비교형 블로그 글을 작성해줘.

기준 시점(KST): ${todayIso}
모드: ${mode}
비교 제목 키워드: ${targetLabel}, ${compareLabel}

후보 데이터:
${sourceJson}

출력 형식은 반드시 아래 마크다운 구조만 사용:
---
title: "${targetLabel}에는 A vs B${festivalCount >= 3 ? ' vs C' : ''}, 어디가 더 맞을까요?"
date: ${todayIso}
summary: (130~160자, 비교 기준과 대상 독자를 명확히)
description: (summary와 동일)
category: 전국 축제·여행
published_by: ${BLOG_PUBLISHED_BY}
tags: [전국 축제·여행, 비교 분석, ${targetLabel}, A vs B]
image: "${DEFAULT_IMAGE}"
content_type: festival-versus
versus_mode: ${mode}
---

## ${targetLabel}, 어디가 더 잘 맞을까요?
(독자의 선택 상황을 2~3문장으로 제시)

### 한눈에 비교: 3가지 기준
(분위기 / 이동·접근성 / 예산·체류시간 기준으로 A,B${festivalCount >= 3 ? ',C' : ''}를 비교)

### A가 맞는 사람
(구체적 상황형 추천)

### B가 맞는 사람
(구체적 상황형 추천)
${festivalCount >= 3 ? '\n### C가 맞는 사람\n(구체적 상황형 추천)\n' : ''}
### 최종 선택 가이드
(오늘 일정/동행/예산 기준 의사결정 문장)

### 바로 이동 링크
- [A 제목](/festival/A contentid)
- [B 제목](/festival/B contentid)
${festivalCount >= 3 ? '- [C 제목](/festival/C contentid)' : ''}

규칙:
- 본문에서 후보 축제명은 제공된 데이터 기준으로만 사용, 다른 행사명 혼입 금지.
- 사실로 확인되지 않은 정보 단정 금지.
- 문체는 경어체(~해요/~입니다).
- 마지막 줄에 FILENAME: YYYY-MM-DD-festival-versus-... 형식으로 출력.`;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API 오류: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function splitMarkdownSections(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized.startsWith('---\n')) return { frontmatter: '', body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: '', body: normalized };
  return {
    frontmatter: normalized.slice(0, end + 5),
    body: normalized.slice(end + 5).trim(),
  };
}

function extractFrontmatterValue(content, key) {
  const m = String(content || '').match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

async function getExistingVersusKeys(postsDir) {
  const keys = new Set();
  const files = await fs.readdir(postsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
    const contentType = extractFrontmatterValue(content, 'content_type');
    if (contentType !== 'festival-versus') continue;

    const versusKey = extractFrontmatterValue(content, 'versus_key');
    if (versusKey) keys.add(versusKey);
  }

  return keys;
}

function buildVersusKey(mode, ids) {
  const sorted = [...ids].map((v) => String(v || '').trim()).filter(Boolean).sort();
  return `${mode}|${sorted.join(',')}`;
}

function removeCodeFence(text) {
  let output = String(text || '').trim();
  if (output.startsWith('```markdown')) output = output.slice(11).trim();
  else if (output.startsWith('```')) output = output.slice(3).trim();
  if (output.endsWith('```')) output = output.slice(0, -3).trim();
  return output;
}

function ensureVersusLinks(body, candidates) {
  const normalizedBody = String(body || '');
  const hasLinkSection = /###\s+바로\s*이동\s*링크/m.test(normalizedBody);
  if (hasLinkSection) return normalizedBody;

  const lines = candidates.map((item, idx) => {
    const slot = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
    const title = item.title || `후보 ${slot}`;
    const id = item.contentid || '';
    return `- [${title}](/festival/${id})`;
  });

  return `${normalizedBody.trim()}\n\n### 바로 이동 링크\n${lines.join('\n')}`.trim();
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY 미설정: festival-versus 생성 건너뜀');
    return;
  }

  const todayIso = toKstDate();
  const holidaySet = await buildHolidaySet(todayIso);
  const mode = decideRunMode(todayIso, holidaySet);

  console.log(`festival-versus mode=${mode} (today=${todayIso})`);

  if (mode === 'skip') {
    console.log('금요일/연휴 전 조건 미충족: 생성 건너뜀');
    return;
  }

  const festivalPath = path.join(process.cwd(), 'public', 'data', 'festival.json');
  const raw = await fs.readFile(festivalPath, 'utf-8');
  const festivals = JSON.parse(raw);

  const pickCount = mode === 'holiday' ? HOLIDAY_PICK_COUNT : WEEKEND_PICK_COUNT;
  const candidates = chooseFestivals(festivals, todayIso, pickCount);

  if (candidates.length < 2) {
    console.log(`비교형 생성 후보 부족: ${candidates.length}건`);
    return;
  }

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  const sourceIds = candidates.map((item) => String(item.contentid || '').trim()).filter(Boolean);
  const versusKey = buildVersusKey(mode, sourceIds);
  const existingKeys = await getExistingVersusKeys(postsDir);

  if (existingKeys.has(versusKey)) {
    console.log(`동일 후보 조합의 festival-versus 이미 존재: ${versusKey}`);
    return;
  }

  const prompt = buildVersusPrompt({ mode, todayIso, candidates });
  const generated = await callGemini(prompt);
  const cleaned = removeCodeFence(generated);

  if (!cleaned.includes('---') || !cleaned.includes('FILENAME:')) {
    throw new Error('festival-versus 생성 결과 형식이 올바르지 않습니다.');
  }

  const lines = cleaned.split('\n');
  let filename = '';
  const contentLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  if (!filename) {
    const modeLabel = mode === 'holiday' ? 'holiday' : 'weekend';
    const keyShort = slugify(candidates.map((item) => item.title || '').join('-')).slice(0, 40) || 'compare';
    filename = `${todayIso}-festival-versus-${modeLabel}-${keyShort}.md`;
  }
  if (!filename.endsWith('.md')) filename += '.md';

  let finalContent = contentLines.join('\n').trim();
  const { frontmatter, body } = splitMarkdownSections(finalContent);
  if (!frontmatter) {
    throw new Error('festival-versus frontmatter 파싱 실패');
  }

  const bodyWithLinks = ensureVersusLinks(body, candidates);

  const frontmatterWithMeta = frontmatter
    .replace(/^published_by:.*$/m, `published_by: ${BLOG_PUBLISHED_BY}`)
    .replace(/^image:.*$/m, `image: "${DEFAULT_IMAGE}"`)
    .replace(/^content_type:.*$/m, 'content_type: festival-versus')
    .replace(/^versus_mode:.*$/m, `versus_mode: ${mode}`);

  const extraMeta = [
    `versus_key: "${versusKey}"`,
    `source_ids: "${sourceIds.join(',')}"`,
  ].join('\n');

  let normalizedFrontmatter = frontmatterWithMeta;
  if (!/^versus_key:/m.test(normalizedFrontmatter)) {
    normalizedFrontmatter = normalizedFrontmatter.replace(/\n---\n$/, `\n${extraMeta}\n---\n`);
  }

  finalContent = `${normalizedFrontmatter}\n\n${bodyWithLinks}`.replace(/\n{3,}/g, '\n\n').trim();

  const outputPath = path.join(postsDir, filename);
  await fs.writeFile(outputPath, finalContent, 'utf-8');

  console.log(`✅ festival-versus 생성 완료: ${filename}`);
  console.log(`   mode=${mode} / candidates=${candidates.map((item) => item.title).join(' | ')}`);
}

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
