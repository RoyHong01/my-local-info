export type LifeRegionTab = 'incheon-gyeongin' | 'seoul-gyeonggi';

export interface RestaurantItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  mapUrl: string;
  summary: string;
}

interface KakaoPlace {
  id: string;
  place_name: string;
  road_address_name?: string;
  address_name?: string;
  phone?: string;
  place_url: string;
}

const REGION_QUERY_MAP: Record<LifeRegionTab, string[]> = {
  'incheon-gyeongin': ['인천 맛집', '부천 맛집', '김포 맛집'],
  'seoul-gyeonggi': ['서울 맛집', '경기 맛집', '수원 맛집'],
};

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
  const base = `${placeName}은(는) ${address} 근처에서 동선이 좋아서 가볍게 들르기 편해요. 분위기와 접근성을 함께 챙기고 싶을 때 만족도가 높은 편입니다.`;
  return normalizeLineBreakBySentence(base);
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
  }));

  const prompt = [
    '당신은 30대 생활정보 에디터입니다.',
    '아래 JSON 배열의 각 맛집에 대해 감성적인 한 줄 요약을 작성해주세요.',
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

function toRestaurantItem(place: KakaoPlace): RestaurantItem {
  const address = (place.road_address_name || place.address_name || '').trim();
  return {
    id: String(place.id),
    name: place.place_name?.trim() || '이름 미상',
    address: address || '주소 정보 없음',
    phone: (place.phone || '').trim() || '전화번호 정보 없음',
    mapUrl: place.place_url || 'https://map.kakao.com/',
    summary: '',
  };
}

export async function getRestaurantsByRegion(region: LifeRegionTab): Promise<RestaurantItem[]> {
  if (!cache.has(region)) {
    cache.set(region, loadRestaurantsByRegion(region));
  }
  return cache.get(region)!;
}

async function loadRestaurantsByRegion(region: LifeRegionTab): Promise<RestaurantItem[]> {
  const kakaoKey = process.env.KAKAO_REST_API_KEY;

  if (!kakaoKey) {
    return REGION_FALLBACK[region];
  }

  try {
    const queries = REGION_QUERY_MAP[region];
    const results = await Promise.all(queries.map((query) => fetchKakaoByKeyword(query, kakaoKey)));

    const deduped = new Map<string, RestaurantItem>();
    for (const row of results.flat()) {
      if (!row.id) continue;
      if (!deduped.has(row.id)) {
        deduped.set(row.id, toRestaurantItem(row));
      }
      if (deduped.size >= 10) break;
    }

    const items = Array.from(deduped.values());
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
