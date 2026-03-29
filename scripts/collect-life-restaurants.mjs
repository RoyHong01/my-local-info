import fs from 'fs/promises';
import path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const MAX_ITEMS_PER_REGION = 15;

const REGION_QUERY_MAP = {
  'incheon-gyeongin': [
    { query: '송도 브런치 카페', scenarioHint: '주말 브런치 약속', vibeHint: '채광 좋은 브런치 무드', cuisineHint: '브런치' },
    { query: '송도 오픈런 파스타', scenarioHint: '데이트 코스 첫 식사', vibeHint: '오픈런 저장각 파스타', cuisineHint: '파스타' },
    { query: '청라 분위기 술집', scenarioHint: '퇴근 후 하이볼 한잔', vibeHint: '조도 낮은 저녁 약속', cuisineHint: '주점' },
    { query: '구월동 사진 잘 나오는 식당', scenarioHint: '사진 남기고 싶은 약속', vibeHint: '포토제닉 다이닝', cuisineHint: '다이닝' },
    { query: '부평 웨이팅 맛집', scenarioHint: '기다려서라도 가는 한 끼', vibeHint: '웨이팅 핫플', cuisineHint: '핫플 맛집' },
    { query: '부천 데이트 맛집', scenarioHint: '분위기 챙기는 데이트', vibeHint: '데이트 스팟', cuisineHint: '다이닝' },
    { query: '김포 파스타 맛집', scenarioHint: '가볍지 않게 식사하고 싶은 날', vibeHint: '클래식 양식 무드', cuisineHint: '파스타' },
    { query: '인천 내추럴 와인바', scenarioHint: '친구와 느슨한 저녁 모임', vibeHint: '와인바 감도', cuisineHint: '와인바' },
    { query: '송도 에스프레소 바', scenarioHint: '짧고 진한 카페 타임', vibeHint: '에스프레소 바', cuisineHint: '카페' },
  ],
  'seoul-gyeonggi': [
    { query: '성수동 팝업 근처 맛집', scenarioHint: '팝업 보고 바로 이어지는 식사', vibeHint: '성수 핫플 동선', cuisineHint: '다이닝' },
    { query: '성수 파스타 맛집', scenarioHint: '저장해둔 데이트 코스', vibeHint: '힙한 파스타 스팟', cuisineHint: '파스타' },
    { query: '연남동 웨이팅 맛집', scenarioHint: '줄 서도 납득되는 한 끼', vibeHint: '연남 웨이팅 핫플', cuisineHint: '핫플 맛집' },
    { query: '연남동 내추럴 와인바', scenarioHint: '2차까지 예쁘게 이어가는 밤', vibeHint: '와인바 무드', cuisineHint: '와인바' },
    { query: '강남역 사진 잘 나오는 식당', scenarioHint: '사진 남기는 모임', vibeHint: '포토제닉 다이닝', cuisineHint: '다이닝' },
    { query: '잠실 브런치 카페', scenarioHint: '주말 낮 약속', vibeHint: '브런치 카페', cuisineHint: '브런치' },
    { query: '수원 행궁동 분위기 술집', scenarioHint: '행궁동 저녁 코스', vibeHint: '감도 높은 주점', cuisineHint: '주점' },
    { query: '판교 데이트 맛집', scenarioHint: '퇴근 후 데이트', vibeHint: '깔끔한 데이트 스팟', cuisineHint: '다이닝' },
    { query: '성수 에스프레소 바', scenarioHint: '짧지만 강한 카페 타임', vibeHint: '에스프레소 바', cuisineHint: '카페' },
  ],
};

const REGION_LABEL = {
  'incheon-gyeongin': '인천/경인',
  'seoul-gyeonggi': '서울/경기',
};

function normalizeLineBreakBySentence(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';

  const sentences = trimmed
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);

  const chunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '));
  }

  const normalized = chunks.join('\n\n').trim();
  if (/(해요|어요|아요|입니다|있습니다|좋습니다|추천해요|권해요)\.?$/.test(normalized)) {
    return normalized;
  }
  return `${normalized} 방문해보셔도 좋아요.`;
}

function buildFallbackSummary(placeName, address) {
  const base = `${placeName}은(는) ${address} 근처에서 약속 동선을 짜기 편한 편이에요. 오늘 어디 갈지 빠르게 정하고 싶을 때 저장해둘 만한 후보가 되어줍니다.`;
  return normalizeLineBreakBySentence(base);
}

function getTrendScore(item, meta) {
  const text = [item.name, meta.query, meta.vibeHint, meta.cuisineHint].join(' ');
  let score = 0;
  if (/브런치|파스타|와인|에스프레소|팝업|사진|웨이팅|데이트|술집|카페/i.test(text)) score += 5;
  if (/본점|직영|오픈런/i.test(text)) score += 2;
  return score;
}

