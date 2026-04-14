const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COUPANG_API_HOST = 'https://api-gateway.coupang.com';
const SEARCH_ENDPOINTS = [
  '/v2/providers/affiliate_open_api/apis/openapi/products/search',
  '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search',
];

function loadLocalEnvFiles() {
  const envFiles = [
    { file: '.env.local', override: true },
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile.file);
    if (!fs.existsSync(envPath)) continue;

    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (!key) continue;
      if (process.env[key] && !envFile.override) continue;

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function getCoupangCredentials() {
  loadLocalEnvFiles();
  return {
    accessKey: process.env.COUPANG_ACCESS_KEY || '',
    secretKey: process.env.COUPANG_SECRET_KEY || '',
  };
}

function createAuthorization(method, path, query, datetime, accessKey, secretKey) {
  const message = `${datetime}${method.toUpperCase()}${path}${query}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function formatSignedDate(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function sanitizeKeyword(keyword) {
  return String(keyword || '')
    .replace(/[\[\]{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveFallbackBrand(productName) {
  const title = String(productName || '').trim();
  if (!title) return '';

  const cleaned = title.replace(/^\[[^\]]+\]\s*/, '').trim();
  const firstToken = cleaned.split(/\s+/)[0] || '';
  return firstToken.replace(/[^\p{Script=Hangul}a-zA-Z0-9]/gu, '').trim();
}

function normalizeSearchResponse(payload) {
  const productData = payload?.data?.productData || payload?.data || payload?.productData || [];
  if (!Array.isArray(productData)) return [];

  const asNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const asBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const v = String(value || '').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'y' || v === 'yes';
  };

  return productData
    .map((item) => {
      const productName = String(item.productName || item.title || '').trim();
      const brand = String(item.brand || item.brandName || item.manufacturer || item.vendorName || '').trim();
      const vendorName = String(item.vendorName || '').trim();
      const rating = asNumber(item.productRating || item.rating || item.star || 0);
      const reviewCount = asNumber(item.reviewCount || item.ratingCount || item.review || 0);

      return {
        productId: String(item.productId || item.itemId || item.id || '').trim(),
        productName,
        productImage: String(item.productImage || item.image || item.productImageUrl || '').trim(),
        productUrl: String(item.productUrl || item.url || item.productLink || '').trim(),
        affiliateUrl: String(item.productUrl || item.url || item.productLink || '').trim(),
        price: String(item.productPrice || item.salePrice || item.price || '').trim(),
        originalPrice: String(item.originalPrice || item.basePrice || '').trim(),
        rating,
        reviewCount,
        hasQualityMeta: rating > 0 || reviewCount > 0,
        rank: Number(item.rank || 0),
        isRocket: Boolean(item.isRocket || false),
        outOfStock: asBoolean(item.outOfStock || item.isOutOfStock || item.soldOut || false),
        brand: brand || deriveFallbackBrand(productName),
        vendorName,
      };
    })
    .filter((item) => item.productName && item.affiliateUrl);
}

async function searchProducts(keyword, options = {}) {
  const safeKeyword = sanitizeKeyword(keyword);
  if (!safeKeyword) return [];

  const { accessKey, secretKey } = getCoupangCredentials();
  if (!accessKey || !secretKey) {
    throw new Error('COUPANG_ACCESS_KEY 또는 COUPANG_SECRET_KEY가 없습니다.');
  }

  const limit = Math.max(1, Math.min(Number(options.limit || 3), 10));
  const imageSize = options.imageSize || '640x640';
  const subId = options.subId || 'picknjoy-choice';
  const sort = options.sort || 'bestAsc';
  const encodedKeyword = encodeURIComponent(safeKeyword);
  const query = `keyword=${encodedKeyword}&limit=${limit}&imageSize=${encodeURIComponent(imageSize)}&subId=${encodeURIComponent(subId)}&sort=${encodeURIComponent(sort)}`;

  let lastError = null;
  for (const endpoint of SEARCH_ENDPOINTS) {
    const pathWithQuery = `${endpoint}?${query}`;
    const datetime = formatSignedDate();
    const authorization = createAuthorization('GET', endpoint, query, datetime, accessKey, secretKey);

    const response = await fetch(`${COUPANG_API_HOST}${pathWithQuery}`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    });

    if (response.ok) {
      const payload = await response.json();
      return normalizeSearchResponse(payload);
    }

    const body = await response.text();
    lastError = new Error(`쿠팡 검색 API 오류 (${response.status}): ${body}`);
    if (response.status !== 404) break;
  }

  throw lastError || new Error('쿠팡 검색 API 호출에 실패했습니다.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  formatSignedDate,
  loadLocalEnvFiles,
  getCoupangCredentials,
  searchProducts,
  sleep,
};