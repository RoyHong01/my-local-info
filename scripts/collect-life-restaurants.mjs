import fs from 'fs/promises';
import path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const MAX_ITEMS_PER_REGION = 15;

const REGION_QUERY_MAP = {
  'incheon-gyeongin': [
    '인천 찐맛집',
    '인천 현지인 맛집',
    '인천 줄서는 식당',
    '부천 찐맛집',
    '부천 현지인 맛집',
    '부천 줄서는 식당',
    '김포 찐맛집',
    '김포 현지인 맛집',
    '김포 줄서는 식당',
  ],
  'seoul-gyeonggi': [
    '서울 찐맛집',
    '서울 현지인 맛집',
    '서울 줄서는 식당',
    '경기 찐맛집',
    '경기 현지인 맛집',
    '경기 줄서는 식당',
    '수원 찐맛집',
    '수원 현지인 맛집',
    '수원 줄서는 식당',
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
  const base = `${placeName}은(는) ${address} 근처에서 동선이 좋아서 가볍게 들르기 편해요. 무엇을 먹을지 고민될 때 선택지가 명확해서 실패 확률을 줄이기 좋습니다.`;
  return normalizeLineBreakBySentence(base);
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

function toRestaurantItem(place) {
  const address = (place.road_address_name || place.address_name || '').trim();
  return {
    id: String(place.id),
    name: (place.place_name || '').trim() || '이름 미상',
    address: address || '주소 정보 없음',
    phone: (place.phone || '').trim() || '전화번호 정보 없음',
    mapUrl: place.place_url || 'https://map.kakao.com/',
    summary: '',
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
    '당신은 30대 생활정보 에디터입니다.',
    '아래 JSON 배열의 각 맛집에 대해 문제 해결형 서사 요약을 작성해주세요.',
    'mapUrl(place_url) 문맥을 참고해 리뷰 톤앤매너를 추론하되, 확인 불가 사실을 단정하지 마세요.',
    '반드시 "무엇을 먹을지/어디 갈지 고민" 같은 문제 제기를 한 문장 포함하세요.',
    '다음 문장에는 조사/검토 맥락(검색 상위 노출, 재방문 언급, 동선 장점 등)을 자연스럽게 포함하세요.',
    '문체 규칙:',
    '1) 반드시 친절한 경어체(~해요/~입니다)만 사용',
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
  const results = await Promise.all(queries.map((query) => fetchKakaoByKeyword(query, kakaoKey)));

  const deduped = new Map();
  for (const row of results.flat()) {
    if (!row.id) continue;
    if (!deduped.has(row.id)) {
      deduped.set(row.id, toRestaurantItem(row));
    }
    if (deduped.size >= MAX_ITEMS_PER_REGION) break;
  }

  const items = Array.from(deduped.values());
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
