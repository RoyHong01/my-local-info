function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const METRO_SHORT_NAMES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주'];
const PROVINCE_SHORT_NAMES = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

// 광역별 큐레이션된 랜드마크 키워드 풀.
// TourAPI(searchKeyword2)에서 실제 검색 가능한 "장소명"이며,
// 단순 지역명 검색이 가져오는 노이즈 사진(둘레길 표지판, 이름표 등)을 막기 위한 것.
const REGION_LANDMARKS = {
  서울: ['경복궁', '남산서울타워', '광화문', '북촌한옥마을', '청계천', '덕수궁', '창덕궁'],
  인천: ['송도센트럴파크', '인천대교', '차이나타운', '월미도', '소래포구', '강화도'],
  부산: ['해운대해수욕장', '광안대교', '감천문화마을', '태종대', '용두산공원', '오륙도'],
  대구: ['팔공산', '동성로', '앞산공원', '서문시장', '이월드'],
  대전: ['한밭수목원', '엑스포과학공원', '계룡산', '유성온천'],
  광주: ['무등산', '국립아시아문화전당', '양림동역사문화마을', '광주호수생태원'],
  울산: ['태화강국가정원', '대왕암공원', '간절곶', '영남알프스'],
  세종: ['세종호수공원', '국립세종수목원', '베어트리파크'],
  제주: ['성산일출봉', '한라산', '협재해수욕장', '만장굴', '천지연폭포', '용두암', '우도'],
  경기: ['수원화성', '에버랜드', '임진각', '광명동굴', '남한산성', '한국민속촌', '두물머리'],
  강원: ['설악산', '경포대', '남이섬', '정동진', '대관령', '오죽헌', '소금강'],
  충북: ['청남대', '단양팔경', '속리산', '소백산', '도담삼봉'],
  충남: ['독립기념관', '안면도', '부소산성', '국립공주박물관', '대천해수욕장'],
  전북: ['전주한옥마을', '마이산', '내장산', '변산반도', '덕유산'],
  전남: ['순천만', '담양죽녹원', '여수밤바다', '보성녹차밭', '해남땅끝마을'],
  경북: ['불국사', '첨성대', '안동하회마을', '도산서원', '석굴암', '주왕산'],
  경남: ['진주성', '통영케이블카', '외도보타니아', '거제도', '합천해인사'],
};

// 주제 키워드 → 어울리는 랜드마크 풀. (지역 정보가 없는 전국 보조금에 사용)
// 본문/제목/태그에서 키워드 매칭 시 우선 적용.
const THEME_LANDMARKS = {
  바다: ['해운대해수욕장', '경포대', '여수밤바다', '협재해수욕장', '소래포구', '대왕암공원', '안면도', '정동진', '대천해수욕장'],
  어업: ['소래포구', '주문진항', '강구항', '구룡포항', '여수밤바다'],
  농업: ['보성녹차밭', '담양죽녹원', '함양상림'],
  산림: ['설악산', '한라산', '지리산', '속리산', '소백산', '주왕산'],
};

// 본문 키워드 → 테마 매핑
const THEME_KEYWORD_MAP = [
  { theme: '바다', patterns: [/어선/, /어업/, /수산/, /해양수산부/, /어민/, /해녀/, /양식/] },
  { theme: '어업', patterns: [/어선/, /어촌/, /어항/] },
  { theme: '농업', patterns: [/농업/, /농민/, /농촌/, /농가/, /농작물/] },
  { theme: '산림', patterns: [/산림/, /임업/, /숲/, /산촌/] },
];

function detectThemeFromText(text) {
  const src = String(text || '');
  for (const { theme, patterns } of THEME_KEYWORD_MAP) {
    if (patterns.some((p) => p.test(src))) return theme;
  }
  return null;
}

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

