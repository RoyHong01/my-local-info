import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { execFileSync } from 'child_process';

const TARGET_BUCKETS = ['seoul', 'incheon', 'gyeonggi'];
const MIN_UNUSED_CANDIDATES = Number(process.env.MIN_UNUSED_RESTAURANT_CANDIDATES || '10');
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const existingPostDirs = [
  path.join(process.cwd(), 'src', 'content', 'posts'),
  path.join(process.cwd(), 'src', 'content', 'life'),
];

function classifyRegionBucket(item) {
  const source = [item?.address || '', item?.sourceQuery || '', item?.name || ''].join(' ');

  if (/서울/.test(source)) return 'seoul';
  if (/인천/.test(source)) return 'incheon';
  if (/경기|수원|성남|용인|고양|안양|화성|하남|의왕|의정부|광명|군포|파주|남양주|김포|부천|판교|분당|광교|동탄/.test(source)) {
    return 'gyeonggi';
  }

  return 'gyeonggi';
}

function buildRoundRobinCandidates(regions) {
  const queues = Object.entries(regions).map(([region, items]) => ({
    region,
    items: Array.isArray(items) ? [...items] : [],
  }));

  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      if (queue.items.length > 0) {
        out.push({ region: queue.region, item: queue.items.shift() });
        progressed = true;
      }
    }
  }
  return out;
}

async function getExistingRestaurantIds() {
  const ids = new Set();

  for (const dir of existingPostDirs) {
    let files = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        const parsed = matter(raw);
        if (parsed.data.category !== '픽앤조이 맛집 탐방') continue;

        const sourceId = String(parsed.data.source_id || parsed.data.sourceId || '').trim();
        if (sourceId) ids.add(sourceId);
      } catch {
        // ignore broken post files for candidate availability checks
      }
    }
  }

  return ids;
}

async function readSnapshot() {
  try {
    const raw = await fs.readFile(snapshotPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildFilteredCandidates(snapshot, existingIds) {
  const rawCandidates = buildRoundRobinCandidates(snapshot?.regions || {});
  return rawCandidates
    .filter(({ item }) => item?.id && item?.name)
    .filter(({ item }) => !existingIds.has(String(item.id)));
}

function findEmptyBuckets(candidates) {
  const bucketHas = new Map(TARGET_BUCKETS.map((bucket) => [bucket, false]));
  for (const candidate of candidates) {
    const bucket = classifyRegionBucket(candidate.item);
    bucketHas.set(bucket, true);
  }

  return TARGET_BUCKETS.filter((bucket) => !bucketHas.get(bucket));
}

function appendGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  try {
    fsSync.appendFileSync(outputPath, `${name}=${value}\n`, 'utf-8');
  } catch {
    // ignore output write failure
  }
}

function emitMetrics(snapshot, recollectPerformed) {
  const metrics = snapshot?.metrics || {};
  const cacheHit = recollectPerformed ? Number(metrics.cache_hit || 0) : 0;
  const cacheMiss = recollectPerformed ? Number(metrics.cache_miss || 0) : 0;
  const googleCalled = recollectPerformed ? Number(metrics.google_called || 0) : 0;

  appendGithubOutput('recollect_performed', recollectPerformed ? 'true' : 'false');
  appendGithubOutput('cache_hit', cacheHit);
  appendGithubOutput('cache_miss', cacheMiss);
  appendGithubOutput('google_called', googleCalled);
}

async function main() {
  const snapshot = await readSnapshot();
  const existingIds = await getExistingRestaurantIds();
  const candidates = snapshot ? buildFilteredCandidates(snapshot, existingIds) : [];
  const emptyBuckets = findEmptyBuckets(candidates);
  const hasEnoughCandidates = candidates.length >= MIN_UNUSED_CANDIDATES;
  const hasAllTargetBuckets = emptyBuckets.length === 0;
  const needsRecollect = !snapshot || !hasEnoughCandidates || !hasAllTargetBuckets;

  if (!needsRecollect) {
    console.log(`✅ 후보가 충분합니다. 수집을 건너뜁니다. (unused ${candidates.length}건, 기준 ${MIN_UNUSED_CANDIDATES}건)`);
    emitMetrics(snapshot, false);
    return;
  }

  const recollectReason = !snapshot
    ? '스냅샷 없음'
    : !hasEnoughCandidates
      ? `unused 후보 ${candidates.length}건 (기준 ${MIN_UNUSED_CANDIDATES}건 미만)`
      : `필수 버킷 후보 부족 (${emptyBuckets.join(', ')})`;

  console.log(`🔄 맛집 후보 재수집 필요: ${recollectReason}`);

  const collectScript = path.join(process.cwd(), 'scripts', 'collect-life-restaurants.mjs');
  execFileSync(process.execPath, [collectScript], {
    stdio: 'inherit',
    env: process.env,
  });

  const refreshedSnapshot = await readSnapshot();
  emitMetrics(refreshedSnapshot, true);
}

main().catch((error) => {
  console.error('❌ 맛집 후보 점검 실패', error);
  process.exit(1);
});
