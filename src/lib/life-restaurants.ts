import fs from 'fs/promises';
import path from 'path';

export type LifeRegionTab = 'incheon-gyeongin' | 'seoul-gyeonggi';

export interface RestaurantItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  mapUrl: string;
  summary: string;
  sourceQuery?: string;
  scenarioHint?: string;
  vibeHint?: string;
  cuisineHint?: string;
}

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name?: string;
  address_name?: string;
  phone?: string;
  place_url: string;
}

interface RegionQueryMeta {
  query: string;
  scenarioHint: string;
  vibeHint: string;
  cuisineHint: string;
}

const REGION_QUERY_MAP: Record<LifeRegionTab, RegionQueryMeta[]> = {
  'incheon-gyeongin': [
    { query: '송도 브런치 카페', scenarioHint: '주말 브런치 약속', vibeHint: '통창·채광', cuisineHint: '브런치·카페' },
    { query: '송도 오픈런 파스타', scenarioHint: '데이트 코스 첫 식사', vibeHint: '세련된 무드', cuisineHint: '파스타·양식' },
    { query: '청라 분위기 술집', scenarioHint: '2차까지 이어지는 저녁 약속', vibeHint: '무드 있는 저녁', cuisineHint: '와인바·주점' },
    { query: '구월동 사진 잘 나오는 식당', scenarioHint: '사진 남기고 싶은 약속', vibeHint: '포토제닉', cuisineHint: '트렌디 다이닝' },
    { query: '부평 웨이팅 맛집', scenarioHint: '줄 서도 한 번쯤 가볼 만한 곳 탐색', vibeHint: '핫플', cuisineHint: '인기 맛집' },
    { query: '부천 감성 카페 디저트', scenarioHint: '카페 투어 데이트', vibeHint: '디저트 감성', cuisineHint: '카페·디저트' },
    { query: '김포 데이트 맛집', scenarioHint: '드라이브 끝에 들를 저녁 코스', vibeHint: '편하게 분위기 내기 좋은', cuisineHint: '데이트 맛집' },
    { query: '을왕리 오션뷰 카페', scenarioHint: '바다 보고 쉬는 반나절 코스', vibeHint: '오션뷰', cuisineHint: '카페·브런치' },
  ],
  'seoul-gyeonggi': [
    { query: '성수동 팝업 근처 맛집', scenarioHint: '팝업 보고 바로 이어지는 식사', vibeHint: '힙한 동선', cuisineHint: '트렌디 다이닝' },
    { query: '연남동 웨이팅 맛집', scenarioHint: '주말에 줄 서서라도 가는 한 끼', vibeHint: '핫플', cuisineHint: '인기 맛집' },
    { query: '연남동 내추럴 와인바', scenarioHint: '저녁 데이트 2차', vibeHint: '와인 감성', cuisineHint: '와인바' },
    { query: '한남동 분위기 좋은 레스토랑', scenarioHint: '특별한 날 약속', vibeHint: '고급스럽고 세련된', cuisineHint: '레스토랑' },
    { query: '강남역 사진 잘 나오는 식당', scenarioHint: '친구랑 기분 내는 약속', vibeHint: '포토제닉', cuisineHint: '트렌디 다이닝' },
    { query: '망원동 에스프레소 바', scenarioHint: '짧고 진한 카페 투어', vibeHint: '힙한 카페 무드', cuisineHint: '커피·디저트' },
    { query: '수원 행궁동 분위기 술집', scenarioHint: '행궁동 산책 후 저녁', vibeHint: '감성적인 저녁', cuisineHint: '와인바·주점' },
    { query: '판교 브런치 맛집', scenarioHint: '주말 낮 약속', vibeHint: '깔끔한 브런치 무드', cuisineHint: '브런치·카페' },
  ],
};

const SNAPSHOT_PATH = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const MAX_ITEMS_PER_REGION = 15;

