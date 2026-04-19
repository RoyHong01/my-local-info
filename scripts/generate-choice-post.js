const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { loadLocalEnvFiles, searchProducts, sleep } = require('./lib/coupang-api');

const GEMINI_MODEL = process.env.CHOICE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const ALLOW_GEMINI_PRO = process.env.ALLOW_GEMINI_PRO === 'true';
if (/\bpro\b/i.test(GEMINI_MODEL) && !ALLOW_GEMINI_PRO) {
  throw new Error(`안전장치: Pro 모델(${GEMINI_MODEL})은 차단됩니다. 필요하면 ALLOW_GEMINI_PRO=true를 명시하세요.`);
}
const GEMINI_TIMEOUT_MS = Number(process.env.CHOICE_GEMINI_TIMEOUT_MS || 120000);
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.CHOICE_GEMINI_MAX_OUTPUT_TOKENS || 8192);
const RECOMMENDED_PRODUCTS_HISTORY_PATH = path.join(process.cwd(), 'scripts', 'data', 'recommended-products.json');
const PRODUCT_HISTORY_LOOKBACK_DAYS = Number(process.env.CHOICE_PRODUCT_HISTORY_DAYS || 14);
const CHOICE_MIN_RATING = Number(process.env.CHOICE_MIN_RATING || 4.5);
const CHOICE_MIN_REVIEW_COUNT = Number(process.env.CHOICE_MIN_REVIEW_COUNT || 100);
const CHOICE_SEARCH_LIMIT = Number(process.env.CHOICE_SEARCH_LIMIT || 10);
const CHOICE_TARGET_POOL_SIZE = Number(process.env.CHOICE_TARGET_POOL_SIZE || 50);
const CHOICE_ALLOW_MISSING_QUALITY_METADATA = String(process.env.CHOICE_ALLOW_MISSING_QUALITY_METADATA || 'true').trim().toLowerCase() !== 'false';
const CHOICE_TOP_RANK_FALLBACK_LIMIT = Number(process.env.CHOICE_TOP_RANK_FALLBACK_LIMIT || 10);
const CHOICE_API_CALL_DELAY_MS = Number(process.env.CHOICE_API_CALL_DELAY_MS || 150);
const CHOICE_QUALITY_TARGET_COUNT = Number(process.env.CHOICE_QUALITY_TARGET_COUNT || 3);
const CHOICE_DEDUP_SCOPE = String(process.env.CHOICE_DEDUP_SCOPE || 'global').trim().toLowerCase();
const CHOICE_RELAXED_RATING_STEPS = String(process.env.CHOICE_RELAXED_RATING_STEPS || '4.3,4.0')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value < CHOICE_MIN_RATING)
  .sort((a, b) => b - a);

function getGeminiApiKey() {
  loadLocalEnvFiles();
  return process.env.GEMINI_API_KEY || '';
}

function parseArgs(argv) {
  const args = { input: '', outdir: '', help: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--help' || key === '-h') {
      args.help = true;
      continue;
    }
    if (key === '--input' && next) {
      args.input = next;
      i++;
      continue;
    }
    if (key === '--outdir' && next) {
      args.outdir = next;
      i++;
      continue;
    }
  }
  return args;
}

function printHelp() {
  console.log('Usage: node scripts/generate-choice-post.js --input scripts/choice-input.json [--outdir src/content/life]');
  console.log('');
  console.log('Required JSON fields:');
  console.log('- title');
  console.log('- englishName  (example: cj-biocore-probiotics)');
  console.log('- summary');
  console.log('- Either keywordHint or manual coupangUrl + coupangHtml');
  console.log('');
  console.log('Optional fields: keywordHint, sourceUrl, rating, reviewCount, tags, image, fileName, outputFileName, brand');
}

