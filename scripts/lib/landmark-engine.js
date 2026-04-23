function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

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

  return uniq([...siGunGu, ...metro, ...provinceCity]);
}

function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] || null;
}

function buildTourKeyword(regionName) {
  // TourAPI searchKeyword2는 다중 단어 검색에서 0건을 반환하므로 단순 지역명만 사용
  // "강릉" → "강릉 관광" 변환은 0건 결과를 야기함
  // 해결: 단일 토큰 사용 (강릉, 서울, 제주 등)
  const region = normalizeSpace(regionName);
  if (!region) return '';
  // Strip any trailing keywords to ensure single-word search
  return region.split(/\s+/)[0];
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
  } = options || {};

  const keyword = buildTourKeyword(regionName);
  if (!keyword || !tourApiKey) return null;

  const map = cache || new Map();
  if (!map.has(keyword)) {
    const candidates = await fetchTourLandmarkCandidates(keyword, tourApiKey, { numOfRows });
    map.set(keyword, candidates);
  }

  const picked = pickRandom(map.get(keyword) || []);
  if (!picked) return null;

  return {
    ...picked,
    keyword,
    imageSource: '한국관광공사(TourAPI) 랜드마크',
    imageSourceApi: 'KorService2/searchKeyword2',
  };
}

module.exports = {
  extractRegionTokens,
  getRegionalLandmark,
};
