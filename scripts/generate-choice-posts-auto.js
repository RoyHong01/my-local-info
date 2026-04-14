/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const runFile = promisify(execFile);
const DAILY_THEMES_PATH = path.join(process.cwd(), 'scripts', 'data', 'choice-daily-themes.json');
const BACKUP_THEME_KEYWORDS = {
  health: ['health supplement', 'daily vitamin', 'probiotic supplement', 'omega 3 supplement'],
  living: ['household item', 'cleaning tool', 'storage organizer', 'bathroom supplies'],
  kitchen: ['kitchenware', 'food storage', 'cooking utensil', 'meal prep container'],
  digital: ['digital accessories', 'portable charger', 'desk accessory', 'mobile accessories'],
  'pet-life': ['pet supplies', 'cat supplies', 'dog supplies', 'pet grooming'],
  'beauty-fashion': ['beauty', 'skin care', 'hair care', 'fashion accessories'],
  'home-appliance-furniture': ['home appliance', 'furniture', 'interior lighting', 'home living'],
};

function getTodayKstDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getKstWeekdayNumber() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCDay();
}

async function loadDailyThemes() {
  const raw = await fs.readFile(DAILY_THEMES_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('choice-daily-themes.json에 유효한 요일별 테마가 없습니다.');
  }
  return parsed;
}

function getDailyTheme(themes) {
  const explicit = Number(process.env.CHOICE_AUTO_THEME_DAY || Number.NaN);
  const weekday = Number.isInteger(explicit) && explicit >= 0 && explicit <= 6
    ? explicit
    : getKstWeekdayNumber();

  const theme = themes.find((item) => Number(item?.weekday) === weekday);
  if (!theme) {
    throw new Error(`요일(${weekday})에 매핑된 초이스 테마가 없습니다.`);
  }

  return { weekday, theme };
}

async function buildTempInput(themeInfo, dateKst) {
  const { theme, weekday } = themeInfo;
  const englishName = slugify(`${theme.key}-${dateKst}`);
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekdayKo = weekdayNames[weekday] || '요일';
  const payload = {
    title: `${weekdayKo}요일 픽앤조이 초이스 | ${theme.name} 카테고리 실시간 인기 상품 큐레이션`,
    englishName,
    summary: `${theme.name} 테마에서 쿠팡 판매량 상위권 상품 중 중복 필터와 품질 필터를 통과한 신규 아이템 3개를 엄선한 픽앤조이 초이스입니다.`,
    brand: '픽앤조이 초이스',
    rating: '4.7',
    reviewCount: '100',
    keywordHint: theme.searchKeywordHint || theme.keywordHint || [],
    fallbackKeywordHint: theme.fallbackKeywordHint || [],
    tags: Array.isArray(theme.tags) ? [...theme.tags, '쿠팡', '리뷰'] : ['쿠팡', '리뷰', '픽앤조이초이스'],
    themeKey: theme.key,
    themeName: theme.name,
    backupKeywordHint: theme.backupKeywordHint || [],
    publishedBy: 'auto',
    outputFileName: `${dateKst}-choice-${englishName}.md`,
  };

  const tempPath = path.join(os.tmpdir(), `picknjoy-choice-auto-${Date.now()}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  return { tempPath, payload };
}

function mergeKeywordHints(baseHints, extraHints) {
  const merged = [...(baseHints || []), ...(extraHints || [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(merged));
}

async function runChoiceGenerator(payload, contextLabel = 'primary') {
  const tempPath = path.join(os.tmpdir(), `picknjoy-choice-auto-${contextLabel}-${Date.now()}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-choice-post.js');
    const { stdout, stderr } = await runFile(process.execPath, [scriptPath, '--input', tempPath], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function run() {
  const enabled = (process.env.CHOICE_AUTO_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('CHOICE_AUTO_ENABLED=false 이므로 자동 초이스 생성을 건너뜁니다.');
    return;
  }

  const dateKst = getTodayKstDate();
  const themes = await loadDailyThemes();
  const themeInfo = getDailyTheme(themes);
  const { payload } = await buildTempInput(themeInfo, dateKst);

  console.log(`자동 초이스 요일 테마: ${themeInfo.theme.name} (${themeInfo.theme.key})`);
  console.log(`자동 키워드: ${(payload.keywordHint || []).join(', ') || '없음'}`);

  try {
    await runChoiceGenerator(payload, 'primary');
    return;
  } catch (primaryError) {
    const themeKey = String(themeInfo.theme?.key || '').trim();
    const backupKeywords = mergeKeywordHints(payload.backupKeywordHint, BACKUP_THEME_KEYWORDS[themeKey] || []);
    const mergedFallbacks = mergeKeywordHints(payload.fallbackKeywordHint, backupKeywords);

    if (mergedFallbacks.length === 0) {
      throw primaryError;
    }

    console.warn(`1차 자동 초이스 생성 실패: ${primaryError.message}`);
    console.warn(`백업 키워드 재시도: ${mergedFallbacks.join(', ')}`);

    const retryPayload = {
      ...payload,
      fallbackKeywordHint: mergedFallbacks,
    };

    await runChoiceGenerator(retryPayload, 'retry');
  }
}

run().catch((error) => {
  console.error(`❌ 자동 초이스 생성 실패: ${error.message}`);
  process.exit(1);
});