function todayIso() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function parseIsoDateToUtc(dateText) {
  const text = String(dateText || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetweenIso(fromDate, toDate) {
  const from = parseIsoDateToUtc(fromDate);
  const to = parseIsoDateToUtc(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

async function loadRecommendedProductsHistory() {
  try {
    const raw = await fs.readFile(RECOMMENDED_PRODUCTS_HISTORY_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return { version: 1, entries };
  } catch {
    return { version: 1, entries: [] };
  }
}

async function saveRecommendedProductsHistory(history) {
  await fs.mkdir(path.dirname(RECOMMENDED_PRODUCTS_HISTORY_PATH), { recursive: true });
  const payload = {
    version: 1,
    updatedAtKst: `${todayIso()}T00:00:00+09:00`,
    entries: Array.isArray(history?.entries) ? history.entries : [],
  };
  await fs.writeFile(RECOMMENDED_PRODUCTS_HISTORY_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
}

function isRecentlyPostedProduct(productId, historyEntries, today, publishedBy) {
  const id = String(productId || '').trim();
  if (!id || !Array.isArray(historyEntries)) return false;

  return historyEntries.some((entry) => {
    if (String(entry?.productId || '').trim() !== id) return false;
    if (CHOICE_DEDUP_SCOPE === 'same-publisher') {
      const historyPublisher = String(entry?.publishedBy || '').trim().toLowerCase();
      if (historyPublisher && historyPublisher !== publishedBy) return false;
    }
    const diff = daysBetweenIso(entry?.date, today);
    return diff >= 0 && diff < PRODUCT_HISTORY_LOOKBACK_DAYS;
  });
}

function extractCoupangBannerImage(coupangHtml) {
  const html = String(coupangHtml || '');
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultChoiceImage(candidate) {
  if (candidate.image) return String(candidate.image).trim();
  const baseName = toSlug(candidate.fileName || candidate.englishName || candidate.title || 'choice-item');
  return `/images/choice/${baseName}.jpg`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags) && tags.length > 0) return tags;
  return ['쿠팡', '리뷰', '라이프스타일', '자기관리', '픽앤조이초이스'];
}

function sanitizeMarkdownText(value) {
  return String(value || '').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function splitKeywordHints(keywordHint) {
  if (Array.isArray(keywordHint)) {
    return keywordHint.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(keywordHint || '')
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPublishedBy(candidate) {
  const value = String(candidate?.publishedBy || '').trim().toLowerCase();
  return value === 'auto' ? 'auto' : 'manual';
}

function tokenizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{Script=Hangul}a-z0-9\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildKeywordSignals(candidate) {
  const titleTokens = tokenizeText(candidate.title);
  const summaryTokens = tokenizeText(candidate.summary);
  const tagTokens = (candidate.tags || []).flatMap((tag) => tokenizeText(tag));
  const hintTokens = splitKeywordHints(candidate.keywordHint).flatMap((hint) => tokenizeText(hint));

  const signalWeights = new Map();
  const bump = (tokens, weight) => {
    for (const token of tokens) {
      signalWeights.set(token, (signalWeights.get(token) || 0) + weight);
    }
  };

  bump(titleTokens, 5);
  bump(tagTokens, 4);
  bump(hintTokens, 6);
  bump(summaryTokens, 2);

  return signalWeights;
}

function deriveKeywordCandidates(candidate) {
  const manualHints = splitKeywordHints(candidate.keywordHint);
  if (manualHints.length > 0) return Array.from(new Set(manualHints));

  const stopwords = new Set(['쿠팡', '리뷰', '추천', '픽앤조이초이스', '픽앤조이', 'choice', 'best', '상품']);
  const fromTags = (candidate.tags || [])
    .map((item) => String(item || '').trim())
    .filter((item) => item.length >= 2 && !stopwords.has(item.toLowerCase()));

  const fromTitle = String(candidate.title || '')
    .split(/[|,·/()\-]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stopwords.has(item.toLowerCase()));

  const fromBrand = candidate.brand ? [String(candidate.brand).trim()] : [];
  const fromSummary = tokenizeText(candidate.summary).slice(0, 4);
  return Array.from(new Set([...fromTags, ...fromBrand, ...fromTitle, ...fromSummary])).slice(0, 6);
}

function deriveFallbackKeywordCandidates(candidate) {
  const explicitFallbacks = splitKeywordHints(candidate.fallbackKeywordHint);
  const primaryHints = splitKeywordHints(candidate.keywordHint);
  const derived = deriveKeywordCandidates(candidate);
  return Array.from(new Set([...explicitFallbacks, ...derived, ...primaryHints])).slice(0, 8);
}

function scoreProductRelevance(product, keywordSignals) {
  const titleTokens = tokenizeText(product.productName);
  const uniqueTokens = new Set(titleTokens);
  let score = 0;

  for (const token of uniqueTokens) {
    score += keywordSignals.get(token) || 0;
  }

  if (product.isRocket) score += 1.2;
  if (product.rank > 0) {
    score += Math.max(0, 2 - product.rank * 0.2);
  }

  const numericInName = (product.productName.match(/\d+/g) || []).length;
  score += Math.min(1.5, numericInName * 0.2);
  score += Math.min(1.2, Number(product.rating || 0) * 0.2);
  score += Math.min(1.0, Number(product.reviewCount || 0) / 500);

  return score;
}

function isQualifiedChoiceProduct(product, minRating = CHOICE_MIN_RATING) {
  if (!product?.productId || !product?.productName || !product?.affiliateUrl) return false;
  if (Boolean(product.outOfStock)) return false;

  const hasQualityMeta = Boolean(product.hasQualityMeta) || Number(product.rating || 0) > 0 || Number(product.reviewCount || 0) > 0;
  if (!hasQualityMeta) {
    return CHOICE_ALLOW_MISSING_QUALITY_METADATA;
  }

  if (Number(product.rating || 0) < minRating) return false;
  if (Number(product.reviewCount || 0) < CHOICE_MIN_REVIEW_COUNT) return false;
  return true;
}

function isTopRankFallbackCandidate(product) {
  if (!product?.productId || !product?.productName || !product?.affiliateUrl) return false;
  if (Boolean(product.outOfStock)) return false;
  return Number(product.rank || 0) > 0 && Number(product.rank || 0) <= CHOICE_TOP_RANK_FALLBACK_LIMIT;
}

function rankAndFilterProducts(products, keywordSignals, historyEntries, today, publishedBy, minRating) {
  const ranked = products
    .map((product) => ({
      ...product,
      relevanceScore: scoreProductRelevance(product, keywordSignals),
    }))
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      if (a.rank && b.rank) return a.rank - b.rank;
      return 0;
    });

  const freshRanked = ranked.filter((product) => !isRecentlyPostedProduct(product.productId, historyEntries, today, publishedBy));
  const strictQualified = freshRanked.filter((product) => isQualifiedChoiceProduct(product, minRating));

  if (strictQualified.length >= 3 || !CHOICE_ALLOW_MISSING_QUALITY_METADATA) {
    return { ranked: freshRanked, strictQualified, selectedPool: strictQualified, usedTopRankFallback: false };
  }

  const selectedPool = [];
  const seen = new Set();
  for (const product of strictQualified) {
    const key = product.productId || product.affiliateUrl;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selectedPool.push(product);
  }

  for (const product of freshRanked) {
    if (selectedPool.length >= 3) break;
    const key = product.productId || product.affiliateUrl;
    if (!key || seen.has(key)) continue;
    if (!isTopRankFallbackCandidate(product)) continue;
    seen.add(key);
    selectedPool.push(product);
  }

  return {
    ranked: freshRanked,
    strictQualified,
    selectedPool,
    usedTopRankFallback: selectedPool.length > strictQualified.length,
  };
}

function pickProductsWithBrandDiversity(candidates, maxCount = 3) {
  const selected = [];
  const brandSet = new Set();

  for (const item of candidates) {
    if (selected.length >= maxCount) break;
    if (!item) continue;

    const normalizedBrand = String(item.brand || item.vendorName || '').trim().toLowerCase();
    if (!normalizedBrand && selected.length >= maxCount - 1) continue;

    selected.push(item);
    if (normalizedBrand) brandSet.add(normalizedBrand);
  }

  if (selected.length < maxCount) return selected;
  if (brandSet.size >= 2) return selected;

  // 브랜드가 1개로 고정된 경우, 다른 브랜드 후보와 교체 시도
  for (const candidate of candidates) {
    const normalizedBrand = String(candidate?.brand || candidate?.vendorName || '').trim().toLowerCase();
    if (!normalizedBrand || brandSet.has(normalizedBrand)) continue;

    for (let i = selected.length - 1; i >= 0; i--) {
      const selectedBrand = String(selected[i]?.brand || selected[i]?.vendorName || '').trim().toLowerCase();
      if (selectedBrand === normalizedBrand) continue;
      selected[i] = candidate;
      return selected;
    }
  }

  return selected;
}

function collectUniqueProducts(target, products, seen) {
  for (const product of products) {
    const uniqueKey = product.productId || product.affiliateUrl;
    if (!uniqueKey || seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    target.push(product);
  }
}

function selectPrimaryImage(candidate, products) {
  if (candidate.image) return String(candidate.image).trim();
  // 멀티프로덕트(API 자동) 포스트: 히어로 이미지 표시 안 함 (본문 Pick of the Day 블록에서 노출)
  if (Array.isArray(products) && products.length >= 2) return '';
  // 단일 제품이면 해당 이미지 사용
  if (Array.isArray(products) && products[0]?.productImage) return products[0].productImage;
  return defaultChoiceImage(candidate);
}

function pickOneBySeed(options, seedText) {
  if (!Array.isArray(options) || options.length === 0) return '';
  const seed = String(seedText || 'picknjoy');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % options.length;
  return options[idx];
}

const WRITING_ANGLES = [
  {
    key: 'problem-solving',
    title: '문제 해결형',
    guide: '독자가 겪는 불편함을 먼저 언급하고, 그 불편함을 줄이는 선택 기준으로 서론과 소제목을 전개합니다.',
  },
  {
    key: 'trend-driven',
    title: '트렌드 중심형',
    guide: '최근 유행 맥락이나 소비 흐름을 짚되, 과장된 단정 대신 관찰 가능한 분위기와 체감 포인트 중심으로 전개합니다.',
  },
  {
    key: 'curation-expert',
    title: '전문가 큐레이션',
    guide: '픽앤조이의 선별 기준과 안목을 앞세워, 왜 이 상품군을 추렸는지 판단 근거를 서론과 소제목에서 드러냅니다.',
  },
  {
    key: 'value-efficiency',
    title: '가성비/효율 강조',
    guide: '시간과 비용 관점에서 실패 확률을 줄이는 실용 포인트를 중심으로 서론과 소제목을 구성합니다.',
  },
];

function pickWritingAngle() {
  const manual = String(process.env.CHOICE_WRITING_ANGLE || '').trim().toLowerCase();
  if (manual) {
    const matched = WRITING_ANGLES.find((angle) => angle.key === manual || angle.title === manual);
    if (matched) return matched;
  }

  const index = Math.floor(Math.random() * WRITING_ANGLES.length);
  return WRITING_ANGLES[index];
}

function buildPickOfDayBlock(product) {
  if (!product?.productName || !product?.affiliateUrl) return '';
  const safeProductName = sanitizeMarkdownText(product.productName);
  const lines = [];
  lines.push('## **📍 픽앤조이가 선정한 오늘의 픽**');
  lines.push('');
  if (product.productImage) {
    lines.push(`![${safeProductName}](${product.productImage})`);
    lines.push('');
  }
  lines.push(`**👉 [${safeProductName} 최저가 확인하기](${product.affiliateUrl})**`);
  return lines.join('\n').trim();
}

function buildComparisonBlock(products) {
  if (!products || products.length === 0) return '';
  const validProducts = products.filter((p) => p?.productName && p?.affiliateUrl);
  if (validProducts.length === 0) return '';

  const lines = [];
  const comparisonHeading = pickOneBySeed([
    '### 함께 비교하면 좋은 추천 상품',
    '### 놓치면 아쉬운 또 다른 아이템',
    '### 픽앤조이가 엄선한 추가 리스트',
    '### 취향에 따라 고르는 또 다른 베스트',
  ], validProducts.map((p) => p.productId || p.productName).join('|'));
  lines.push(comparisonHeading);
  lines.push('');
  lines.push('메인 추천 제품 외에도, 평점과 가성비 면에서 우수한 대안들을 더 살펴보았습니다. 메인 상품이 주인공이라면 아래 아이템은 취향과 사용 환경에 따라 충분히 더 좋은 선택이 될 수 있어요.');
  lines.push('');

  if (validProducts.length >= 2) {
    const p2 = validProducts[0];
    const p3 = validProducts[1];
    const name2 = sanitizeMarkdownText(p2.productName);
    const name3 = sanitizeMarkdownText(p3.productName);
    const label2 = name2.length > 25 ? name2.slice(0, 25) + '…' : name2;
    const label3 = name3.length > 25 ? name3.slice(0, 25) + '…' : name3;
    lines.push(`| ${label2} | ${label3} |`);
    lines.push('| :---: | :---: |');
    const img2 = p2.productImage ? `![${name2}](${p2.productImage})` : '&nbsp;';
    const img3 = p3.productImage ? `![${name3}](${p3.productImage})` : '&nbsp;';
    lines.push(`| ${img2} | ${img3} |`);
    lines.push(`| [👉 실시간 가격 보기](${p2.affiliateUrl}) | [👉 실시간 가격 보기](${p3.affiliateUrl}) |`);
  } else {
    const p = validProducts[0];
    const name = sanitizeMarkdownText(p.productName);
    if (p.productImage) {
      lines.push(`![${name}](${p.productImage})`);
      lines.push('');
    }
    lines.push(`**👉 [${name} 실시간 가격 보기](${p.affiliateUrl})**`);
  }

  return lines.join('\n').trim();
}

function insertBeforeFirstHeading(content, block) {
  if (!block) return content;
  const lines = content.split('\n');
  const firstHeadingIndex = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (firstHeadingIndex < 0) {
    return `${content.trim()}\n\n${block}`.trim();
  }
  lines.splice(firstHeadingIndex, 0, block, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildProductMarkdown(product, ctaLabel) {
  if (!product?.productName || !product?.affiliateUrl) return '';
  const safeProductName = sanitizeMarkdownText(product.productName);
  const safeLabel = sanitizeMarkdownText(ctaLabel || `${product.productName} 최저가 확인하기`);

  const lines = [];
  if (product.productImage) {
    lines.push(`![${safeProductName}](${product.productImage})`);
    lines.push('');
  }
  lines.push(`**👉 [${safeLabel}](${product.affiliateUrl})**`);
  return lines.join('\n').trim();
}

function insertTopProductBlock(content, block) {
  if (!block) return content;

  const lines = content.split('\n');
  let headingIndex = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (headingIndex < 0) return `${block}\n\n${content}`.trim();

  let insertIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i].trim())) {
      insertIndex = i;
      break;
    }
  }

  lines.splice(insertIndex, 0, '', block, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function insertMidProductBlock(content, block) {
  if (!block) return content;

  const lines = content.split('\n');
  const headingIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i].trim())) headingIndices.push(i);
  }

  if (headingIndices.length < 2) {
    return `${content.trim()}\n\n${block}`.trim();
  }

  const secondHeadingIndex = headingIndices[1];
  let insertIndex = lines.length;
  for (let i = secondHeadingIndex + 1; i < lines.length; i++) {
    if (/^#{2,3}\s+/.test(lines[i].trim())) {
      insertIndex = i;
      break;
    }
  }

  lines.splice(insertIndex, 0, '', block, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitFrontmatterAndBody(content) {
  const text = String(content || '');
  if (!text.startsWith('---\n')) {
    return { frontmatter: '', body: text.trim() };
  }

  const endIndex = text.indexOf('\n---\n', 4);
  if (endIndex < 0) {
    return { frontmatter: '', body: text.trim() };
  }

  const frontmatter = text.slice(0, endIndex + 5).trim();
  const body = text.slice(endIndex + 5).trim();
  return { frontmatter, body };
}

function normalizeLegacyChoiceProductBlocks(content) {
  const { frontmatter, body } = splitFrontmatterAndBody(content);

  let normalizedBody = String(body || '')
    .replace(/^###\s*오늘의\s*추천\s*(장비|상품).*$/gim, '')
    .replace(/^!\[[\s\S]*?\]\(https:\/\/ads-partners\.coupang\.com\/[^)\s]+\)\s*$/gim, '')
    .replace(/^\*\*👉\s*\[[^\]]+\]\(https:\/\/link\.coupang\.com\/[^)\s]+\)\*\*\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!frontmatter) return normalizedBody;
  return `${frontmatter}\n\n${normalizedBody}`.trim();
}

function ensureDisclosure(content) {
  // 상세 페이지 하단 고지문을 사용하므로 본문 끝 고지문은 제거만 수행
  const { frontmatter, body } = splitFrontmatterAndBody(content);

  let normalizedBody = String(body || '')
    .replace(/^.*쿠팡\s*파트너스\s*활동의\s*일환.*$/gim, '')
    .replace(/^\s*---\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const finalBody = normalizedBody;
  if (!frontmatter) return finalBody;

  return `${frontmatter}\n\n${finalBody}`;
}

function ensureFallbackAffiliate(content, coupangUrl, title) {
  const url = String(coupangUrl || '').trim();
  if (!url) return content;
  if (content.includes(url)) return content;
  const label = sanitizeMarkdownText(title ? `${title} 최저가 확인 및 상세정보 보기` : '오늘의 추천 상품 최저가 확인하기');
  return `${content.trim()}\n\n**👉 [${label}](${url})**`;
}

function findChoiceValidationErrors(content) {
  const errors = [];
  const bannedWords = ['결론적으로', '무엇보다도', '다양한', '인상적인', '포착한', '주목할 만한', '대표적인', '각광받는', '눈길을 끄는', '대명사', '선사한다', '즐길 수 있다', '만끽할 수 있다'];

  for (const word of bannedWords) {
    if (content.includes(word)) {
      errors.push(`금지 표현 포함: ${word}`);
    }
  }

  if ((content.match(/^##\s+/gm) || []).length < 1) {
    errors.push('필수 ## 소제목이 없습니다.');
  }

  const ctaLinesWithoutUrl = String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /[👉🛒]/.test(line) && !/https?:\/\//.test(line));

  if (ctaLinesWithoutUrl.length > 0) {
    errors.push('URL 없는 CTA 문장이 남아 있습니다.');
  }

  return errors;
}

function sanitizeBannedExpressions(content) {
  const replacements = [
    ['결론적으로', '정리하면'],
    ['무엇보다도', '특히'],
    ['다양한', '여러'],
    ['인상적인', '눈에 띄는'],
    ['포착한', '짚어낸'],
    ['주목할 만한', '눈여겨볼'],
    ['대표적인', '주요'],
    ['각광받는', '많이 선택되는'],
    ['눈길을 끄는', '눈에 들어오는'],
    ['대명사', '상징처럼 여겨지는 표현'],
    ['선사한다', '전해줍니다'],
    ['즐길 수 있다', '누릴 수 있어요'],
    ['만끽할 수 있다', '충분히 누릴 수 있어요'],
  ];

  let next = String(content || '');
  for (const [from, to] of replacements) {
    next = next.replace(new RegExp(from, 'g'), to);
  }
  return next;
}

function injectProductBlocks(content, candidate, products) {
  const normalizedContent = normalizeLegacyChoiceProductBlocks(content);

  if (!Array.isArray(products) || products.length === 0) {
    return ensureDisclosure(ensureFallbackAffiliate(normalizedContent, candidate.coupangUrl, candidate.title));
  }

  // 사용된 이미지 URL 추적 (중복 제거)
  const usedImages = new Set();
  const primary = products[0];
  if (primary?.productImage) usedImages.add(primary.productImage);

  // Product #1: 서론 직후 "오늘의 픽" 블록
  const pickOfDayBlock = buildPickOfDayBlock(primary);

  // Products 2&3: 이미 사용된 이미지 제외 후 비교 섹션
  const secondaryProducts = products.slice(1, 3).filter((p) => {
    if (!p?.productImage) return true;
    if (usedImages.has(p.productImage)) return false;
    usedImages.add(p.productImage);
    return true;
  });
  const comparisonBlock = buildComparisonBlock(secondaryProducts);

  // 본문 내 Product #1 이미지 중복 제거 (생성 모델이 삽입한 경우 대비)
  let next = normalizedContent;
  if (primary?.productImage) {
    const escapedImg = primary.productImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgPattern = new RegExp(`!\\[[^\\]]*\\]\\(${escapedImg}\\)\\n?`, 'gi');
    next = next.replace(imgPattern, '');
    next = next.replace(/\n{3,}/g, '\n\n').trim();
  }

  // "오늘의 픽" 블록: 첫 ## 소제목 바로 앞 (서론 직후)
  next = insertBeforeFirstHeading(next, pickOfDayBlock);

  // 비교 섹션: 두 번째 ## 이후 중반 위치
  if (comparisonBlock) {
    next = insertMidProductBlock(next, comparisonBlock);
  }

  return ensureDisclosure(next);
}

async function resolveProductsForCandidate(candidate) {
  const primaryKeywords = deriveKeywordCandidates(candidate);
  const fallbackKeywords = deriveFallbackKeywordCandidates(candidate).filter((keyword) => !primaryKeywords.includes(keyword));
  const keywordSignals = buildKeywordSignals(candidate);
  const history = await loadRecommendedProductsHistory();
  const collected = [];
  const seen = new Set();
  let lastError = null;
  const today = todayIso();
  const publishedBy = getPublishedBy(candidate);

  // 1단계: 주 키워드로 수집 (delay 포함)
  for (const keyword of primaryKeywords) {
    try {
      const products = await searchProducts(keyword, { limit: CHOICE_SEARCH_LIMIT, sort: 'bestAsc' });
      collectUniqueProducts(collected, products, seen);
      
      // 현재 수집분 필터링해서 품질 상품 수 체크
      const tempFiltered = rankAndFilterProducts(collected, keywordSignals, history.entries, today, publishedBy, CHOICE_MIN_RATING);
      if (tempFiltered.selectedPool.length >= CHOICE_QUALITY_TARGET_COUNT || collected.length >= CHOICE_TARGET_POOL_SIZE) {
        break; // 품질 상품 충분하거나 pool 가득 → 조기 종료
      }
      
      await sleep(CHOICE_API_CALL_DELAY_MS); // 다음 호출 전 delay
    } catch (error) {
      lastError = error;
    }
  }

  let appliedMinRating = CHOICE_MIN_RATING;
  let filtered = rankAndFilterProducts(collected, keywordSignals, history.entries, today, publishedBy, appliedMinRating);
  let freshQualified = filtered.selectedPool;
  let usedTopRankFallback = filtered.usedTopRankFallback;

  // 2단계: fallback 키워드로 부족분 보충 (delay 포함)
  if (freshQualified.length < 3 && fallbackKeywords.length > 0) {
    for (const keyword of fallbackKeywords) {
      try {
        const products = await searchProducts(keyword, { limit: CHOICE_SEARCH_LIMIT, sort: 'bestAsc' });
        collectUniqueProducts(collected, products, seen);
        
        filtered = rankAndFilterProducts(collected, keywordSignals, history.entries, today, publishedBy, appliedMinRating);
        freshQualified = filtered.selectedPool;
        usedTopRankFallback = filtered.usedTopRankFallback;

        if (freshQualified.length >= 3 || collected.length >= CHOICE_TARGET_POOL_SIZE) {
          break; // 품질 상품 3개 달성 또는 pool 가득
        }
        
        await sleep(CHOICE_API_CALL_DELAY_MS); // 다음 호출 전 delay
      } catch (error) {
        lastError = error;
      }
    }
  }

  // 3단계: rating 기준 완화 (delay 필요 없음)
  if (freshQualified.length < 3 && CHOICE_RELAXED_RATING_STEPS.length > 0) {
    for (const minRating of CHOICE_RELAXED_RATING_STEPS) {
      appliedMinRating = minRating;
      filtered = rankAndFilterProducts(collected, keywordSignals, history.entries, today, publishedBy, appliedMinRating);
      freshQualified = filtered.selectedPool;
      usedTopRankFallback = filtered.usedTopRankFallback;

      if (freshQualified.length >= 3) {
        console.warn(`품질 기준 완화 적용: rating >= ${appliedMinRating}`);
        break;
      }
    }
  }

  const selected = pickProductsWithBrandDiversity(freshQualified, 3);
  const selectedBrands = new Set(selected.map((item) => String(item.brand || item.vendorName || '').trim().toLowerCase()).filter(Boolean));

  let selectionError = null;
  if (selected.length < 3) {
    selectionError = new Error(`중복/품질 필터 후 선정 가능한 상품이 3개 미만입니다. (선정 ${selected.length}개)`);
  } else if (selectedBrands.size < 2) {
    selectionError = new Error('브랜드 다양성 기준(최소 2개 브랜드)에 맞는 3개 조합을 구성하지 못했습니다.');
  }

  return {
    keywords: [...primaryKeywords, ...fallbackKeywords],
    primaryKeywords,
    fallbackKeywords,
    appliedMinRating,
    usedTopRankFallback,
    collectedCandidateCount: collected.length,
    products: selected,
    error: selectionError || (selected.length > 0 ? null : lastError),
  };
}

function buildChoicePrompt(candidate, today, context = {}, angle = WRITING_ANGLES[0]) {
  const outputFileName = candidate.outputFileName || `${today}-choice-${candidate.englishName || 'choice-item'}.md`;
  const productContext = Array.isArray(context.products) && context.products.length > 0
    ? context.products.map((product, index) => `${index + 1}. ${product.productName} | 이미지: ${product.productImage || '없음'} | 링크: ${product.affiliateUrl}`).join('\n')
    : '검색 실패 또는 결과 없음. 본문에는 수동 제휴 링크/배너 기준 fallback 문구만 사용하세요.';
  const keywordContext = Array.isArray(context.keywords) && context.keywords.length > 0 ? context.keywords.join(', ') : '없음';

  return `당신은 픽앤조이(Pick-n-Joy)의 30대 초반 라이프스타일 에디터입니다.
아래 [입력 데이터]만 근거로, 호기심을 유발하지만 과장하지 않는 제품 큐레이션 포스트를 작성하세요.

[입력 데이터]
카테고리: 픽앤조이 초이스
제품정보: ${JSON.stringify(candidate, null, 2)}
쿠팡태그원문: ${candidate.coupangHtml}
참고링크: ${candidate.sourceUrl || '없음'}
검색 키워드: ${keywordContext}
자동 추출 상품: ${productContext}
작성일: ${today}

[출력 계약 - 반드시 준수]
1) 출력은 markdown 코드블록 하나만
2) frontmatter + 본문만 출력
3) 마지막 줄은 반드시: FILENAME: ${outputFileName}
4) 아래 금지 항목 포함 시 실패:
   - 1단계, 2단계, The Hook, The Choice, Curation 같은 구조 라벨
   - 본문 내 JSON-LD 코드
  - 본문 내 쿠팡 파트너스 고지문(후처리에서 자동 삽입됨)
  - "가장 확실한 방법", "정착기", "완벽한", "무조건", "끝판왕" 같은 과장형 제목 문구
  - 입력 데이터에 없는 통계, 임상 수치, 비교 실험 결과, 사용자 후기 비율

  [문체 및 구조 다양성 규칙]
  - 이번 실행의 글쓰기 앵글: ${angle.title}
  - 앵글 설명: ${angle.guide}
  - 앵글은 서론 첫 문단과 첫 2개 소제목에 반드시 반영할 것
  - 다른 앵글 문장을 섞어 평균적인 톤으로 희석하지 말고, 선택한 앵글을 명확히 유지할 것
  - 참고용 앵글 풀(매 실행 랜덤 1개 적용):
    1) 문제 해결형: 독자의 불편함을 먼저 언급
    2) 트렌드 중심형: 최근 유행/소비 흐름을 먼저 제시
    3) 전문가 큐레이션: 픽앤조이의 선별 기준 강조
    4) 가성비/효율 강조: 시간·비용 절약 관점 강조

[Frontmatter 스키마 - 키 이름 정확히]
---
title: "(자연스러운 한국어 제목. 번역투 금지. 문제 제기 + 제품명 + 선택 이유 구조 권장)"
date: "${today}"
slug: "choice-${candidate.englishName}"
summary: "(110~150자, 검색 노출용. 과장 없이 제품명/용도/선택 이유를 설명)"
description: "(summary와 동일)"
category: "픽앤조이 초이스"
published_by: "${getPublishedBy(candidate)}"
tags: ["태그1", "태그2", "태그3", "태그4", "태그5", "쿠팡", "리뷰"]
rating_value: "${candidate.rating || '4.8'}"
review_count: "${candidate.reviewCount || '100'}"
image: "(아래 이미지 규칙 적용)"
source_id: "manual-choice-${candidate.englishName}"
coupang_link: "${candidate.coupangUrl}"
coupang_banner_image: "(쿠팡태그원문 내 이미지 URL 또는 입력값)"
coupang_banner_alt: "(제품명 + 핵심 사양 포함 대체텍스트)"
---

[본문 구조]
- 첫 소제목은 반드시 ## 로 시작하고, 한 문장 훅으로 독자 문제를 찌르기
- 소제목은 총 4~6개, 전부 자연어 제목 (번호/단계 라벨 금지)
- 서론 직후와 두 번째 섹션 뒤에는 후처리로 상품 이미지/CTA가 자동 삽입되므로, 해당 위치에 배너/상품 표를 직접 작성하지 말 것
- **서론 상품 개수 언급 지침 (필수)**: "추천 상품은 3개입니다", "총 3가지를 준비했습니다", "3개를 추천드립니다" 같은 기계적 나열 표현 절대 금지. 대신 맥락에 자연스럽게 녹일 것 — 예) "이번에 엄선한 3가지만 알면 쇼핑이 훨씬 수월해져요", "최종 후보 3선만 간추렸어요", "핵심 3종의 차이를 직접 살펴봤어요"
- 소제목 스타일 규칙: "1. 장점", "2. 특징" 같은 딱딱한 번호형 라벨 금지. 질문형("왜 다들 이 모델만 찾을까요?")과 감탄/강조형("생각보다 훨씬 똑똑한 선택!")을 최소 1개씩 섞어 사용할 것
- 아래 흐름을 반드시 포함:
  1) 공감 훅: 일상 장면 + 불편 포인트
  2) 문제 상황: 제품 사용 전 불편함을 구체 장면으로 묘사
  3) 변화된 일상: 사용 후 달라진 루틴/감정/시간 흐름을 대비해 묘사
  4) 선택 근거: 왜 이 제품군이 납득되는지 기준 제시
  5) 반론 처리: 아쉬운 점 1개 + 누구에게 맞는지/안 맞는지
  6) 마무리: 상황형 한 줄 평(여운)

[콘텐츠 시나리오 라이팅 지침 (필수)]
1) FACT보다 CONTEXT: 스펙 나열형 문장을 최소화하고, 서론에서 제품이 필요한 구체적 상황(Problem)을 생생하게 묘사할 것.
2) 상황 전환 구조: "포인트 3가지" 형식 대신 사용자 가상 시나리오를 중심으로, 불편했던 상황과 개선된 일상의 대비를 본문 중심축으로 쓸 것.
3) 감각적 묘사: "성능이 좋다" 같은 추상 평가 대신 "아침마다 겪던 스트레스가 줄어든다"처럼 체감 가능한 언어를 사용할 것.
4) 신뢰의 한 줄: 문맥 중간에 리뷰/평점 근거를 자연스럽게 섞을 것. 예) "4.5점 이상의 리뷰가 이 변화를 보여줘요." 단, 입력 데이터에 없는 수치를 새로 만들지 말 것.

[제목/리드 품질 규칙]
- 제목은 한국어로 자연스럽게 읽혀야 하며, 억지 번역투나 광고 문구처럼 보이면 실패
- 제목은 "왜 오래 살아남는 이유"처럼 중복 표현 금지
- 건강기능식품/영양제는 치료를 암시하는 표현 금지
- 리드 문단은 독자의 생활 장면을 먼저 보여주고, 바로 제품 자랑으로 뛰어들지 말 것
- 본문에 "The Choice" 또는 영어 구조 라벨을 그대로 쓰지 마세요
- "오늘의 픽 (Pick of the Day)"처럼 한글 제목 뒤 영어 부제를 붙이지 말고, 소제목은 한국어 중심으로 작성할 것
- 오늘의 대표 상품 블록 제목은 반드시 정확히 "## **📍 픽앤조이가 선정한 오늘의 픽**" 형식으로 작성할 것
- 전문 용어/브랜드/고유 명사를 제외한 불필요한 영어 표현(영어 부제, 영어 슬로건, 영어 구조 라벨) 사용을 금지하고 한글 에디터 톤을 유지할 것

[호기심 유발 장치 - 최소 3개 반영]
- 반전 문장: "좋다는 말보다 먼저 봐야 할 건..."
- 대비 문장: "고함량인데도 불편함이 적은 이유는..."
- 구체 장면: "오후 3시 회의 전에 배가 묵직해질 때..."
- 데이터 갈등: "후기 평점은 높은데, 실제로 갈리는 포인트는..."
- 독자 질문: "그래서 내 루틴에 넣을 만하냐고요?"

※ 단, 위 장치는 입력 데이터와 어울릴 때만 사용하고 억지로 모두 넣지 말 것

[쿠팡파트너스 제휴 링크 규칙]
- 이 포스트는 Web/Mobile 모두 본문에 쿠팡 파트너스 제휴 링크를 반드시 포함해야 합니다.
- 쿠팡 배너나 위젯 형태의 본문 삽입은 여전히 금지됩니다. 텍스트 기반 CTA 링크만 본문에 넣으세요.
- 링크는 본문에서 직접 작성하지 말고, 후처리로 자동 주입되는 상품 이미지/CTA와 자연스럽게 이어질 문맥만 남기세요.
- 링크는 별도 줄에 작성하고, 모바일에서 클릭하기 쉬운 문구로 만드세요.
- 예시: **👉 [제품명] 최저가 확인 및 상세정보 보기** / **🛒 오늘의 추천 상품, 실시간 할인 가격 확인하기**
- 기존 글 업데이트 시에도 원문 맥락을 유지하며 자연스럽게 제휴 링크를 후방 삽입하세요.
- 톤은 픽앤조이의 프리미엄 라이프스타일 큐레이션으로 유지하고, 지나치게 공격적이지 않게 작성하세요.

[시나리오 섹션 작성 규칙]
- 라벨 사용 절대 금지: "Before:", "After:", "전:", "후:" 같은 단어를 소제목/레이블로 쓰지 말 것.
- 불편 상황 섹션은 공감되는 일상 불편을 자연어 소제목으로 시작할 것.
  - 예: "세탁은 끝났는데 왠지 모를 꿉꿉함이 남을 때"
- 변화 섹션은 사용 후의 쾌적함/만족감을 자연어 소제목으로 시작할 것.
  - 예: "정리하는 순간까지 번지는 은은한 향기"
- 두 섹션 모두 2~4문장으로 작성하고, 장면/감정/시간 맥락이 드러나야 함.
- 상품 3개를 각각 "장점 1, 2, 3"으로 기계적으로 나열하지 말고, 메인 상황을 중심으로 대안 2개를 비교하는 서술로 자연스럽게 연결할 것.

### 솔직히 아쉬운 점 딱 하나 🧐
- (실제 사용자가 체감할 단점 1개를 구체적으로)

[이미지 규칙]
1) 배너 제외: 120x240 등 홍보 배너형 이미지는 frontmatter image로 사용 금지
2) 우선순위:
   - 참고링크에서 추출 가능한 고화질 제품 이미지
   - 없으면 /images/choice/${candidate.fileName || candidate.englishName}.jpg
3) 본문에 frontmatter image와 동일한 이미지 마크다운을 다시 넣지 말 것(상단 자동 노출과 중복 방지)
4) 본문 중간 상세 이미지는 최대 1장만 허용하며, 대표 이미지와 다른 파일일 때만 사용

[문체/톤]
- 반드시 경어체: ~해요 / ~거든요 / ~입니다 / ~네요
- 금지: ~이다 / ~한다 / ~됐다
- AI 금지어: 결론적으로, 무엇보다도, 다양한, 인상적인, 포착한, 주목할 만한, 대표적인, 각광받는, 눈길을 끄는, 대명사, 선사한다, 즐길 수 있다, 만끽할 수 있다
- 문단은 2~3문장마다 줄바꿈, 모바일 4~5줄 넘기지 말 것
- 이모지는 소제목 중심으로 1~3개만 절제해서 사용

[사실성/컴플라이언스]
- 입력 데이터 밖의 수치/효능/비교결과를 임의 생성 금지
- 입력 데이터 밖의 임상 결과, 만족도 수치, 검색량, 키워드 빈도, 타 제품 비교 우위 생성 금지
- 건강 제품은 질병 치료/예방 단정 금지
- 개인 체감, 사용자 후기 기반, 제품 정보 기준 같은 안전한 표현 사용
- 성분이나 설계가 좋아 보여도 "해결된다"보다 "기대하는 분이 많다", "이 점을 보고 고른다"처럼 완곡하게 표현

[품질 체크리스트 - 출력 전 자체 검증]
- frontmatter 필수 키 누락 없음
- category 값이 정확히 픽앤조이 초이스
- 본문에 단계 라벨 없음
- 본문에 JSON-LD/법적고지 없음
- 본문에 쿠팡 배너 삽입 없음 (CTA 텍스트 링크는 허용)`;
}

function dedupeAffiliateLinks(content, coupangUrl) {
  const url = String(coupangUrl || '').trim();
  if (!url) return content;

  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mdLinkRegex = new RegExp(`^\\*\\*[^\\n]*\\[[^\\]]+\\]\\(${escapedUrl}\\)[^\\n]*\\*\\*\\s*$`, 'gim');
  const matches = Array.from(content.matchAll(mdLinkRegex));

  if (matches.length <= 1) return content;

  const last = matches[matches.length - 1][0];
  let removed = content.replace(mdLinkRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  if (/\n\n###\s+/m.test(removed)) {
    removed = removed.replace(/\n\n###\s+/, `\n\n${last}\n\n### `);
  } else {
    removed = `${removed}\n\n${last}`;
  }

  return removed.replace(/\n{3,}/g, '\n\n').trim();
}

async function callGemini(prompt) {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${geminiApiKey}`;
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
          temperature: 0.35,
          topP: 0.92,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API 오류: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function removeCodeFence(text) {
  let value = String(text || '').trim();
  if (value.startsWith('```markdown')) value = value.slice(11);
  else if (value.startsWith('```md')) value = value.slice(5);
  else if (value.startsWith('```')) value = value.slice(3);
  if (value.endsWith('```')) value = value.slice(0, -3);
  return value.trim();
}

function splitFilenameLine(content, fallbackName) {
  const lines = content.split('\n');
  let filename = '';
  const bodyLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      bodyLines.push(line);
    }
  }
  if (!filename) filename = fallbackName;
  if (!filename.endsWith('.md')) filename += '.md';
  return { filename, content: bodyLines.join('\n').trim() };
}

function upsertFrontmatterField(content, key, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return content;

  const escaped = value.replace(/"/g, '\\"');
  const line = `${key}: "${escaped}"`;
  const fieldRegex = new RegExp(`^${key}:.*$`, 'm');
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, line);
  }

  const endIdx = content.indexOf('\n---\n', 4);
  if (content.startsWith('---\n') && endIdx > -1) {
    const frontmatter = content.slice(0, endIdx + 1);
    const rest = content.slice(endIdx + 1);
    return `${frontmatter}${line}\n${rest}`;
  }
  return content;
}

function ensureFrontmatter(content, candidate) {
  const text = String(content || '').trim();
  if (text.startsWith('---\n') && text.indexOf('\n---\n', 4) > -1) {
    return text;
  }

  const safeTitle = String(candidate.title || '픽앤조이 초이스').replace(/"/g, '\\"');
  const fallbackSlug = toSlug(candidate.fileName || candidate.englishName || candidate.title || 'choice-item');
  const today = todayIso();
  return [
    '---',
    `title: "${safeTitle}"`,
    `date: "${today}"`,
    `slug: "choice-${fallbackSlug}"`,
    'category: "픽앤조이 초이스"',
    '---',
    '',
    text,
  ].join('\n').trim();
}

function normalizeGeneratedContent(content, candidate) {
  let value = String(content || '').trim();

  value = value
    .replace(/##\s*\d+단계\s*:\s*/g, '## ')
    .replace(/##\s*The\s+Hook/gi, '## 시작은 작지만 불편함은 컸어요')
    .replace(/##\s*The\s+Choice/gi, '## 픽앤조이의 선택')
    .replace(/##\s*Curation/gi, '## 왜 이 제품을 골랐을까요?');

  value = value
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/이\s*아래의\s*JSON-LD[\s\S]*$/i, '')
    .replace(/^.*쿠팡\s*파트너스\s*활동의\s*일환.*$/gim, '')
    .replace(/^.*본\s*콘텐츠는\s*AI\s*기술을\s*활용.*$/gim, '')
    .replace(/^\*\*[👉🛒]\s+\[[^\]]+\](?!\()([^\n]*)\*\*\s*$/gim, '')
    .replace(/^[👉🛒]\s+\*\*\[[^\]]+\](?!\()([^\n]*)\*\*\s*$/gim, '')
    .replace(/^\*\*[👉🛒](?!.*https?:\/\/).*$/gim, '')
    .replace(/^[👉🛒]\s+\*\*(?!.*https?:\/\/).*$/gim, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!/[👉🛒]/.test(trimmed)) return true;
      return /https?:\/\//.test(trimmed);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  value = ensureFrontmatter(value, candidate);

  const slug = `choice-${toSlug(candidate.englishName || candidate.fileName || candidate.title || 'item')}`;
  const bannerImage = candidate.coupangBannerImage || extractCoupangBannerImage(candidate.coupangHtml);
  const selectedPrimaryImage = selectPrimaryImage(candidate, candidate.products);
  // 멀티상품 글에서 로컬 기본 이미지 경로가 남아 카드 썸네일이 깨지는 경우를 방지합니다.
  const finalPrimaryImage = selectedPrimaryImage || bannerImage;

  value = upsertFrontmatterField(value, 'slug', slug);
  value = upsertFrontmatterField(value, 'category', '픽앤조이 초이스');
  value = upsertFrontmatterField(value, 'published_by', getPublishedBy(candidate));
  value = upsertFrontmatterField(value, 'summary', candidate.summary || '');
  value = upsertFrontmatterField(value, 'description', candidate.summary || candidate.description || '');
  value = upsertFrontmatterField(value, 'rating_value', String(candidate.rating || '4.8'));
  value = upsertFrontmatterField(value, 'review_count', String(candidate.reviewCount || '100'));
  value = upsertFrontmatterField(value, 'image', finalPrimaryImage);
  value = upsertFrontmatterField(value, 'source_id', `manual-choice-${toSlug(candidate.englishName || candidate.fileName || 'item')}`);
  value = upsertFrontmatterField(value, 'coupang_link', String(candidate.coupangUrl || '').trim());
  if (bannerImage) value = upsertFrontmatterField(value, 'coupang_banner_image', bannerImage);
  value = upsertFrontmatterField(value, 'coupang_banner_alt', String(candidate.title || '').trim());
  value = dedupeAffiliateLinks(value, candidate.coupangUrl);
  value = injectProductBlocks(value, candidate, candidate.products || []);

  return value;
}

async function loadCandidate(inputPath) {
  const raw = await fs.readFile(inputPath, 'utf-8');
  const parsed = JSON.parse(raw);

  const required = ['title', 'englishName', 'summary'];
  for (const key of required) {
    if (!parsed[key]) {
      throw new Error(`입력 JSON 필수값 누락: ${key}`);
    }
  }

  const hasKeyword = splitKeywordHints(parsed.keywordHint).length > 0;
  const hasManualAffiliate = parsed.coupangUrl && parsed.coupangHtml;
  if (!hasKeyword && !hasManualAffiliate) {
    throw new Error('입력 JSON에는 keywordHint 또는 coupangUrl + coupangHtml 중 하나가 필요합니다.');
  }

  parsed.tags = normalizeTags(parsed.tags);
  parsed.publishedBy = getPublishedBy(parsed);
  parsed.outputFileName = String(parsed.outputFileName || '').trim();
  parsed.fileName = toSlug(parsed.fileName || parsed.englishName || parsed.title);
  parsed.englishName = toSlug(parsed.englishName || parsed.fileName || parsed.title);
  parsed.coupangBannerImage = parsed.coupangBannerImage || extractCoupangBannerImage(parsed.coupangHtml);
  return parsed;
}

async function appendRecommendedProductsHistory(products, meta) {
  const validProducts = Array.isArray(products)
    ? products.filter((item) => item?.productId).slice(0, 3)
    : [];

  if (validProducts.length === 0) return;

  const history = await loadRecommendedProductsHistory();
  const nextEntries = [
    ...history.entries,
    ...validProducts.map((product) => ({
      date: meta.date,
      productId: String(product.productId),
      productName: String(product.productName || '').trim(),
      brand: String(product.brand || product.vendorName || '').trim(),
      publishedBy: meta.publishedBy,
      postFile: meta.postFile,
      sourceId: meta.sourceId,
      themeKey: meta.themeKey || '',
      themeName: meta.themeName || '',
    })),
  ];

  // 최신 120일 데이터만 유지
  const trimmed = nextEntries.filter((entry) => {
    const diff = daysBetweenIso(entry?.date, meta.date);
    return Number.isFinite(diff) && diff >= 0 && diff <= 120;
  });

  history.entries = trimmed;
  await saveRecommendedProductsHistory(history);
}

async function emitGithubOutputs(outputs) {
  const outputPath = String(process.env.GITHUB_OUTPUT || '').trim();
  if (!outputPath || !outputs || typeof outputs !== 'object') return;

  const lines = Object.entries(outputs)
    .filter(([key]) => key)
    .map(([key, value]) => `${key}=${String(value ?? '')}`)
    .join('\n');

  if (!lines) return;
  await fs.appendFile(outputPath, `${lines}\n`, 'utf-8');
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const inputPath = args.input || process.env.CHOICE_INPUT_PATH || path.join(process.cwd(), 'scripts', 'choice-input.json');
  const outDir = args.outdir || process.env.CHOICE_OUTPUT_DIR || path.join(process.cwd(), 'src', 'content', 'life');

  const candidate = await loadCandidate(inputPath);
  const today = todayIso();
  const productResolution = await resolveProductsForCandidate(candidate);
  const hasKeywordInput = splitKeywordHints(candidate.keywordHint).length > 0;

  if (productResolution.error) {
    console.warn(`쿠팡 상품 검색 fallback 사용: ${productResolution.error.message}`);
  }

  if (hasKeywordInput && productResolution.products.length < 3) {
    throw new Error(`자동 선정 규칙을 만족한 상품이 3개 미만입니다. (${productResolution.products.length}개)`);
  }

  if (productResolution.products[0]?.affiliateUrl) {
    candidate.coupangUrl = candidate.coupangUrl || productResolution.products[0].affiliateUrl;
  }
  if (productResolution.products[0]?.productImage) {
    candidate.coupangBannerImage = candidate.coupangBannerImage || productResolution.products[0].productImage;
  }
  if (!candidate.coupangHtml && candidate.coupangUrl) {
    const bannerSource = candidate.coupangBannerImage || candidate.image || '';
    candidate.coupangHtml = bannerSource
      ? `<a href="${candidate.coupangUrl}" target="_blank" referrerpolicy="unsafe-url"><img src="${bannerSource}" alt="${candidate.title}" width="640" height="640"></a>`
      : `<a href="${candidate.coupangUrl}" target="_blank" referrerpolicy="unsafe-url">${candidate.title}</a>`;
  }

  candidate.products = productResolution.products;

  const writingAngle = pickWritingAngle();
  const prompt = buildChoicePrompt(candidate, today, productResolution, writingAngle);

  console.log(`CHOICE_GEMINI_MODEL: ${GEMINI_MODEL}`);
  console.log(`선택된 글쓰기 앵글: ${writingAngle.title}`);
  console.log(`입력 파일: ${inputPath}`);
  console.log(`자동 키워드: ${(productResolution.keywords || []).join(', ') || '없음'}`);
  console.log(`자동 상품 수: ${productResolution.products.length}`);

  let finalContent = '';
  let finalFileName = candidate.outputFileName || `${today}-choice-${candidate.englishName}.md`;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const generated = await callGemini(prompt);
      if (!generated || !generated.trim()) {
        throw new Error('Gemini 응답이 비어 있습니다.');
      }

      const stripped = removeCodeFence(generated);
      const fallbackName = candidate.outputFileName || `${today}-choice-${candidate.englishName}.md`;
      const withFilename = splitFilenameLine(stripped, fallbackName);
      const normalized = sanitizeBannedExpressions(normalizeGeneratedContent(withFilename.content, candidate));
      const validationErrors = findChoiceValidationErrors(normalized);

      if (validationErrors.length > 0) {
        throw new Error(`품질 검증 실패: ${validationErrors.join(', ')}`);
      }

      finalContent = normalized;
      finalFileName = withFilename.filename;
      break;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`Gemini 호출 재시도 ${attempt + 1}/${maxAttempts}: ${err.message}`);
    }
  }

  if (!finalContent || !finalContent.trim()) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }

  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, finalFileName);
  await fs.writeFile(outputPath, finalContent.trim() + '\n', 'utf-8');

  await appendRecommendedProductsHistory(candidate.products || [], {
    date: today,
    publishedBy: candidate.publishedBy,
    postFile: path.relative(process.cwd(), outputPath).replace(/\\/g, '/'),
    sourceId: `manual-choice-${toSlug(candidate.englishName || candidate.fileName || 'item')}`,
    themeKey: candidate.themeKey,
    themeName: candidate.themeName,
  });

  const appliedMinRating = Number(productResolution.appliedMinRating || CHOICE_MIN_RATING);
  const relaxedFallbackAppliedCount = appliedMinRating < CHOICE_MIN_RATING ? 1 : 0;

  await emitGithubOutputs({
    applied_min_rating: Number.isFinite(appliedMinRating) ? appliedMinRating : CHOICE_MIN_RATING,
    relaxed_fallback_applied_count: relaxedFallbackAppliedCount,
    selected_product_count: Array.isArray(candidate.products) ? candidate.products.length : 0,
    choice_published_by: candidate.publishedBy || 'auto',
  });

  if (relaxedFallbackAppliedCount > 0) {
    console.log(`CHOICE_RELAXED_FALLBACK_APPLIED_COUNT=${relaxedFallbackAppliedCount}`);
  }

  console.log(`✅ 초이스 포스트 생성 완료: ${outputPath}`);
}

run().catch((err) => {
  console.error(`❌ 실패: ${err.message}`);
  process.exit(1);
});
