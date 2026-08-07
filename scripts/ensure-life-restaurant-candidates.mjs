import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { execFileSync } from 'child_process';

const TARGET_BUCKETS = ['seoul', 'incheon', 'gyeonggi'];
const MIN_UNUSED_CANDIDATES = Number(process.env.MIN_UNUSED_RESTAURANT_CANDIDATES || '10');
const RECOLLECT_COOLDOWN_DAYS = Number(process.env.RESTAURANT_RECOLLECT_COOLDOWN_DAYS || '7');
// 재수집이 매일 반복되는 것을 막는 가드 (2026-08-06~07 이틀 연속 재수집 사례).
// 쿨다운 무시 조건(후보 임계 미만)이 켜져 있어도 하루 1회를 넘지 않는다.
const MAX_RECOLLECT_PER_DAY = Math.max(1, Number.parseInt(process.env.RESTAURANT_MAX_RECOLLECT_PER_DAY || '1', 10));
// 연속 재수집에도 후보가 늘지 않으면 경고를 남긴다(쿼리 소진 신호).
const FAILED_RECOLLECT_WARN_THRESHOLD = Math.max(1, Number.parseInt(process.env.RESTAURANT_FAILED_RECOLLECT_WARN || '2', 10));
const FORCE_RECOLLECT_MODE = String(process.env.RESTAURANT_FORCE_RECOLLECT || '').trim().toLowerCase();
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const ratingsCachePath = path.join(process.cwd(), 'scripts', 'data', 'google-ratings-cache.json');
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

