function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const METRO_SHORT_NAMES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주'];
const PROVINCE_SHORT_NAMES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

function extractRegionTokens(text) {
  const src = normalizeSpace(text);
  if (!src) return [];

  const siGunGu = [...src.matchAll(/([가-힣]{2,}(?:시|군|구))/g)]
    .map((m) => m[1])
    .filter((token) => !/(광역시|특별시|특별자치시)$/.test(token));

  const metro = [...src.matchAll(/([가-힣]{2,}(?:특별시|광역시|특별자치시|특별자치도|도))/g)]
    .map((m) => m[1]);

  const provinceCity = [...src.matchAll(/([가-힣]{2,}시)/g)]
    .map((m) => m[1])
    .filter((token) => !/(특별시|광역시|특별자치시)$/.test(token));

  const shortMetros = [];
  for (const name of [...METRO_SHORT_NAMES, ...PROVINCE_SHORT_NAMES]) {
    const pattern = new RegExp(`(?:^|[^가-힣])${name}(?=[^가-힣]|$)`, 'g');
    if (pattern.test(src)) {
      shortMetros.push(name);
    }
  }

  return uniq([...siGunGu, ...metro, ...provinceCity, ...shortMetros]);
}

function stripAdministrativeSuffix(token) {
  const t = normalizeSpace(token);
  if (!t) return '';
  const suffixes = ['특별자치도', '특별자치시', '광역시', '특별시', '시', '군', '구', '도'];
  for (const suf of suffixes) {
    if (t.endsWith(suf) && t.length > suf.length) {
      const stripped = t.slice(0, -suf.length);
      if (stripped.length >= 2) return stripped;
    }
  }
  return t;
}

function buildKeywordCandidates(regionName) {
  const orig = normalizeSpace(regionName);
  if (!orig) return [];
  const first = orig.split(/\s+/)[0];
  const stripped = stripAdministrativeSuffix(first);
  const list = [first];
  if (stripped && stripped !== first) list.push(stripped);
  return uniq(list);
}

function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] || null;
}

async function fetchTourLandmarkCandidates(keyword, tourApiKey, { numOfRows = 15 } = {}) {
  if (!tourApiKey || !keyword) return [];

  const params = new URLSearchParams({
    serviceKey: tourApiKey,
    MobileOS: 'ETC',
    MobileApp: 'pick-n-joy',
    _type: 'json',
    keyword,
    contentTypeId: '12',
    numOfRows: String(numOfRows),
    pageNo: '1',
    arrange: 'Q',
  });

  const endpoint = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${params.toString()}`;
  const response = await fetch(endpoint);
  if (!response.ok) return [];

  const data = await response.json();
  const items = data?.response?.body?.items?.item || [];
  const list = Array.isArray(items) ? items : (items ? [items] : []);

  return list
    .map((item) => ({
      imageUrl: normalizeSpace(item?.firstimage || item?.firstimage2 || ''),
      matchedName: normalizeSpace(item?.title || ''),
      matchedAddr: normalizeSpace(item?.addr1 || ''),
    }))
    .filter((item) => item.imageUrl);
}

async function getRegionalLandmark(options) {
  const {
    regionName,
    tourApiKey,
    cache,
    numOfRows = 15,
    addressFilter,
  } = options || {};

  if (!tourApiKey) return null;
  const keywordVariants = buildKeywordCandidates(regionName);
  if (keywordVariants.length === 0) return null;

  const map = cache || new Map();

  for (const keyword of keywordVariants) {
    if (!map.has(keyword)) {
      const candidates = await fetchTourLandmarkCandidates(keyword, tourApiKey, { numOfRows });
      map.set(keyword, candidates);
    }
    let candidates = map.get(keyword) || [];
    if (addressFilter && candidates.length > 0) {
      const filtered = candidates.filter((c) => c.matchedAddr && c.matchedAddr.includes(addressFilter));
      if (filtered.length > 0) candidates = filtered;
    }
    const picked = pickRandom(candidates);
    if (picked) {
      return {
        ...picked,
        keyword,
        imageSource: '한국관광공사(TourAPI) 랜드마크',
        imageSourceApi: 'KorService2/searchKeyword2',
      };
    }
  }

  return null;
}

module.exports = {
  extractRegionTokens,
  stripAdministrativeSuffix,
  buildKeywordCandidates,
  getRegionalLandmark,
  METRO_SHORT_NAMES,
  PROVINCE_SHORT_NAMES,
};