const REGION_FALLBACK: Record<LifeRegionTab, RestaurantItem[]> = {
  'incheon-gyeongin': [
    {
      id: 'fallback-icn-1',
      name: '송도 센트럴파크 근처 로컬 맛집',
      address: '인천 연수구 송도동 일대',
      phone: '정보 확인 필요',
      mapUrl: 'https://map.kakao.com/',
      summary: '산책 동선이 좋아서 주말 브런치 코스로 넣기 편해요.\n\n분위기와 접근성이 균형 잡혀 있어 가볍게 방문하기 좋습니다.',
    },
    {
      id: 'fallback-icn-2',
      name: '부평 로데오 거리 가성비 맛집',
      address: '인천 부평구 부평동 일대',
      phone: '정보 확인 필요',
      mapUrl: 'https://map.kakao.com/',
      summary: '가격 부담을 줄이면서도 메뉴 선택 폭이 넓은 편이에요.\n\n퇴근 후 짧게 들르기에도 동선이 괜찮아서 만족도가 높습니다.',
    },
  ],
  'seoul-gyeonggi': [
    {
      id: 'fallback-sgg-1',
      name: '서울 성수 감성 다이닝 맛집',
      address: '서울 성동구 성수동 일대',
      phone: '정보 확인 필요',
      mapUrl: 'https://map.kakao.com/',
      summary: '가게 분위기와 플레이팅이 좋아서 데이트 코스로 추천하기 좋아요.\n\n대기 시간을 감안해도 한 번쯤 방문해볼 만합니다.',
    },
    {
      id: 'fallback-sgg-2',
      name: '수원 행궁동 로컬 맛집',
      address: '경기 수원시 팔달구 행궁동 일대',
      phone: '정보 확인 필요',
      mapUrl: 'https://map.kakao.com/',
      summary: '화성 산책 코스와 함께 묶기 좋아서 하루 일정이 깔끔하게 정리돼요.\n\n주말에는 이른 시간에 방문하면 훨씬 여유롭게 즐길 수 있습니다.',
    },
  ],
};

const cache = new Map<LifeRegionTab, Promise<RestaurantItem[]>>();

interface RestaurantSnapshotData {
  updatedAt: string;
  regions: Partial<Record<LifeRegionTab, RestaurantItem[]>>;
}

async function readSnapshotRegion(region: LifeRegionTab): Promise<RestaurantItem[] | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as RestaurantSnapshotData;
    const items = parsed?.regions?.[region];
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }
    return items
      .filter((item) => item?.id && item?.name && item?.address && item?.mapUrl)
      .map((item) => ({
        ...item,
        summary: item.summary || buildFallbackSummary(item.name, item.address),
      }));
  } catch {
    return null;
  }
}

function normalizeLineBreakBySentence(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  const sentences = trimmed
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);

  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '));
  }

  const normalized = chunks.join('\n\n').trim();

  if (/(해요|어요|아요|입니다|있습니다|좋습니다|추천해요|권해요)\.?$/.test(normalized)) {
    return normalized;
  }

  return `${normalized} 방문해보셔도 좋아요.`;
}

function buildFallbackSummary(placeName: string, address: string): string {
  const base = `${placeName}은(는) ${address} 근처에서 약속 잡을 때 한 번 체크해보기 좋은 곳이에요. 너무 과장된 설명보다 동선이 편하고 분위기 괜찮은 곳 찾을 때 무난하게 보기 좋습니다.`;
  return normalizeLineBreakBySentence(base);
}

function getTrendScore(item: RestaurantItem): number {
  const source = `${item.sourceQuery || ''} ${item.name} ${item.summary} ${item.vibeHint || ''} ${item.cuisineHint || ''}`.toLowerCase();
  const tokens = ['브런치', '파스타', '와인', '에스프레소', '팝업', '사진', '웨이팅', '데이트', '술집', '카페'];
  return tokens.reduce((score, token) => score + (source.includes(token) ? 1 : 0), 0);
}

