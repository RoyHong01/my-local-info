const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const inputPath = path.join(process.cwd(), 'scripts', 'blog-input.latest.json');

function asString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveKeywordMatchMode(category, rawMode) {
  const explicit = asString(rawMode).toLowerCase();
  if (explicit === 'exact-first' || explicit === 'exact-only' || explicit === 'contains') {
    return explicit;
  }

  // 자동 분기: 축제 카테고리는 완전일치 우선, 나머지는 포함매칭 기본
  if (category === '전국 축제·여행') {
    return 'exact-first';
  }
  return 'contains';
}

if (!fs.existsSync(inputPath)) {
  console.error(`입력 파일이 없습니다: ${inputPath}`);
  process.exit(1);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
} catch (error) {
  console.error(`입력 JSON 파싱 실패: ${error.message}`);
  process.exit(1);
}

const category = asString(input.category);
const keyword = asString(input.keyword);
const keywordMatchMode = resolveKeywordMatchMode(category, input.keywordMatchMode);
const publishedBy = asString(input.publishedBy || 'manual').toLowerCase() === 'manual' ? 'manual' : 'auto';

if (!category) {
  console.error('blog-input.latest.json의 category는 필수입니다.');
  process.exit(1);
}
if (!keyword) {
  console.error('blog-input.latest.json의 keyword는 필수입니다.');
  process.exit(1);
}

const env = {
  ...process.env,
  BLOG_ONLY_CATEGORY: category,
  BLOG_ONLY_KEYWORD: keyword,
  BLOG_ONLY_KEYWORD_MATCH: keywordMatchMode,
  BLOG_PUBLISHED_BY: publishedBy,
  BLOG_MAX_CANDIDATES_PER_CATEGORY: String(asNumber(input.maxCandidatesPerCategory, 8)),
  BLOG_MAX_GENERATION_SECONDS: String(asNumber(input.maxGenerationSeconds, 900)),
  BLOG_MAX_API_CALLS: String(asNumber(input.maxApiCalls, 12)),
  BLOG_FESTIVAL_MIN_DAYS_BEFORE_END: String(asNumber(input.festivalMinDaysBeforeEnd, 7)),
};

console.log(`BLOG_ONLY_CATEGORY=${env.BLOG_ONLY_CATEGORY}`);
console.log(`BLOG_ONLY_KEYWORD=${env.BLOG_ONLY_KEYWORD}`);
console.log(`BLOG_ONLY_KEYWORD_MATCH=${env.BLOG_ONLY_KEYWORD_MATCH}`);
console.log(`BLOG_PUBLISHED_BY=${env.BLOG_PUBLISHED_BY}`);

const result = spawnSync('node', ['scripts/generate-blog-post.js'], {
  stdio: 'inherit',
  env,
  shell: false,
});

process.exit(result.status === null ? 1 : result.status);