async function readRatingsCacheMeta() {
  try {
    const raw = await fs.readFile(ratingsCachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const meta = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    return {
      lastRecollectAt: String(meta.lastRecollectAt || ''),
      recollectCountToday: Number(meta.recollectCountToday || 0),
      recollectCountDate: String(meta.recollectCountDate || ''),
      consecutiveFailedRecollects: Number(meta.consecutiveFailedRecollects || 0),
      forceRecollectOnceConsumedAt: String(meta.forceRecollectOnceConsumedAt || ''),
    };
  } catch {
    return {
      lastRecollectAt: '',
      recollectCountToday: 0,
      recollectCountDate: '',
      consecutiveFailedRecollects: 0,
      forceRecollectOnceConsumedAt: '',
    };
  }
}

async function markForceRecollectConsumed() {
  let parsed = { meta: {}, items: {} };
  try {
    const raw = await fs.readFile(ratingsCachePath, 'utf-8');
    parsed = JSON.parse(raw);
  } catch {
    // keep fallback object
  }

  parsed.meta = parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
  parsed.items = parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
  parsed.meta.forceRecollectOnceConsumedAt = new Date().toISOString();

  await fs.mkdir(path.dirname(ratingsCachePath), { recursive: true });
  await fs.writeFile(ratingsCachePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
}

async function updateRecollectStats({ date, count, consecutiveFailed }) {
  const raw = await fs.readFile(ratingsCachePath, 'utf-8');
  const parsed = JSON.parse(raw);
  parsed.meta = parsed.meta || {};
  parsed.meta.recollectCountDate = date;
  parsed.meta.recollectCountToday = count;
  parsed.meta.consecutiveFailedRecollects = consecutiveFailed;
  await fs.writeFile(ratingsCachePath, JSON.stringify(parsed, null, 2), 'utf-8');
}

function isCooldownActive(lastRecollectAt) {
  if (!lastRecollectAt) return false;
  const parsed = new Date(lastRecollectAt);
  if (Number.isNaN(parsed.getTime())) return false;
  const elapsedDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
  return elapsedDays < RECOLLECT_COOLDOWN_DAYS;
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

function trimFailureReason(error) {
  const message = String(error?.message || error || '').trim();
  return message.length > 500 ? `${message.slice(0, 500)}...` : message;
}

function emitMetrics(snapshot, recollectPerformed) {
  const metrics = snapshot?.metrics || {};
  const cacheHit = recollectPerformed ? Number(metrics.cache_hit || 0) : 0;
  const cacheMiss = recollectPerformed ? Number(metrics.cache_miss || 0) : 0;
  const googleCalled = recollectPerformed ? Number(metrics.google_called || 0) : 0;
  const googleCallCapReached = recollectPerformed ? Boolean(metrics.google_call_cap_reached) : false;
  const googleCallCapLimit = recollectPerformed ? Number(metrics.google_call_cap_limit || 0) : 0;
  const googleCallsBlockedByCap = recollectPerformed ? Number(metrics.google_calls_blocked_by_cap || 0) : 0;
  const queryRotationTotalUsed = recollectPerformed ? Number(metrics.query_rotation_total_used || 0) : 0;
  const queryRotationPerRegion = recollectPerformed ? Number(metrics.query_rotation_per_region || 0) : 0;
  const queryLegacyAbsorbed = recollectPerformed ? Boolean(metrics.query_matrix_legacy_absorbed) : false;

  appendGithubOutput('recollect_performed', recollectPerformed ? 'true' : 'false');
  appendGithubOutput('cache_hit', cacheHit);
  appendGithubOutput('cache_miss', cacheMiss);
  appendGithubOutput('google_called', googleCalled);
  appendGithubOutput('google_call_cap_reached', googleCallCapReached ? 'true' : 'false');
  appendGithubOutput('google_call_cap_limit', googleCallCapLimit);
  appendGithubOutput('google_calls_blocked_by_cap', googleCallsBlockedByCap);
  appendGithubOutput('query_rotation_total_used', queryRotationTotalUsed);
  appendGithubOutput('query_rotation_per_region', queryRotationPerRegion);
  appendGithubOutput('query_legacy_absorbed', queryLegacyAbsorbed ? 'true' : 'false');
}

async function main() {
  const snapshot = await readSnapshot();
  const ratingsCacheMeta = await readRatingsCacheMeta();
  const forceRecollectRequested = FORCE_RECOLLECT_MODE === 'once';
  const forceRecollectConsumed = Boolean(ratingsCacheMeta.forceRecollectOnceConsumedAt);
  const forceRecollectActive = forceRecollectRequested && !forceRecollectConsumed;

  appendGithubOutput('force_recollect_mode', FORCE_RECOLLECT_MODE || 'off');
  appendGithubOutput('force_recollect_active', forceRecollectActive ? 'true' : 'false');
  appendGithubOutput('force_recollect_consumed', forceRecollectConsumed ? 'true' : 'false');

  if (forceRecollectRequested && forceRecollectConsumed) {
    console.log(`ℹ️ 1회성 강제 재수집 플래그는 이미 소비됨: ${ratingsCacheMeta.forceRecollectOnceConsumedAt}`);
  }

  const existingIds = await getExistingRestaurantIds();
  const candidates = snapshot ? buildFilteredCandidates(snapshot, existingIds) : [];
  const emptyBuckets = findEmptyBuckets(candidates);
  const hasEnoughCandidates = candidates.length >= MIN_UNUSED_CANDIDATES;
  const hasAllTargetBuckets = emptyBuckets.length === 0;
  const needsRecollect = forceRecollectActive || !snapshot || !hasEnoughCandidates || !hasAllTargetBuckets;

  if (!needsRecollect) {
    console.log(`✅ 후보가 충분합니다. 수집을 건너뜁니다. (unused ${candidates.length}건, 기준 ${MIN_UNUSED_CANDIDATES}건)`);
    emitMetrics(snapshot, false);
    return;
  }

  const recollectReason = forceRecollectActive
    ? '1회성 강제 재수집 플래그 활성화'
    : !snapshot
    ? '스냅샷 없음'
    : !hasEnoughCandidates
      ? `unused 후보 ${candidates.length}건 (기준 ${MIN_UNUSED_CANDIDATES}건 미만)`
      : `필수 버킷 후보 부족 (${emptyBuckets.join(', ')})`;

  // 후보가 완전히 바닥나면 쿨다운을 무시하고 재수집한다.
  // 기존 조건은 "후보 부족일 때 쿨다운 적용"이라, 정작 수집이 필요한 순간에 막혔다.
  // (2026-08-04~05 맛집 2일 연속 미발행: 유효 후보 0인데 쿨다운으로 재수집 생략)
  // 비용 폭주는 collect 측 GOOGLE_CALLS_PER_RUN_MAX(기본 50) 하드캡이 막는다.
  // 후보가 임계 미만이면 쿨다운을 무시하고 재수집한다(운영 정책: 5개 미만).
  // 0까지 기다리면 소진 당일 미발행이 발생하므로 여유를 두고 채운다.
  const CRITICAL_CANDIDATE_THRESHOLD = Number(process.env.RESTAURANT_CRITICAL_CANDIDATES || '5');
  const candidatesExhausted = candidates.length < CRITICAL_CANDIDATE_THRESHOLD;
  const shouldApplyCooldown = !forceRecollectActive && Boolean(snapshot) && !candidatesExhausted && (!hasEnoughCandidates || !hasAllTargetBuckets);

  // 하루 재수집 횟수 상한 (쿨다운 무시 조건보다 우선한다)
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayCount = ratingsCacheMeta.recollectCountDate === todayKst
    ? ratingsCacheMeta.recollectCountToday
    : 0;
  if (!forceRecollectActive && todayCount >= MAX_RECOLLECT_PER_DAY) {
    console.log(`⏸️ 일일 재수집 상한 도달: ${todayCount}/${MAX_RECOLLECT_PER_DAY} (${todayKst} KST)`);
    console.log(`↪ 재수집 스킵: ${recollectReason}`);
    appendGithubOutput('recollect_skipped_by_daily_cap', 'true');
    emitMetrics(snapshot, false);
    return;
  }

  if (shouldApplyCooldown && isCooldownActive(ratingsCacheMeta.lastRecollectAt)) {
    console.log(`⏸️ 재수집 쿨다운 적용: 마지막 재수집 ${ratingsCacheMeta.lastRecollectAt} (쿨다운 ${RECOLLECT_COOLDOWN_DAYS}일)`);
    console.log(`↪ 재수집 스킵: ${recollectReason}`);
    appendGithubOutput('recollect_performed', 'false');
    appendGithubOutput('recollect_skipped_by_cooldown', 'true');
    emitMetrics(snapshot, false);
    return;
  }

  appendGithubOutput('recollect_skipped_by_cooldown', 'false');

  console.log(`🔄 맛집 후보 재수집 필요: ${recollectReason}`);

  const collectScript = path.join(process.cwd(), 'scripts', 'collect-life-restaurants.mjs');
  execFileSync(process.execPath, [collectScript], {
    stdio: 'inherit',
    // 수집 단계에서 이미 발행된 식당을 미리 제외하기 위해 발행 이력 id를 전달한다.
    // 전달하지 않으면 수집분의 다수가 기존 발행분과 중복돼 유효 후보가 급감한다
    // (2026-07-29 수집 82건 중 61건이 수집 시점에 이미 발행된 상태였음).
    env: { ...process.env, RESTAURANT_PUBLISHED_IDS: Array.from(existingIds).join(',') },
  });

  // 재수집 결과 기록: 후보가 늘지 않았으면 연속 실패로 집계한다.
  try {
    const afterSnapshot = await readSnapshot();
    const afterExisting = await getExistingRestaurantIds();
    const afterCandidates = afterSnapshot ? buildFilteredCandidates(afterSnapshot, afterExisting) : [];
    const improved = afterCandidates.length > candidates.length;
    const nextFailed = improved ? 0 : (ratingsCacheMeta.consecutiveFailedRecollects + 1);
    await updateRecollectStats({
      date: todayKst,
      count: todayCount + 1,
      consecutiveFailed: nextFailed,
    });
    console.log(`📊 재수집 결과: 후보 ${candidates.length} → ${afterCandidates.length}건 (연속 미개선 ${nextFailed}회)`);
    appendGithubOutput('recollect_candidates_before', String(candidates.length));
    appendGithubOutput('recollect_candidates_after', String(afterCandidates.length));
    appendGithubOutput('recollect_consecutive_failed', String(nextFailed));
    if (nextFailed >= FAILED_RECOLLECT_WARN_THRESHOLD) {
      console.warn(`⚠️ 재수집을 ${nextFailed}회 연속 수행했으나 후보가 늘지 않았습니다. 쿼리 매트릭스 소진 가능성.`);
      appendGithubOutput('recollect_warning', 'query_pool_exhausted');
    }
  } catch (err) {
    console.warn(`재수집 결과 기록 실패: ${err.message}`);
  }

  if (forceRecollectActive) {
    await markForceRecollectConsumed();
    console.log('✅ 1회성 강제 재수집 플래그를 소비 처리했습니다.');
  }

  const refreshedSnapshot = await readSnapshot();
  emitMetrics(refreshedSnapshot, true);
}

main().catch((error) => {
  appendGithubOutput('failure_reason', trimFailureReason(error));
  console.error('❌ 맛집 후보 점검 실패', error);
  process.exit(1);
});