// 광역도 산하 시·군 -> 부모 광역 매핑.
// 본문에 광역(경기/강원 등) 표기가 빠진 경우에도 부모 광역 사진을 우선 사용해 노이즈를 방지.
// 충돌 키(광주: 광역시 vs 경기 광주시 / 고성: 강원 vs 경남 / 군위: 대구)는 의도적으로 제외.
const CITY_TO_PROVINCE = {
  // 경기
  수원: '경기', 성남: '경기', 용인: '경기', 부천: '경기', 안산: '경기', 안양: '경기',
  남양주: '경기', 화성: '경기', 평택: '경기', 의정부: '경기', 시흥: '경기', 파주: '경기',
  김포: '경기', 광명: '경기', 군포: '경기', 하남: '경기', 오산: '경기', 양주: '경기',
  이천: '경기', 구리: '경기', 안성: '경기', 포천: '경기', 의왕: '경기', 양평: '경기',
  여주: '경기', 동두천: '경기', 가평: '경기', 과천: '경기', 연천: '경기',
  // 강원
  춘천: '강원', 원주: '강원', 강릉: '강원', 동해: '강원', 태백: '강원', 속초: '강원',
  삼척: '강원', 홍천: '강원', 횡성: '강원', 영월: '강원', 평창: '강원', 정선: '강원',
  철원: '강원', 화천: '강원', 양구: '강원', 인제: '강원', 양양: '강원',
  // 충북
  청주: '충북', 충주: '충북', 제천: '충북', 보은: '충북', 옥천: '충북', 영동: '충북',
  증평: '충북', 진천: '충북', 괴산: '충북', 음성: '충북', 단양: '충북',
  // 충남
  천안: '충남', 공주: '충남', 보령: '충남', 아산: '충남', 서산: '충남', 논산: '충남',
  계룡: '충남', 당진: '충남', 금산: '충남', 부여: '충남', 서천: '충남', 청양: '충남',
  홍성: '충남', 예산: '충남', 태안: '충남',
  // 전북
  전주: '전북', 군산: '전북', 익산: '전북', 정읍: '전북', 남원: '전북', 김제: '전북',
  완주: '전북', 진안: '전북', 무주: '전북', 장수: '전북', 임실: '전북', 순창: '전북',
  고창: '전북', 부안: '전북',
  // 전남
  목포: '전남', 여수: '전남', 순천: '전남', 나주: '전남', 광양: '전남', 담양: '전남',
  곡성: '전남', 구례: '전남', 고흥: '전남', 보성: '전남', 화순: '전남', 장흥: '전남',
  강진: '전남', 해남: '전남', 영암: '전남', 무안: '전남', 함평: '전남', 영광: '전남',
  장성: '전남', 완도: '전남', 진도: '전남', 신안: '전남',
  // 경북
  포항: '경북', 경주: '경북', 김천: '경북', 안동: '경북', 구미: '경북', 영주: '경북',
  영천: '경북', 상주: '경북', 문경: '경북', 경산: '경북', 의성: '경북', 청송: '경북',
  영양: '경북', 영덕: '경북', 청도: '경북', 고령: '경북', 성주: '경북', 칠곡: '경북',
  예천: '경북', 봉화: '경북', 울진: '경북', 울릉: '경북',
  // 경남
  창원: '경남', 진주: '경남', 통영: '경남', 사천: '경남', 김해: '경남', 밀양: '경남',
  거제: '경남', 양산: '경남', 의령: '경남', 함안: '경남', 창녕: '경남', 남해: '경남',
  하동: '경남', 산청: '경남', 함양: '경남', 거창: '경남', 합천: '경남',
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
      // 부모 광역도가 있으면 광역도 우선 (예: 군포 -> 경기 우선, 군포는 보조)
      const parent = CITY_TO_PROVINCE[stripped];
      if (parent) push(parent);
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    theme,
  } = options || {};

  if (!tourApiKey) return null;

  // 1순위: theme 풀 (예: 어선/수산 → 바다 풀)
  // 2순위: REGION_LANDMARKS[광역] 큐레이션 풀
  // 3순위: 기존 동작 (지역명 자체로 검색) — 최후 폴백
  const keywordVariants = [];

  if (theme && THEME_LANDMARKS[theme]) {
    keywordVariants.push(...shuffle(THEME_LANDMARKS[theme]));
  }

  const regionShort = stripAdministrativeSuffix(normalizeSpace(regionName).split(/\s+/)[0]);
  if (regionShort && REGION_LANDMARKS[regionShort]) {
    keywordVariants.push(...shuffle(REGION_LANDMARKS[regionShort]));
  }

  // 폴백: 기존 지역명 키워드
  for (const kw of buildKeywordCandidates(regionName)) {
    if (!keywordVariants.includes(kw)) keywordVariants.push(kw);
  }

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
  detectThemeFromText,
  REGION_LANDMARKS,
  THEME_LANDMARKS,
  METRO_SHORT_NAMES,
  PROVINCE_SHORT_NAMES,
};