async function fetchKakaoByKeyword(query, apiKey) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('size', '15');
  url.searchParams.set('sort', 'accuracy');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403 && /NotAuthorizedError|OPEN_MAP_AND_LOCAL/i.test(errorText)) {
      throw new Error('Kakao Developers에서 OPEN_MAP_AND_LOCAL(카카오맵/로컬) 서비스 활성화가 필요합니다. 앱 설정을 확인해주세요.');
    }
    throw new Error(`Kakao API 오류(${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.documents || [];
}

function toRestaurantItem(place, meta) {
  const address = (place.road_address_name || place.address_name || '').trim();
  return {
    id: String(place.id),
    name: (place.place_name || '').trim() || '이름 미상',
    address: address || '주소 정보 없음',
    phone: (place.phone || '').trim() || '전화번호 정보 없음',
    mapUrl: place.place_url || 'https://map.kakao.com/',
    summary: '',
    sourceQuery: meta.query,
    scenarioHint: meta.scenarioHint,
    vibeHint: meta.vibeHint,
    cuisineHint: meta.cuisineHint,
  };
}

function extractJsonArray(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return null;
}

async function summarizeWithGemini(regionLabel, items, geminiKey) {
  if (!geminiKey || items.length === 0) return new Map();

  const safeInput = items.map((item) => ({
    id: item.id,
    name: item.name,
    address: item.address,
    phone: item.phone,
    mapUrl: item.mapUrl,
  }));

  const prompt = [
    '당신은 2030 취향을 잘 아는 맛집 큐레이터입니다.',
    '아래 JSON 배열의 각 맛집에 대해 카드용 한 줄 카피를 작성해주세요.',
    '진부한 표현("고민될 때가 종종 있어요", "방문해보셔도 좋아요")은 금지합니다.',
    'mapUrl(place_url)와 sourceQuery 문맥을 참고해 왜 저장해둘 만한지 짧고 세련되게 써주세요.',
    '과장/허위 없이, 빠르게 본론만 전달해주세요.',
    '문체 규칙:',
    '1) 반드시 가벼운 존댓말(~해요/~네요/~거든요) 사용',
    '2) 항목당 2~3문장',
    '3) 2문장마다 줄바꿈(\\n\\n) 적용',
    '4) 과장/허위 금지',
    '5) 반드시 JSON 배열만 반환',
    '반환 스키마: [{"id":"...","summary":"..."}]',
    `지역: ${regionLabel}`,
    '입력 데이터:',
    JSON.stringify(safeInput),
  ].join('\n');

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류(${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonText = extractJsonArray(text);
  if (!jsonText) return new Map();

  let parsed = [];
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return new Map();
  }

  const map = new Map();
  for (const row of parsed) {
    const id = String(row.id || '').trim();
    const summary = normalizeLineBreakBySentence(String(row.summary || '').trim());
    if (id && summary) {
      map.set(id, summary);
    }
  }

  return map;
}

async function collectRegion(region, kakaoKey, geminiKey) {
  const queries = REGION_QUERY_MAP[region];
  const results = await Promise.all(
    queries.map(async (meta) => ({ meta, places: await fetchKakaoByKeyword(meta.query, kakaoKey) }))
  );

  const deduped = new Map();
  for (const { meta, places } of results) {
    for (const row of places) {
      if (!row.id) continue;
      const item = toRestaurantItem(row, meta);
      const score = getTrendScore(item, meta);
      const existing = deduped.get(row.id);
      if (!existing || score > existing.score) {
        deduped.set(row.id, { item, score });
      }
    }
  }

  const items = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS_PER_REGION)
    .map((entry) => entry.item);
  if (items.length === 0) return [];

  let summaryMap = new Map();
  try {
    summaryMap = await summarizeWithGemini(REGION_LABEL[region], items, geminiKey);
  } catch (error) {
    console.warn(`[${region}] Gemini 요약 생성 실패, fallback 사용`, error?.message || error);
  }

  return items.map((item) => ({
    ...item,
    summary: summaryMap.get(item.id) || buildFallbackSummary(item.name, item.address),
  }));
}

async function run() {
  const kakaoKey = process.env.KAKAO_REST_API_KEY || process.env.KAKAO_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!kakaoKey) {
    console.error('KAKAO_REST_API_KEY(또는 KAKAO_API_KEY)가 없습니다. 수집을 중단합니다.');
    process.exit(1);
  }

  console.log('🥢 일상의 즐거움 맛집 데이터 수집 시작');

  const [incheon, seoul] = await Promise.all([
    collectRegion('incheon-gyeongin', kakaoKey, geminiKey),
    collectRegion('seoul-gyeonggi', kakaoKey, geminiKey),
  ]);

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'kakao+gemini',
    regions: {
      'incheon-gyeongin': incheon,
      'seoul-gyeonggi': seoul,
    },
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`✅ 저장 완료: ${OUTPUT_PATH}`);
  console.log(`   - 인천/경인: ${incheon.length}건`);
  console.log(`   - 서울/경기: ${seoul.length}건`);
}

run().catch((error) => {
  console.error('❌ 맛집 데이터 수집 실패', error);
  process.exit(1);
});
