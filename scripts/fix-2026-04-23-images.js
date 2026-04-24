#!/usr/bin/env node
/**
 * one-off: 2026-04-23 자동생성 3개 글 이미지 교체
 * - 인천 아이 꿈 수당 → 인천 랜드마크
 * - 충남 금산군 군민안전보험 → 충남 랜드마크
 * - 서울 강서구 음식물처리기 → 서울 랜드마크 (최근 사용 제외)
 *
 * 실행: node scripts/fix-2026-04-23-images.js
 * 환경변수: TOUR_API_KEY 필요
 */
const fs = require('fs');
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}

const { getRegionalLandmark } = require('./lib/landmark-engine');

const POSTS_DIR = path.join(__dirname, '..', 'src', 'content', 'posts');

const targets = [
  {
    file: '2026-04-23-post-1776975180712.md',
    region: '인천',
    label: '인천 아이 꿈 수당',
  },
  {
    file: '2026-04-23-geumsan-safety-insurance.md',
    region: '충남',
    label: '충남 금산군 군민안전보험',
  },
  {
    file: '2026-04-23-gangseo-food-waste-disposer-support.md',
    region: '서울',
    label: '서울 강서구 음식물처리기',
  },
];

function replaceFrontmatterImage(content, newUrl) {
  // 첫 frontmatter 블록 안의 image 라인만 치환
  const fmEnd = content.indexOf('\n---', 4);
  if (!content.startsWith('---') || fmEnd < 0) return null;
  const head = content.slice(0, fmEnd);
  const tail = content.slice(fmEnd);
  const replaced = head.replace(/^image:\s*.*$/m, `image: "${newUrl}"`);
  return replaced + tail;
}

(async () => {
  const tourApiKey = process.env.TOUR_API_KEY;
  if (!tourApiKey) {
    console.error('TOUR_API_KEY 환경변수가 필요합니다 (.env.local 또는 export).');
    process.exit(1);
  }

  const cache = new Map();
  for (const t of targets) {
    const filePath = path.join(POSTS_DIR, t.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[skip] 파일 없음: ${t.file}`);
      continue;
    }
    const original = fs.readFileSync(filePath, 'utf-8');
    const result = await getRegionalLandmark({
      regionName: t.region,
      tourApiKey,
      cache,
      numOfRows: 20,
      context: `manual-fix | ${t.label}`,
    });
    if (!result?.imageUrl) {
      console.error(`[fail] ${t.label}: TourAPI 결과 없음`);
      continue;
    }
    const updated = replaceFrontmatterImage(original, result.imageUrl);
    if (!updated) {
      console.error(`[fail] ${t.label}: frontmatter image 라인 치환 실패`);
      continue;
    }
    fs.writeFileSync(filePath, updated, 'utf-8');
    console.log(`[ok] ${t.label}`);
    console.log(`     → ${result.imageUrl}`);
    console.log(`     keyword=${result.keyword} matched=${result.matchedName} reused=${result.reused === true}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
