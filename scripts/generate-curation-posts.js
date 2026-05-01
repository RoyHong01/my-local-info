/**
 * generate-curation-posts.js
 *
 * Phase 2 — "큐레이션" 카테고리 블로그 포스트 자동 생성
 * TOP-N 항목 집계형 포스트 (예: 이번 주 마감 임박 보조금 TOP 5, 5월 축제 베스트 7 등)
 *
 * Env vars:
 *   GEMINI_API_KEY            (required)
 *   CURATION_COUNT            Number of posts to generate (default 1)
 *   CURATION_TOPIC            Force topic: subsidy|festival|incheon|auto (default auto)
 *   CURATION_TOP_N            Number of items to include per post (default 5)
 *   ALLOW_EXISTING_OVERWRITE  true = overwrite today's post if exists
 *   GEMINI_MODEL              (default gemini-2.5-flash-lite)
 *   ALLOW_GEMINI_PRO          true = allow pro model
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const ALLOW_GEMINI_PRO = process.env.ALLOW_GEMINI_PRO === 'true';
if (/\bpro\b/i.test(GEMINI_MODEL) && !ALLOW_GEMINI_PRO) {
  throw new Error(`안전장치: Pro 모델(${GEMINI_MODEL})은 차단됩니다. ALLOW_GEMINI_PRO=true를 명시하세요.`);
}

const CURATION_COUNT = Math.max(1, Number(process.env.CURATION_COUNT || 1));
const CURATION_TOPIC = (process.env.CURATION_TOPIC || 'auto').toLowerCase();
const CURATION_TOP_N = Math.max(3, Math.min(10, Number(process.env.CURATION_TOP_N || 5)));
const ALLOW_EXISTING_OVERWRITE = process.env.ALLOW_EXISTING_OVERWRITE === 'true';
const GEMINI_TIMEOUT_MS = 120000;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY가 없습니다.');
  process.exit(1);
}

function setGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  try {
    const safe = String(value ?? '').replace(/\r?\n/g, ' ');
    fsSync.appendFileSync(outputPath, `${key}=${safe}\n`);
  } catch { /* ignore */ }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// KST 기준 오늘 날짜 (YYYY-MM-DD)
function getKstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString().split('T')[0];
}

function getKstNow() {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

// YYYYMMDD → YYYY-MM-DD
function normDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(s)) return s.replace(/\./g, '-');
  return '';
}

// 요일 기반 오늘 토픽 결정 (0=Sun)
function getAutoTopic(kstNow) {
  const dayTopics = ['incheon', 'subsidy', 'festival', 'subsidy', 'festival', 'incheon', 'subsidy'];
  return dayTopics[kstNow.getDay()];
}

