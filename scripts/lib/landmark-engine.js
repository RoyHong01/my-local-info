function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const METRO_SHORT_NAMES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주'];
const PROVINCE_SHORT_NAMES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

const PROVINCE_FULL_TO_SHORT = {
  '경상남도': '경남',
  '경상북도': '경북',
  '충청남도': '충남',
  '충청북도': '충북',
  '전라남도': '전남',
  '전라북도': '전북',
  '강원특별자치도': '강원',
  '제주특별자치도': '제주',
  '제주도': '제주',
  '경기도': '경기',
};

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

/**
 * 광역(시·도) 단위만 추출. 구(區) 토큰은 모두 무시.
 * - "인천 연수구" -> ["인천"]
 * - "서울 강북구" -> ["서울"]
 * - "경기 광주시" -> ["경기"]   (광주 모호성: 경기 컨텍스트면 광주 제외)
 * - "광주광역시 동구" -> ["광주"]
 * - "군산시 청년", "안동시" -> ["군산"], ["안동"]   (광역 정보 없을 때만 시·군 폴백)
 * - "대구광역시" -> ["대구"]
 */
function extractMetroFromText(text) {
  const src = normalizeSpace(text);
  if (!src) return [];

  const result = [];
  const seen = new Set();
  const push = (name) => {
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  };

  // 1순위: 광역시/특별시 풀네임 (예: 광주광역시 -> 광주)
  for (const m of src.matchAll(/([가-힣]{2,}(?:특별시|광역시|특별자치시))/g)) {
    push(stripAdministrativeSuffix(m[1]));
  }

  // 2순위: 도 풀네임 (예: 경기도, 충청남도, 강원특별자치도)
  for (const m of src.matchAll(/([가-힣]{2,}(?:특별자치도|도))/g)) {
    const full = m[1];
    const mapped = PROVINCE_FULL_TO_SHORT[full];
    if (mapped) {
      push(mapped);
    } else {
      const stripped = stripAdministrativeSuffix(full);
      if (METRO_SHORT_NAMES.includes(stripped) || PROVINCE_SHORT_NAMES.includes(stripped)) {
        push(stripped);
      }
    }
  }

  // 3순위: 약칭 (단어 경계)
  for (const name of [...METRO_SHORT_NAMES, ...PROVINCE_SHORT_NAMES]) {
    if (seen.has(name)) continue;
    const pattern = new RegExp(`(?:^|[^가-힣])${name}(?=[^가-힣]|$)`);
    if (!pattern.test(src)) continue;
    // 광주 모호성: 경기 컨텍스트에서 광주 약칭은 "경기 광주시" 가능성 -> 광주광역시 명시 없으면 제외
    if (name === '광주' && seen.has('경기') && !/광주광역시/.test(src)) continue;
    push(name);
  }

  // 4순위(폴백): 광역 정보 자체가 없을 때만 독립 시·군 추출 (도 산하 시·군 가정)
  if (result.length === 0) {
    for (const m of src.matchAll(/([가-힣]{2,}(?:시|군))/g)) {
      const token = m[1];
      // 광역시/특별시 접미사는 위에서 처리됨
      if (/(광역시|특별시|특별자치시)$/.test(token)) continue;
      const stripped = stripAdministrativeSuffix(token);
      if (!stripped || stripped.length < 2) continue;
      // 광주는 모호하므로 단독 시 폴백에서도 제외
      if (stripped === '광주') continue;
      push(stripped);
    }
  }

  return result;
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
  extractMetroFromText,
  stripAdministrativeSuffix,
  buildKeywordCandidates,
  getRegionalLandmark,
  METRO_SHORT_NAMES,
  PROVINCE_SHORT_NAMES,
};
