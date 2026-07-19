import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const ROOT = process.cwd();
const CACHE_PATH = path.join(ROOT, 'scripts', 'data', 'google-ratings-cache.json');
const RESTAURANTS_PATH = path.join(ROOT, 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const LIFE_POSTS_DIR = path.join(ROOT, 'src', 'content', 'life');

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeId(value) {
  const id = String(value || '').trim();
  return id || null;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readLifeMarkdownFiles() {
  try {
    const entries = await fs.readdir(LIFE_POSTS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => path.join(LIFE_POSTS_DIR, entry.name));
  } catch {
    return [];
  }
}

function collectFromRestaurants(payload, candidateMap) {
  const regions = payload?.regions && typeof payload.regions === 'object' ? payload.regions : {};
  let collected = 0;

  for (const items of Object.values(regions)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const kakaoId = normalizeId(item?.id);
      if (!kakaoId) continue;

      const rating = toNumberOrNull(item?.googleRating);
      const userRatingCount = toNumberOrNull(item?.googleRatingCount);
      if (rating === null) continue;

      if (!candidateMap.has(kakaoId)) {
        candidateMap.set(kakaoId, {
          rating,
          userRatingCount,
          placeId: normalizeId(item?.googlePlaceId) || '',
          source: 'restaurants.json',
        });
        collected += 1;
      }
    }
  }

  return collected;
}

async function collectFromLifePosts(candidateMap) {
  const files = await readLifeMarkdownFiles();
  let collected = 0;

  for (const filePath of files) {
    let raw = '';
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    let data;
    try {
      ({ data } = matter(raw));
    } catch {
      continue;
    }

    const kakaoId = normalizeId(data?.source_id || data?.kakao_id);
    if (!kakaoId) continue;

    const rating = toNumberOrNull(data?.rating_value ?? data?.google_rating ?? data?.rating);
    const userRatingCount = toNumberOrNull(data?.review_count ?? data?.google_review_count ?? data?.rating_count);
    if (rating === null) continue;

    if (!candidateMap.has(kakaoId)) {
      candidateMap.set(kakaoId, {
        rating,
        userRatingCount,
        placeId: '',
        source: 'life-post-frontmatter',
      });
      collected += 1;
    }
  }

  return { filesCount: files.length, collected };
}

async function main() {
  const nowIso = new Date().toISOString();

  const cache = await readJson(CACHE_PATH, { meta: {}, items: {} });
  if (!cache.meta || typeof cache.meta !== 'object') cache.meta = {};
  if (!cache.items || typeof cache.items !== 'object') cache.items = {};

  const beforeCount = Object.keys(cache.items).length;

  const restaurantsPayload = await readJson(RESTAURANTS_PATH, {});
  const candidates = new Map();
  const fromRestaurants = collectFromRestaurants(restaurantsPayload, candidates);
  const { filesCount, collected: fromLifePosts } = await collectFromLifePosts(candidates);

  let addedCount = 0;
  let addedFromRestaurants = 0;
  let addedFromLifePosts = 0;

  for (const [kakaoId, info] of candidates.entries()) {
    if (cache.items[kakaoId]) continue;

    cache.items[kakaoId] = {
      rating: info.rating,
      userRatingCount: info.userRatingCount,
      조회일: nowIso,
      placeId: info.placeId || '',
    };

    addedCount += 1;
    if (info.source === 'restaurants.json') addedFromRestaurants += 1;
    if (info.source === 'life-post-frontmatter') addedFromLifePosts += 1;
  }

  cache.meta.updatedAt = nowIso;
  if (typeof cache.meta.lastRecollectAt !== 'string') cache.meta.lastRecollectAt = '';
  if (typeof cache.meta.ttlDays !== 'number' || Number.isNaN(cache.meta.ttlDays)) cache.meta.ttlDays = 90;

  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');

  const afterCount = Object.keys(cache.items).length;

  console.log('[seed-ratings-cache] candidates from restaurants:', fromRestaurants);
  console.log('[seed-ratings-cache] candidates from life posts:', fromLifePosts, `(files: ${filesCount})`);
  console.log('[seed-ratings-cache] cache items before:', beforeCount);
  console.log('[seed-ratings-cache] added items:', addedCount, `(restaurants: ${addedFromRestaurants}, posts: ${addedFromLifePosts})`);
  console.log('[seed-ratings-cache] cache items after:', afterCount);
}

main().catch((error) => {
  console.error('[seed-ratings-cache] failed:', error?.message || error);
  process.exit(1);
});