async function readJson(filename) {
  const filePath = path.join(process.cwd(), 'public', 'data', filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function getField(item, keys) {
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') return item[key];
  }
  return '';
}

// 상세 페이지 URL path 생성
function getDetailPath(category, item) {
  if (category === 'subsidy') {
    const id = getField(item, ['서비스ID', 'id']);
    return id ? `/subsidy/${encodeURIComponent(id)}` : null;
  }
  if (category === 'incheon') {
    const id = getField(item, ['서비스ID', 'id']);
    return id ? `/incheon/${encodeURIComponent(id)}` : null;
  }
  if (category === 'festival') {
    const id = getField(item, ['contentid', 'id']);
    return id ? `/festival/${encodeURIComponent(id)}` : null;
  }
  return null;
}

// 항목 마감일 추출
function getDeadline(item, category) {
  if (category === 'subsidy' || category === 'incheon') {
    return normDate(item['신청기한'] || item['신청기간'] || item.endDate || '');
  }
  if (category === 'festival') {
    return normDate(item.eventenddate || item.endDate || '');
  }
  return '';
}

function getStartDate(item) {
  return normDate(item.eventstartdate || item.startDate || '');
}

// 마감 임박순 정렬 (오늘 이후 + 가까운 순)
function sortItems(items, category, todayISO) {
  const getScore = (item) => {
    const dl = getDeadline(item, category);
    if (!dl) return 9999;
    if (dl < todayISO) return 8888; // 이미 지난 항목은 후순위
    const diff = Math.ceil((new Date(dl) - new Date(todayISO)) / 86400000);
    return diff;
  };

  return [...items]
    .filter(item => !item.expired)
    .filter(item => {
      const dl = getDeadline(item, category);
      if (category === 'festival') {
        // 축제: 종료 7일 이내 제외
        if (!dl) return true;
        const diff = Math.ceil((new Date(dl) - new Date(todayISO)) / 86400000);
        return diff >= 7;
      }
      // 보조금/인천: 만료 항목 제외
      if (dl && dl < todayISO) return false;
      return true;
    })
    .sort((a, b) => getScore(a) - getScore(b));
}

// 항목 요약 텍스트 (프롬프트용)
function summarizeItem(item, category, index) {
  const name = getField(item, ['서비스명', 'title', 'name']);
  const desc = getField(item, ['서비스목적요약', 'overview', 'summary', 'description']);
  const deadline = getDeadline(item, category);
  const startDate = getStartDate(item);
  const location = getField(item, ['addr1', 'location', '접수기관명', '소관기관명']);
  const path = getDetailPath(category, item);
  const siteUrl = `https://pick-n-joy.com${path}`;

  let summary = `${index + 1}. **${name}**`;
  if (category === 'festival') {
    if (startDate) summary += ` (${startDate.replace(/-/g, '.')} 시작)`;
    if (location) summary += ` — ${location}`;
  } else {
    if (deadline) summary += ` (마감 ${deadline.replace(/-/g, '.')})`;
    if (location) summary += ` — ${location}`;
  }
  if (desc) summary += `\n   ${desc.slice(0, 100)}`;
  summary += `\n   → 자세히 보기: ${siteUrl}`;
  return summary;
}

// 날짜 기반 결정론적 인덱스 (매일 다르게, 같은 날 재실행 시 동일)
function dateSeed(dateISO, pool) {
  const day = Number(String(dateISO).replace(/-/g, ''));
  return day % pool.length;
}

// 글쓰기 앵글 결정 (날짜 기반 4가지 순환)
function getWritingAngle(dateISO) {
  const angles = ['empathy', 'discovery', 'seasonal', 'editorial'];
  return angles[dateSeed(dateISO, angles)];
}

// 포스트 제목 생성 (카테고리 + 날짜 시드 기반 다양한 패턴)
function generateTitle(category, items, todayISO) {
  const now = getKstNow();
  const month = now.getMonth() + 1;
  const n = items.length;

  if (category === 'subsidy') {
    const hasUrgent = items.some(item => {
      const dl = getDeadline(item, 'subsidy');
      if (!dl) return false;
      const diff = Math.ceil((new Date(dl) - new Date(todayISO)) / 86400000);
      return diff <= 14;
    });
    const urgentPatterns = [
      `마감 코앞! 이번 주 놓치면 후회하는 보조금 ${n}가지`,
      `지금 당장 신청해야 할 보조금·지원금 ${n}선`,
      `오늘 확인 안 하면 늦는 복지 혜택 에디터 픽 ${n}`,
      `마감 임박 — 서둘러야 할 복지 지원 ${n}가지`,
      `이번 달 기한 끝나는 보조금, 에디터가 직접 골랐어요 ${n}선`,
    ];
    const normalPatterns = [
      `${month}월 꼭 챙겨야 할 보조금·복지 정책 ${n}가지`,
      `에디터가 직접 고른 ${month}월 복지 혜택 ${n}선`,
      `지금 신청하면 딱 좋은 보조금 ${n}가지 — ${month}월 편`,
      `${month}월에 이것만큼은 알고 계세요 — 복지 지원 ${n}선`,
      `픽앤조이 에디터 픽: ${month}월 보조금·지원 정책 ${n}가지`,
      `신청 기간 놓치기 아까운 ${month}월 복지 정책 ${n}가지`,
      `${month}월 보조금, 에디터가 추린 ${n}가지만 보세요`,
    ];
    const pool = hasUrgent ? urgentPatterns : normalPatterns;
    return pool[dateSeed(todayISO, pool)];
  }

  if (category === 'festival') {
    const patterns = [
      `${month}월 이 축제는 진짜 가봐야 해요 — 에디터 픽 ${n}선`,
      `주말 나들이 딱 좋은 ${month}월 전국 축제 ${n}가지`,
      `에디터가 직접 추린 ${month}월 축제·여행 추천 ${n}선`,
      `가족·커플 모두 OK — ${month}월 전국 축제 베스트 ${n}`,
      `이번 달 어디 갈지 고르세요 — ${month}월 축제 에디터 큐레이션`,
      `${month}월 풍경 속으로 — 전국 축제 여행 추천 ${n}곳`,
      `${month}월 기억에 남을 여행, 이 축제들로 채워보세요`,
    ];
    return patterns[dateSeed(todayISO, patterns)];
  }

  if (category === 'incheon') {
    const patterns = [
      `인천 사람이라면 놓치지 마세요 — ${month}월 혜택 ${n}가지`,
      `${month}월 인천 생활 꿀팁 — 에디터가 고른 지원 ${n}선`,
      `인천 시민이라면 지금 바로 확인해야 할 혜택 ${n}가지`,
      `에디터 픽: ${month}월 인천에서 챙길 수 있는 혜택 ${n}선`,
      `인천 살면서 이것만큼은 알아야 해요 — ${month}월 편`,
      `${month}월 인천 지역 혜택 총정리, 이것만 보세요`,
      `인천 ${month}월 — 생활비 아껴주는 지원 정책 ${n}가지`,
    ];
    return patterns[dateSeed(todayISO, patterns)];
  }

  return `픽앤조이 에디터 픽 — 이번 주 놓치면 아쉬운 정보 ${n}선`;
}

// Gemini 호출
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topP: 0.92,
          maxOutputTokens: 4096,
        },
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Gemini API 타임아웃: ${GEMINI_TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

// 큐레이션 포스트 프롬프트 생성
function buildPrompt(category, title, itemSummaries, todayISO) {
  const categoryLabel = category === 'subsidy' ? '보조금·복지 정책'
    : category === 'festival' ? '전국 축제·여행'
    : '인천 지역 혜택';

  const angle = getWritingAngle(todayISO);
  const angleGuide = {
    empathy: `[글쓰기 앵글: 공감형]
서론에서 독자의 일상 속 놓쳤던 경험이나 아쉬웠던 순간을 먼저 공감해 주세요. 에디터 본인 경험을 살짝 섞어도 좋아요. (예: "저도 작년에 이거 모르고 지나쳤거든요")`,
    discovery: `[글쓰기 앵글: 발견형]
서론에서 "생각보다 많은 분들이 모르고 지나치는 정보예요"처럼 독자가 새로운 걸 발견한 기분이 들도록 시작해 주세요. 에디터가 직접 찾아낸 것처럼 써주세요.`,
    seasonal: `[글쓰기 앵글: 시즌형]
서론에서 지금 이 시기(계절, 월)에 특히 유용한 이유를 먼저 짚어 주세요. "5월이라서", "이맘때면" 같은 시간적 맥락을 활용해 주세요.`,
    editorial: `[글쓰기 앵글: 에디터 큐레이션형]
서론에서 픽앤조이 에디터가 직접 고른 이유를 밝혀 주세요. "수백 개 중에서 이것만 남겼어요", "직접 확인해보니" 같은 신뢰감 있는 목소리로 시작해 주세요.`,
  }[angle];

  return `당신은 픽앤조이(pick-n-joy.com)의 30대 생활정보 에디터입니다. 독자에게 친절하고 솔직하게, 실제 사람이 쓴 것처럼 자연스럽게 글을 작성합니다.
아래 ${categoryLabel} 항목들을 바탕으로 블로그 포스트를 작성하세요.

[오늘 날짜] ${todayISO}
[포스트 제목] ${title}
[포함 항목 수] ${itemSummaries.length}개

${angleGuide}

[항목 데이터]
${itemSummaries.join('\n\n')}

[작성 규칙]
1. 종결어미는 경어체 (~해요/~거든요/~입니다/~더라고요). 평어체(~이다/~한다) 절대 금지.
2. 서론 2~3문단: 위 글쓰기 앵글을 반드시 적용하세요. "TOP N", 번호 나열 같은 기계적 표현 금지.
3. 본문 시작에 제목(`# ...`)을 다시 쓰지 마세요. 제목은 frontmatter/Hero에서 이미 노출되므로, 본문은 서론 문단으로 시작하세요.
4. 에디터 개인 의견이나 소감을 최소 1곳에 자연스럽게 녹여 주세요. (예: "솔직히 이건 저도 챙겨놨어요")
5. 각 항목 소제목은 단순 정보 라벨(예: "1. 보조금명") 금지. 독자가 읽고 싶어지는 매거진형 문장으로 작성하세요.
6. 각 항목 설명은 3~5문장: 혜택 금액, 지원 대상, 신청 방법, 신청 기한 포함. 딱딱하지 않게.
7. 각 항목 설명 뒤에 링크([자세히 보기](URL))를 그대로 유지하세요.
8. 마무리: 독자가 행동하고 싶어지는 자연스러운 1~2문장.
9. 이미지 마크다운 삽입 금지. 구분선(---, ***, ___) 절대 금지.
10. AI 티 나는 표현 절대 금지: 결론적으로/다양한/인상적인/포착한/정답/한마디로/종합하면/요약하면

[출력 형식]
- 마크다운 본문만 출력 (frontmatter 없이)
- 서론 → 항목별 섹션 → 마무리 순서
- 총 900~1400자 내외

지금 바로 작성해 주세요.`;
}

// 파일명 슬러그 생성
function makeSlug(title, date) {
  const clean = title
    .replace(/TOP\s*\d+/gi, '')
    .replace(/[^\uAC00-\uD7A3\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${date}-curation-${clean}`;
}

function normalizeHeadingText(text) {
  return String(text || '')
    .replace(/["'`]/g, '')
    .replace(/[·•]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function stripLeadingDuplicateTitleHeading(markdown, title) {
  if (!markdown) return markdown;

  const lines = String(markdown).split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  const first = lines[i] || '';
  const m = first.match(/^#{1,3}\s+(.+)$/);
  if (!m) return markdown;

  const headingText = normalizeHeadingText(m[1]);
  const titleText = normalizeHeadingText(title);
  if (!headingText || !titleText || headingText !== titleText) return markdown;

  lines.splice(i, 1);
  while (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
  return lines.join('\n').trim();
}

// frontmatter 생성
function buildFrontmatter({ title, date, slug, category, description }) {
  const escaped = (s) => `"${String(s || '').replace(/"/g, "'")}"`;
  return [
    '---',
    `title: ${escaped(title)}`,
    `date: "${date}"`,
    `category: "큐레이션"`,
    `tags: ["큐레이션", "${category === 'subsidy' ? '보조금' : category === 'festival' ? '축제' : '인천'}"]`,
    `description: ${escaped(description)}`,
    `summary: ${escaped(description)}`,
    `image: ""`,
    `published_by: "auto"`,
    '---',
  ].join('\n');
}

async function generateCurationPost(category, todayISO, postsDir, existingSlugs) {
  const fileMap = { subsidy: 'subsidy.json', festival: 'festival.json', incheon: 'incheon.json' };
  const file = fileMap[category];
  if (!file) throw new Error(`알 수 없는 카테고리: ${category}`);

  const all = await readJson(file);
  const sorted = sortItems(all, category, todayISO);
  const topItems = sorted.slice(0, CURATION_TOP_N);

  if (topItems.length === 0) {
    console.log(`  ⚠️ ${category}: 유효 항목 없음, 건너뜀`);
    return false;
  }

  const title = generateTitle(category, topItems, todayISO);

  // 오늘 동일 카테고리 큐레이션 포스트 중복 체크
  if (!ALLOW_EXISTING_OVERWRITE) {
    const todayPrefix = `${todayISO}-curation-`;
    const alreadyExists = existingSlugs.some(s => s.startsWith(todayPrefix) && s.includes(category === 'subsidy' ? '보조금' : category === 'festival' ? '축제' : '인천'));
    if (alreadyExists) {
      console.log(`  ⏭️ ${category}: 오늘 큐레이션 포스트 이미 있음, 건너뜀`);
      return false;
    }
  }

  const itemSummaries = topItems.map((item, i) => summarizeItem(item, category, i));
  const prompt = buildPrompt(category, title, itemSummaries, todayISO);

  console.log(`  🤖 Gemini 호출 중: "${title}"`);
  let body;
  try {
    body = await callGemini(prompt);
  } catch (err) {
    console.error(`  ❌ Gemini 오류: ${err.message}`);
    return false;
  }

  if (!body || body.length < 200) {
    console.error(`  ❌ 본문이 너무 짧음 (${body?.length || 0}자), 건너뜀`);
    return false;
  }

  // frontmatter가 생성 결과에 포함됐으면 제거
  body = body.replace(/^---[\s\S]*?---\n?/, '').trim();
  body = stripLeadingDuplicateTitleHeading(body, title);

  const description = topItems
    .slice(0, 3)
    .map(item => getField(item, ['서비스명', 'title', 'name']))
    .filter(Boolean)
    .join(', ') + ` 등 ${topItems.length}가지`;

  const slug = makeSlug(title, todayISO);
  const frontmatter = buildFrontmatter({ title, date: todayISO, slug, category, description });
  const fullContent = `${frontmatter}\n\n${body}\n`;

  const filename = `${slug}.md`;
  const filepath = path.join(postsDir, filename);

  await fs.writeFile(filepath, fullContent, 'utf-8');
  console.log(`  ✅ 저장: ${filename}`);
  return true;
}

async function run() {
  const todayISO = getKstToday();
  const kstNow = getKstNow();
  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');

  console.log(`\n🗓️ 큐레이션 포스트 생성 시작 (KST: ${todayISO})`);
  console.log(`📦 모델: ${GEMINI_MODEL}, 목표 ${CURATION_COUNT}편, 항목 수 TOP ${CURATION_TOP_N}`);

  // 기존 포스트 슬러그 목록
  let existingSlugs = [];
  try {
    const files = await fs.readdir(postsDir);
    existingSlugs = files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  } catch {
    await fs.mkdir(postsDir, { recursive: true });
  }

  // 오늘 이미 생성된 큐레이션 포스트 수 확인
  const todayCurationCount = existingSlugs.filter(s => s.startsWith(`${todayISO}-curation-`)).length;
  if (!ALLOW_EXISTING_OVERWRITE && todayCurationCount >= CURATION_COUNT) {
    console.log(`  ⏭️ 오늘 이미 ${todayCurationCount}편의 큐레이션 포스트가 있습니다. 건너뜁니다.`);
    setGithubOutput('curation_generated', 0);
    setGithubOutput('curation_skipped', todayCurationCount);
    return;
  }

  // 토픽 결정
  const topicSequence = CURATION_TOPIC === 'auto'
    ? (() => {
        // 매일 다른 토픽: 요일 기반
        const base = getAutoTopic(kstNow);
        const all = ['subsidy', 'festival', 'incheon'];
        // CURATION_COUNT > 1이면 중복 없이 순환
        const result = [];
        for (let i = 0; i < CURATION_COUNT; i++) {
          result.push(all[(all.indexOf(base) + i) % all.length]);
        }
        return result;
      })()
    : Array(CURATION_COUNT).fill(CURATION_TOPIC);

  let generated = 0;
  for (let i = 0; i < CURATION_COUNT; i++) {
    if (generated >= CURATION_COUNT) break;
    const topic = topicSequence[i] || 'subsidy';
    console.log(`\n[${i + 1}/${CURATION_COUNT}] 토픽: ${topic}`);

    try {
      const ok = await generateCurationPost(topic, todayISO, postsDir, existingSlugs);
      if (ok) {
        generated++;
        existingSlugs.push(`${todayISO}-curation-`); // 중복 방지용 임시 마킹
        if (i < CURATION_COUNT - 1) {
          console.log('  ⏳ 5초 대기...');
          await sleep(5000);
        }
      }
    } catch (err) {
      console.error(`  ❌ 오류: ${err.message}`);
    }
  }

  console.log(`\n🎉 큐레이션 포스트 생성 완료: ${generated}편`);
  setGithubOutput('curation_generated', generated);
  setGithubOutput('curation_skipped', todayCurationCount);
}

run().catch(err => {
  console.error('큐레이션 생성 실패:', err);
  process.exit(1);
});
