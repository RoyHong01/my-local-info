/**
 * fix-post-images.js
 * Hero image backfill for posts.
 *
 * Run:
 *   node scripts/fix-post-images.js                   # default SVG posts only
 *   FORCE_RECHECK=1 node scripts/fix-post-images.js   # also reprocess posts using legacy fallback images
 */
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const {
  extractRegionTokens,
  getRegionalLandmark,
  METRO_SHORT_NAMES,
} = require('./lib/landmark-engine');

(function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fsSync.existsSync(envPath)) return;
  const lines = fsSync.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
})();

const TOUR_API_KEY = process.env.TOUR_API_KEY || '';
const FORCE_RECHECK = process.env.FORCE_RECHECK === '1' || process.env.FORCE_RECHECK === 'true';
const POSTS_DIR = path.join(process.cwd(), 'src', 'content', 'posts');
const DATA_DIR = path.join(process.cwd(), 'public', 'data');

const DEFAULT_SVG_PATTERN = /https:\/\/pick-n-joy\.com\/images\/default-[^"'\s]+\.svg/;

const LEGACY_FALLBACK_IMAGES = [
  'https://pick-n-joy.com/images/gyeongbokgung-hero.png',
  'https://pick-n-joy.com/images/changdeokgung-hero.png',
  'https://pick-n-joy.com/images/changgyeonggung-hero.png',
  'https://pick-n-joy.com/images/incheon-family-month-hero.jpg',
  'https://pick-n-joy.com/images/incheon-spring-festival-2026.jpg',
];

const NATIONAL_LANDMARK_TOKEN_POOL = ['서울', '부산', '제주', '경주', '강릉', '전주', '여수', '안동', '경기'];

const INTERNAL_SAFE_FALLBACK_IMAGES = [
  'https://pick-n-joy.com/images/gyeongbokgung-hero.png',
  'https://pick-n-joy.com/images/changdeokgung-hero.png',
  'https://pick-n-joy.com/images/changgyeonggung-hero.png',
];

async function loadDataJson(filename) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([\w_]+):\s*(.+)$/);
    if (m) {
      result[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return result;
}

function updateFrontmatterImage(content, newImage) {
  return content.replace(
    /^(image:\s*)["']?[^"'\r\n]+["']?/m,
    `$1"${newImage}"`
  );
}

function hashToIndex(seed, length) {
  if (!length) return 0;
  let hash = 0;
  const text = String(seed || 'pick-n-joy');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function inferParentMetro(titleText, category) {
  const combined = `${titleText} ${category}`;
  for (const metro of METRO_SHORT_NAMES) {
    const re = new RegExp(`(?:^|[^가-힣])${metro}(?=[^가-힣]|$)`);
    if (re.test(combined)) return metro;
  }
  if (category && category.includes('인천')) return '인천';
  return null;
}

function isDistrictToken(token) {
  return /구$/.test(token);
}

async function resolveImageViaTourAPI({ titleText, category, landmarkCache }) {
  const parentMetro = inferParentMetro(titleText, category);
  const extracted = extractRegionTokens(titleText);

  const attempts = [];
  for (const token of extracted) {
    attempts.push({
      region: token,
      addressFilter: isDistrictToken(token) && parentMetro ? parentMetro : undefined,
    });
  }
  if (parentMetro) attempts.push({ region: parentMetro });
  if (category && category.includes('인천')) attempts.push({ region: '인천' });
  for (const n of NATIONAL_LANDMARK_TOKEN_POOL) attempts.push({ region: n });

  const seenRegions = new Set();
  let attemptCount = 0;
  for (const { region, addressFilter } of attempts) {
    const key = `${region}|${addressFilter || ''}`;
    if (seenRegions.has(key)) continue;
    seenRegions.add(key);
    attemptCount++;
    try {
      const result = await getRegionalLandmark({
        regionName: region,
        tourApiKey: TOUR_API_KEY,
        cache: landmarkCache,
        numOfRows: 15,
        addressFilter,
      });
      if (result?.imageUrl) {
        console.log(`    [TourAPI OK] ${region}${addressFilter ? `(filter:${addressFilter})` : ''} -> ${result.imageUrl.slice(0, 80)}`);
        return { imageUrl: result.imageUrl, keyword: result.keyword, via: region };
      } else {
        console.log(`    [TourAPI --] ${region}${addressFilter ? `(filter:${addressFilter})` : ''} -> 0 items`);
      }
    } catch (e) {
      console.log(`    [TourAPI !!] ${region}: ${e.message}`);
    }
  }
  console.log(`  [diag] TourAPI tried ${attemptCount} times, all failed. Using safe fallback.`);
  return null;
}

async function run() {
  if (!TOUR_API_KEY) {
    console.warn('[WARN] TOUR_API_KEY not set.');
  }
  console.log(`Mode: ${FORCE_RECHECK ? 'FORCE_RECHECK (reprocess legacy fallback posts)' : 'default (SVG only)'}`);

  const [incheonItems, subsidyItems, festivalItems] = await Promise.all([
    loadDataJson('incheon.json'),
    loadDataJson('subsidy.json'),
    loadDataJson('festival.json'),
  ]);

  const incheonMap = new Map(incheonItems.map(i => [String(i['서비스ID'] || i.id || ''), i]));
  const subsidyMap = new Map(subsidyItems.map(i => [String(i['서비스ID'] || i.id || ''), i]));
  const festivalMap = new Map(festivalItems.map(i => [String(i.contentid || i.id || ''), i]));

  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const landmarkCache = new Map();

  let total = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');

    const hasDefaultSvg = DEFAULT_SVG_PATTERN.test(content);
    const hasLegacyFallback = LEGACY_FALLBACK_IMAGES.some((img) => content.includes(img));
    const isTarget = hasDefaultSvg || (FORCE_RECHECK && hasLegacyFallback);
    if (!isTarget) {
      skipped++;
      continue;
    }

    total++;
    const fm = parseFrontmatter(content);
    if (!fm) {
      console.warn(`[SKIP] frontmatter parse failed: ${file}`);
      failed++;
      continue;
    }

    const sourceId = fm.source_id || '';
    const category = fm.category || '';
    const titleText = [fm.title || '', category, fm.tags || '', fm.summary || ''].join(' ');
    let newImage = '';
    let via = '';

    if (sourceId) {
      let item = null;
      if (category.includes('인천')) item = incheonMap.get(sourceId);
      else if (category.includes('보조금') || category.includes('복지')) item = subsidyMap.get(sourceId);
      else if (category.includes('축제') || category.includes('여행')) item = festivalMap.get(sourceId);
      else item = incheonMap.get(sourceId) || subsidyMap.get(sourceId) || festivalMap.get(sourceId);

      if (item) {
        const img = item.firstimage || item.firstimage2 || '';
        if (img && !DEFAULT_SVG_PATTERN.test(img)) {
          newImage = img;
          via = 'data-json';
        }
      }
    }

    if (!newImage && TOUR_API_KEY) {
      try {
        const result = await resolveImageViaTourAPI({ titleText, category, landmarkCache });
        if (result) {
          newImage = result.imageUrl;
          via = `tourapi:${result.via}`;
        }
      } catch (err) {
        console.error(`[ERROR] landmark lookup failed (${file}): ${err.message}`);
      }
    }

    if (!newImage) {
      const seed = `${file}|${sourceId}|${category}`;
      const idx = hashToIndex(seed, INTERNAL_SAFE_FALLBACK_IMAGES.length);
      newImage = INTERNAL_SAFE_FALLBACK_IMAGES[idx];
      via = 'safe-fallback';
      console.log(`  [Fallback-Safe] ${file}: gung ${idx + 1}/${INTERNAL_SAFE_FALLBACK_IMAGES.length}`);
    }

    const newContent = updateFrontmatterImage(content, newImage);
    if (newContent === content) {
      console.warn(`[WARN] pattern mismatch: ${file}`);
      failed++;
      continue;
    }

    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`[OK:${via}] ${file} -> ${newImage.slice(0, 80)}`);
    updated++;
  }

  console.log(`\n=== done ===`);
  console.log(`target: ${total} (skipped ${skipped})`);
  console.log(`updated: ${updated}`);
  console.log(`failed: ${failed}`);
}

run().catch(err => {
  console.error('fix-post-images.js error:', err);
  process.exit(1);
});