async function fetchKakaoByKeyword(query: string, apiKey: string): Promise<KakaoPlace[]> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('size', '15');
  url.searchParams.set('sort', 'accuracy');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403 && /NotAuthorizedError|OPEN_MAP_AND_LOCAL/i.test(errorText)) {
      throw new Error('Kakao Developers에서 OPEN_MAP_AND_LOCAL(카카오맵/로컬) 서비스 활성화가 필요합니다.');
    }
    throw new Error(`Kakao API 오류(${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { documents?: KakaoPlace[] };
  return data.documents || [];
}

function extractJsonArray(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return null;
}

async function summarizeWithGemini(regionLabel: string, items: RestaurantItem[]): Promise<Map<string, string>> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || items.length === 0) {
    return new Map();
  }

  const safeInput = items.map((item) => ({
    id: item.id,
    name: item.name,
    address: item.address,
    phone: item.phone,
    mapUrl: item.mapUrl,
    sourceQuery: item.sourceQuery || '',
    scenarioHint: item.scenarioHint || '',
    vibeHint: item.vibeHint || '',
    cuisineHint: item.cuisineHint || '',
  }));

  const prompt = [
    '당신은 2030 독자를 위한 라이프스타일 큐레이터입니다.',
    '아래 JSON 배열의 각 맛집에 대해 카드형 요약을 작성해주세요.',
    '중요: 제공된 sourceQuery, scenarioHint, vibeHint, cuisineHint를 참고하되, 입력 데이터로 확인되지 않는 사실은 절대 단정하지 마세요.',
    '문체 방향: 너무 교과서적이지 않게, 실제로 저장해둘 만한 곳처럼 짧고 리듬감 있게 작성해주세요.',
    '각 항목은 2문장으로 작성하고, 2문장 사이에 반드시 줄바꿈(\\n\\n)을 넣어주세요.',
    '첫 문장은 어떤 상황에서 보기 좋은지, 두 번째 문장은 분위기/동선/메뉴 결을 자연스럽게 정리해주세요.',
    '금지: "방문해보셔도 좋아요", "만족도가 높습니다", "추천합니다"처럼 뻔한 마무리.',
    '반드시 JSON 배열만 반환하세요.',
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
        maxOutputTokens: 2048,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류(${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonText = extractJsonArray(text);
  if (!jsonText) {
    return new Map();
  }

  let parsed: Array<{ id?: string; summary?: string }> = [];
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of parsed) {
    const id = String(row.id || '').trim();
    const summary = normalizeLineBreakBySentence(String(row.summary || '').trim());
    if (id && summary) {
      map.set(id, summary);
    }
  }
  return map;
}

function toRestaurantItem(place: KakaoPlace, meta: RegionQueryMeta): RestaurantItem {
  const address = (place.road_address_name || place.address_name || '').trim();
  return {
    id: String(place.id),
    name: place.place_name?.trim() || '이름 미상',
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

export async function getRestaurantsByRegion(region: LifeRegionTab): Promise<RestaurantItem[]> {
  if (!cache.has(region)) {
    cache.set(region, loadRestaurantsByRegion(region));
  }
  return cache.get(region)!;
}

async function loadRestaurantsByRegion(region: LifeRegionTab): Promise<RestaurantItem[]> {
  const snapshotItems = await readSnapshotRegion(region);
  if (snapshotItems && snapshotItems.length > 0) {
    return snapshotItems;
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoKey) {
    return REGION_FALLBACK[region];
  }

  try {
    const queries = REGION_QUERY_MAP[region];
    const results = await Promise.all(
      queries.map(async (meta) => ({
        meta,
        places: await fetchKakaoByKeyword(meta.query, kakaoKey),
      }))
    );

    const deduped = new Map<string, RestaurantItem>();
    for (const { meta, places } of results) {
      for (const row of places) {
        if (!row.id) continue;
        const nextItem = toRestaurantItem(row, meta);
        const currentItem = deduped.get(row.id);
        if (!currentItem || getTrendScore(nextItem) > getTrendScore(currentItem)) {
          deduped.set(row.id, nextItem);
        }
      }
    }

    const items = Array.from(deduped.values())
      .sort((a, b) => getTrendScore(b) - getTrendScore(a))
      .slice(0, MAX_ITEMS_PER_REGION);

    if (items.length === 0) {
      return REGION_FALLBACK[region];
    }

    let summaryMap = new Map<string, string>();
    try {
      summaryMap = await summarizeWithGemini(region === 'incheon-gyeongin' ? '인천/경인' : '서울/경기', items);
    } catch {
      summaryMap = new Map();
    }

    return items.map((item) => ({
      ...item,
      summary: summaryMap.get(item.id) || buildFallbackSummary(item.name, item.address),
    }));
  } catch {
    return REGION_FALLBACK[region];
  }
}
