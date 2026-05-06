import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const OUTPUT_PATH = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const MAX_ITEMS_PER_REGION = 30;
const GOOGLE_PRE_FILTER_SIZE = 50;  // Google 필터 전 Kakao 후보 최대 수
const GOOGLE_PLACES_MIN_RATING = 4.2; // 구글 평점 최소 기준
const GOOGLE_PLACES_MIN_REVIEW_COUNT = Number(process.env.GOOGLE_PLACES_MIN_REVIEW_COUNT || 10); // 구글 리뷰 수 최소 기준
const BACKFILL_EXISTING_GOOGLE_PHOTOS_ONLY = process.env.BACKFILL_EXISTING_GOOGLE_PHOTOS_ONLY === 'true';
const BACKFILL_NAVER_PHOTOS_ONLY = process.env.BACKFILL_NAVER_PHOTOS_ONLY === 'true';
// 수집 단계 전용 모델 fallback: 카카오 후보 검토·요약 목적 (글 생성 없음) → 1.5-flash로 충분.
// Gemini 3.1 Flash-Lite Preview를 기본 모델로 사용하고, 필요 시 env로 2.5 Flash-Lite를 지정해 내려갈 수 있다.
// CI에서는 RESTAURANT_GEMINI_MODEL env가 우선 주입되며, 아래 값은 로컬 미설정 시에만 사용된다.
const RESTAURANT_GEMINI_MODEL_FALLBACK = 'gemini-3.1-flash-lite-preview';

const supabaseWarnState = {
  cacheReadFailure: 0,
  cacheReadException: 0,
  cacheUpsertFailure: 0,
  cacheUpsertException: 0,
};

function warnSupabaseOnce(kind, message, detail) {
  supabaseWarnState[kind] = Number(supabaseWarnState[kind] || 0) + 1;
  if (supabaseWarnState[kind] !== 1) return;

  console.warn(message, detail);
  console.warn('[Supabase] 동일 유형 경고는 이번 실행에서 1회만 출력됩니다.');
}

function createSupabaseCacheClient() {
  const supabaseUrl = process.env.PICKNJOY_SUPABASE_URL;
  const supabaseSecret = process.env.PICKNJOY_SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret) return null;

  try {
    return createClient(supabaseUrl, supabaseSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    console.warn('[Supabase] 클라이언트 초기화 실패:', error?.message || error);
    return null;
  }
}

async function getCachedRestaurantRating(supabase, kakaoId) {
  if (!supabase || !kakaoId) return null;

  try {
    const { data, error } = await supabase
      .from('restaurants_cache')
      .select('kakao_id, place_id, rating, user_rating_count')
      .eq('kakao_id', String(kakaoId))
      .maybeSingle();

    if (error) {
      warnSupabaseOnce(
        'cacheReadFailure',
        `[Supabase] 캐시 조회 실패(${kakaoId}):`,
        error.message || error,
      );
      return null;
    }

    const placeId = String(data?.place_id || '').trim();
    const rating = typeof data?.rating === 'number' ? data.rating : Number(data?.rating);
    const ratingCount = typeof data?.user_rating_count === 'number'
      ? data.user_rating_count
      : Number(data?.user_rating_count);

    if (!placeId || Number.isNaN(rating)) return null;

    return {
      placeId,
      rating,
      ratingCount: Number.isNaN(ratingCount) ? null : ratingCount,
    };
  } catch (error) {
    warnSupabaseOnce(
      'cacheReadException',
      `[Supabase] 캐시 조회 예외(${kakaoId}):`,
      error?.message || error,
    );
    return null;
  }
}

async function upsertRestaurantRatingCache(supabase, item, googleResult) {
  if (!supabase || !item?.id || !googleResult?.placeId || typeof googleResult?.rating !== 'number') {
    return;
  }

  try {
    const { error } = await supabase
      .from('restaurants_cache')
      .upsert({
        kakao_id: String(item.id),
        place_id: String(googleResult.placeId),
        rating: googleResult.rating,
        user_rating_count: googleResult.userRatingCount ?? null,
      }, { onConflict: 'kakao_id' });

    if (error) {
      warnSupabaseOnce(
        'cacheUpsertFailure',
        `[Supabase] 캐시 upsert 실패(${item.id}):`,
        error.message || error,
      );
    }
  } catch (error) {
    warnSupabaseOnce(
      'cacheUpsertException',
      `[Supabase] 캐시 upsert 예외(${item.id}):`,
      error?.message || error,
    );
  }
}

function mergeCacheMetrics(base, addition) {
  return {
    cacheHit: Number(base?.cacheHit || 0) + Number(addition?.cacheHit || 0),
    cacheMiss: Number(base?.cacheMiss || 0) + Number(addition?.cacheMiss || 0),
    googleCalled: Number(base?.googleCalled || 0) + Number(addition?.googleCalled || 0),
  };
}

function appendGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  try {
    fsSync.appendFileSync(outputPath, `${name}=${value}\n`, 'utf-8');
  } catch (error) {
    console.warn(`[GitHub Output] ${name} 기록 실패:`, error?.message || error);
  }
}

async function readExistingRestaurantsPayload() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`기존 restaurants.json 로드 실패: ${error?.message || error}`);
  }
}

// ─── 전국 프렌차이즈 블랙리스트 ─────────────────────────────────────────────
// 로컬 맛집 큐레이션 취지에 맞지 않는 전국 프렌차이즈 브랜드를 수집 단계에서 차단한다.
const FRANCHISE_BLACKLIST = [
  '이디야', '메가커피', '빽다방', '백다방', '컴포즈커피', '컴포즈', '더벤티',
  '투썸플레이스', '스타벅스', '커피빈', '커피베이', '공차', '할리스',
  '파리바게뜨', '뚜레쥬르', '브레댄코',
  '맥도날드', '버거킹', '롯데리아', 'KFC', '맘스터치', '써브웨이', '서브웨이',
  '배스킨라빈스', '던킨', '크리스피크림',
];

function isFranchise(name) {
  const n = String(name || '').trim();
  return FRANCHISE_BLACKLIST.some((kw) => n.includes(kw));
}

const REGION_QUERY_MAP = {
  'incheon': [
    { query: '송도 브런치 카페', scenarioHint: '주말 브런치 약속', vibeHint: '채광 좋은 브런치 무드', cuisineHint: '브런치' },
    { query: '송도 오마카세', scenarioHint: '기념일 저녁 약속', vibeHint: '집중도 높은 다이닝', cuisineHint: '오마카세' },
    { query: '청라 브런치 맛집', scenarioHint: '주말 브런치 약속', vibeHint: '여유로운 신도시 브런치', cuisineHint: '브런치' },
    { query: '인천 퓨전 한식 맛집', scenarioHint: '한식인데 새롭게 먹고 싶은 날', vibeHint: '트렌디 한식 다이닝', cuisineHint: '퓨전 한식' },
    { query: '인천 화덕피자 맛집', scenarioHint: '캐주얼하지만 무드 있는 저녁', vibeHint: '따뜻한 오븐 무드', cuisineHint: '화덕피자' },
    { query: '청라 분위기 술집', scenarioHint: '퇴근 후 하이볼 한잔', vibeHint: '조도 낮은 저녁 약속', cuisineHint: '주점' },
    { query: '구월동 사진 잘 나오는 식당', scenarioHint: '사진 남기고 싶은 약속', vibeHint: '포토제닉 다이닝', cuisineHint: '다이닝' },
    { query: '부평 웨이팅 맛집', scenarioHint: '기다려서라도 가는 한 끼', vibeHint: '웨이팅 핫플', cuisineHint: '핫플 맛집' },
    { query: '인천 내추럴 와인바', scenarioHint: '친구와 느슨한 저녁 모임', vibeHint: '와인바 감도', cuisineHint: '와인바' },
    { query: '영종도 바다뷰 카페', scenarioHint: '드라이브 후 카페 타임', vibeHint: '바다뷰 감성 카페', cuisineHint: '카페' },
    { query: '인천 스테이크 맛집', scenarioHint: '특별한 날 고기 한 판', vibeHint: '스테이크 다이닝', cuisineHint: '스테이크' },
    { query: '주안 맛집', scenarioHint: '동네 숨은 맛집 탐방', vibeHint: '로컬 핫플', cuisineHint: '한식' },
    { query: '인천 일식 오마카세', scenarioHint: '일식 코스가 땡기는 날', vibeHint: '정갈한 일식 다이닝', cuisineHint: '일식' },
    { query: '동인천 노포 맛집', scenarioHint: '클래식한 한 끼가 당기는 날', vibeHint: '오래된 로컬 노포 감성', cuisineHint: '한식' },
    { query: '인천 태국음식 맛집', scenarioHint: '이국적인 한 끼', vibeHint: '동남아 무드', cuisineHint: '태국음식' },
  ],
  'seoul': [
    { query: '성수동 팝업 근처 맛집', scenarioHint: '팝업 보고 바로 이어지는 식사', vibeHint: '성수 핫플 동선', cuisineHint: '다이닝' },
    { query: '성수 오마카세', scenarioHint: '분위기 잡는 저녁 약속', vibeHint: '긴장감 있는 코스 다이닝', cuisineHint: '오마카세' },
    { query: '성수 파스타 맛집', scenarioHint: '저장해둔 데이트 코스', vibeHint: '힙한 파스타 스팟', cuisineHint: '파스타' },
    { query: '연남동 퓨전 한식', scenarioHint: '익숙한 메뉴를 새롭게 먹고 싶은 날', vibeHint: '트렌디 한식 감도', cuisineHint: '퓨전 한식' },
    { query: '서울 화덕피자 맛집', scenarioHint: '캐주얼 데이트 저녁', vibeHint: '바삭한 피자 무드', cuisineHint: '화덕피자' },
    { query: '연남동 웨이팅 맛집', scenarioHint: '줄 서도 납득되는 한 끼', vibeHint: '연남 웨이팅 핫플', cuisineHint: '핫플 맛집' },
    { query: '연남동 내추럴 와인바', scenarioHint: '2차까지 예쁘게 이어가는 밤', vibeHint: '와인바 무드', cuisineHint: '와인바' },
    { query: '강남역 사진 잘 나오는 식당', scenarioHint: '사진 남기는 모임', vibeHint: '포토제닉 다이닝', cuisineHint: '다이닝' },
    { query: '잠실 브런치 카페', scenarioHint: '주말 낮 약속', vibeHint: '브런치 카페', cuisineHint: '브런치' },
    { query: '성수 에스프레소 바', scenarioHint: '짧지만 강한 카페 타임', vibeHint: '에스프레소 바', cuisineHint: '카페' },
    { query: '홍대 맛집', scenarioHint: '약속 동선 짜기 편한 홍대', vibeHint: '핫플 밀집 지역', cuisineHint: '다이닝' },
    { query: '을지로 힙플레이스 맛집', scenarioHint: '을지로 감성 식사', vibeHint: '레트로 감성 맛집', cuisineHint: '한식' },
    { query: '이태원 브런치 맛집', scenarioHint: '주말 이태원 코스', vibeHint: '이국적 브런치', cuisineHint: '브런치' },
    { query: '서울 스테이크 맛집', scenarioHint: '특별한 저녁 고기 다이닝', vibeHint: '스테이크 하우스', cuisineHint: '스테이크' },
    { query: '망원동 디저트 카페', scenarioHint: '카페 호핑 코스', vibeHint: '감성 디저트', cuisineHint: '디저트' },
  ],
  'gyeonggi': [
    { query: '판교 데이트 맛집', scenarioHint: '퇴근 후 데이트', vibeHint: '깔끔한 데이트 스팟', cuisineHint: '다이닝' },
    { query: '하남 미사 브런치 맛집', scenarioHint: '주말 드라이브 후 브런치', vibeHint: '채광 좋은 브런치 카페', cuisineHint: '브런치' },
    { query: '광교 파스타 맛집', scenarioHint: '광교 주말 데이트', vibeHint: '깔끔한 양식 스팟', cuisineHint: '파스타' },
    { query: '수원 행궁동 분위기 술집', scenarioHint: '행궁동 저녁 코스', vibeHint: '감도 높은 주점', cuisineHint: '주점' },
    { query: '부천 데이트 맛집', scenarioHint: '분위기 챙기는 데이트', vibeHint: '데이트 스팟', cuisineHint: '다이닝' },
    { query: '김포 파스타 맛집', scenarioHint: '가볍지 않게 식사하고 싶은 날', vibeHint: '클래식 양식 무드', cuisineHint: '파스타' },
    { query: '분당 서현역 맛집', scenarioHint: '분당 저녁 약속', vibeHint: '접근성 좋은 핫플', cuisineHint: '다이닝' },
    { query: '일산 라페스타 맛집', scenarioHint: '일산 주말 데이트', vibeHint: '라페스타 동선 맛집', cuisineHint: '다이닝' },
    { query: '동탄 카페 맛집', scenarioHint: '신도시 카페 투어', vibeHint: '넓고 쾌적한 카페', cuisineHint: '카페' },
    { query: '위례 브런치 맛집', scenarioHint: '위례 주말 나들이', vibeHint: '힙한 신도시 브런치', cuisineHint: '브런치' },
    { query: '용인 수지 파스타', scenarioHint: '드라이브 후 양식 한 끼', vibeHint: '깔끔한 양식 스팟', cuisineHint: '파스타' },
    { query: '고양 화정 맛집', scenarioHint: '화정역 근처 약속', vibeHint: '동네 핫플 탐방', cuisineHint: '한식' },
    { query: '안양 범계 맛집', scenarioHint: '범계역 저녁 약속', vibeHint: '접근성 좋은 맛집', cuisineHint: '다이닝' },
    { query: '하남 스타필드 근처 맛집', scenarioHint: '쇼핑 후 식사 코스', vibeHint: '스타필드 연계 동선', cuisineHint: '다이닝' },
    { query: '판교 카페 맛집', scenarioHint: '판교 주말 감성 카페', vibeHint: '테크밸리 감성 카페', cuisineHint: '카페' },
  ],
};

const REGION_LABEL = {
  'incheon': '인천',
  'seoul': '서울',
  'gyeonggi': '경기',
};

function loadLocalEnvFiles() {
  const envFiles = [
    { file: '.env', override: false },
    { file: '.env.local', override: true },
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile.file);
    if (!fsSync.existsSync(envPath)) continue;

    const raw = fsSync.readFileSync(envPath, 'utf-8');
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

function pickBySeed(seed, values) {
  const base = Array.from(String(seed || '')).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return values[base % values.length];
}

function normalizePriceLevel(priceLevel) {
  const labels = {
    PRICE_LEVEL_FREE: '가격 정보는 더 확인이 필요하지만, 가볍게 후보에 올려두기에는 무리가 없어요.',
    PRICE_LEVEL_INEXPENSIVE: '가볍게 가기 좋은 편이라 첫 후보로 올려두기 편해요.',
    PRICE_LEVEL_MODERATE: '부담이 과하지 않은 편이라 약속 잡을 때 무난하게 보기 좋아요.',
    PRICE_LEVEL_EXPENSIVE: '조금 힘줘서 가는 편이라 특별한 날 카드로 남겨둘 만해요.',
    PRICE_LEVEL_VERY_EXPENSIVE: '가격대가 높은 편이라 기념일 카드로 보는 쪽이 잘 맞아요.',
  };

  return labels[priceLevel] || '';
}

function isGenericRestaurantSummary(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (!/[.!?…]$/.test(normalized)) return true;

  return [
    '약속 동선을 짜기 편한 편이에요',
    '오늘 어디 갈지 빠르게 정하고 싶을 때',
    '저장해둘 만한 후보가 되어줍니다',
    '방문해보셔도 좋아요',
    '일정 사이에 넣기 좋은 후보예요',
    '저장해두고 필요할 때 다시 꺼내보기 편한 타입',
  ].some((phrase) => normalized.includes(phrase));
}

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

  return chunks.join('\n\n').trim();
}

function buildFallbackSummary(placeName, address) {
  const base = `${placeName}은(는) ${address} 근처에서 일정 사이에 넣기 좋은 후보예요. 과장된 소개보다도, 저장해두고 필요할 때 다시 꺼내보기 편한 타입에 가까워요.`;
  return normalizeLineBreakBySentence(base);
}

function buildContextualRestaurantSummary(item) {
  const scenario = item.scenarioHint || '오늘 약속 장소를 정할 때';
  const vibe = item.vibeHint || '분위기 먼저 보고 고르기 좋은 결';
  const vibePhrase = /무드|감성|분위기/.test(vibe) ? vibe : `${vibe} 무드`;
  const cuisine = item.cuisineHint || item.categoryName || '식사 무드';
  const priceHint = normalizePriceLevel(item.googlePriceLevel);
  const openHint = item.googleOpenNow === true
    ? '지금 영업 중 여부도 확인돼 동선 맞추기 편해요.'
    : item.googleOpenNow === false
      ? '방문 전 영업시간만 한 번 더 보면 더 안전해요.'
      : '';
  const ratingHint = item.googleRating
    ? item.googleRatingCount
      ? `구글 평점 ${item.googleRating.toFixed(1)}점, 리뷰 ${item.googleRatingCount}개라 첫 후보로 올려둘 이유는 충분해요.`
      : `구글 평점 ${item.googleRating.toFixed(1)}점이라 기본 만족도는 기대해볼 만해요.`
    : '';

  const firstLine = pickBySeed(item.id, [
    `${item.name}, ${scenario} 잡혔을 때 먼저 체크해볼 만해요.`,
    `${scenario}에 맞춰 빠르게 고르려면 ${item.name}부터 열어봐도 흐름이 자연스러워요.`,
    `${item.name}은(는) ${scenario}에 저장해두기 좋은 카드예요.`,
  ]);

  const secondLine = pickBySeed(`${item.id}:${item.name}`, [
    ratingHint || `${vibePhrase} 인상이 살아 있어서 ${cuisine} 결로 방향 잡는 날에 잘 맞아요.`,
    openHint || `${cuisine} 쪽으로 너무 무겁지 않게 고르고 싶을 때 꺼내보기 좋은 타입이에요.`,
    priceHint || `${vibePhrase} 쪽 결이 보여서 메뉴보다 전체 분위기부터 보는 날에도 잘 어울려요.`,
  ]);

  return normalizeLineBreakBySentence(`${firstLine} ${secondLine}`.trim());
}

function getRestaurantSummary(item) {
  const rawSummary = normalizeLineBreakBySentence(String(item.summary || '').trim());
  if (!isGenericRestaurantSummary(rawSummary)) {
    return rawSummary;
  }

  return buildContextualRestaurantSummary(item);
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
    categoryName: (place.category_name || '').trim(),
    summary: '',
    sourceQuery: meta.query,
    scenarioHint: meta.scenarioHint,
    vibeHint: meta.vibeHint,
    cuisineHint: meta.cuisineHint,
  };
}

// ─── Google Places API (New) ────────────────────────────────────────────────
async function fetchGooglePlaceDetails(name, address, apiKey) {
  let res;
  try {
    res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.rating',
          'places.userRatingCount',
          'places.photos',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: `${name} ${address}`,
        languageCode: 'ko',
        maxResultCount: 1,
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const place = data?.places?.[0];
  if (!place) return null;
  const photos = place.photos || [];
  // Prefer landscape photos (widthPx >= heightPx) — food/interior shots tend to be landscape.
  // Portrait-oriented photos are more likely to be receipts, menus, stairways, etc.
  const bestPhoto = photos.find(p => p.widthPx && p.heightPx && p.widthPx >= p.heightPx)
    || photos[0];
  const photoName = bestPhoto?.name;
  const photoUrl = photoName
    ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`
    : null;
  // Also store up to 3 candidate URLs for future use
  const photoUrls = photos
    .filter(p => p.name)
    .slice(0, 3)
    .map(p => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`);
  return {
    placeId: place.id || '',
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    photoUrl,
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
  };
}

async function fetchGooglePlacePhotoById(placeId, apiKey) {
  if (!placeId || !apiKey) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photos = data?.photos || [];
    // Prefer landscape photos (widthPx >= heightPx)
    const bestPhoto = photos.find(p => p.widthPx && p.heightPx && p.widthPx >= p.heightPx)
      || photos[0];
    const photoName = bestPhoto?.name;
    if (!photoName) return null;
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`;
  } catch {
    return null;
  }
}

/**
 * 네이버 이미지 검색 API로 맛집 사진을 가져온다.
 * 가게명 정확 일치(쌍따옴표)를 우선하고, 광고/프록시 URL과 title에 가게명이 없는 결과는 제외하여
 * 상호 불일치로 인한 오결(초밥집에 치즈치킨 사진이 들어가는 등) 재발을 차단한다.
 */
// topN: 반환할 최대 URL 개수 (기본 2개 - 히어로 + 본문 삽입용). 신뢰도 부족 시 topN보다 적게 반환할 수 있음.
async function fetchNaverRestaurantPhoto(name, address, clientId, clientSecret, topN = 2) {
  if (!clientId || !clientSecret) return null;
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return null;

  // 주소 앞 2 토큰(시/구)만 추출해 검색어를 압축
  const locationHint = String(address || '').split(' ').slice(0, 2).join(' ').trim();

  // 일식/스시 계열은 메뉴 사진 비율이 높은 ' 메뉴' 키워드를 우선 술어
  const cuisineLike = `${trimmedName} ${address || ''}`;
  const isJapanese = /(이식|스시|초밥|오마카세|사시미|우동|라멘|돈카즈)/.test(cuisineLike);

  // 다단계 폴백: 정확 일치 → 메뉴 조합 → 느슨한 일치
  const queries = [
    `"${trimmedName}" ${locationHint}`.trim(),
    isJapanese ? `"${trimmedName}" 메뉴` : `"${trimmedName}" 메뉴`,
    `${trimmedName} ${locationHint} 맛집`.trim(),
  ];

  // 가게명 핵심 토큰(2글자 이상) 추출 — 텍스트 매칭 신뢰도 검증에 사용
  const nameTokens = trimmedName
    .replace(/[()\[\]{}<>'"]/g, ' ')
    .split(/\s+/)
    .map((tok) => tok.trim())
    .filter((tok) => tok.length >= 2);
  const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '');

  const isAdLikeUrl = (link) => {
    const u = String(link || '').toLowerCase();
    if (!u) return true;
    return /(blogproxy|adcr\.|\/ad\/|\?ad=|advertisement|\/sponsored)/.test(u);
  };

  for (const query of queries) {
    const url = new URL('https://openapi.naver.com/v1/search/image');
    url.searchParams.set('query', query);
    url.searchParams.set('display', '20');
    url.searchParams.set('sort', 'sim');
    url.searchParams.set('filter', 'large');

    let res;
    try {
      res = await fetch(url.toString(), {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      });
    } catch (error) {
      console.warn(`  [Naver Image] 요청 오류: ${trimmedName} - ${error?.message || error}`);
      continue;
    }

    if (!res.ok) {
      console.warn(`  [Naver Image] 검색 실패(${res.status}): ${trimmedName} | q=${query}`);
      continue;
    }

    const data = await res.json().catch(() => null);
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) continue;

    // 1) 광고/프록시 URL 제외 + landscape + 폭 >= 500 우선
    const cleaned = items.filter((item) => !isAdLikeUrl(item?.link));
    const goodSize = cleaned.filter((item) => {
      const w = parseInt(item.sizewidth, 10) || 0;
      const h = parseInt(item.sizeheight, 10) || 0;
      return w >= 500 && w >= h;
    });

    // 2) title에 가게명 토큰이 하나라도 포함된 결과 우선 (신뢰도 상승)
    const trustedFirst = (arr) => {
      if (nameTokens.length === 0) return arr;
      const trusted = arr.filter((item) => {
        const text = `${stripHtml(item?.title)} ${String(item?.link || '')}`.toLowerCase();
        return nameTokens.some((tok) => text.includes(tok.toLowerCase()));
      });
      const rest = arr.filter((item) => !trusted.includes(item));
      return [...trusted, ...rest];
    };

    const ranked = trustedFirst(goodSize.length > 0 ? goodSize : cleaned);

    // 3) 가게명 토큰 포함 결과만 신뢰 결과로 간주 — 몇 개가 있는지 세기
    const trustedItems = ranked.filter((item) => {
      if (nameTokens.length === 0) return true;
      const text = `${stripHtml(item?.title)} ${String(item?.link || '')}`.toLowerCase();
      return nameTokens.some((tok) => text.includes(tok.toLowerCase()));
    });

    if (trustedItems.length === 0) {
      // 신뢰 결과 없으면 다음 쿼리로 폴백
      continue;
    }

    const urls = trustedItems.slice(0, topN).map((item) => item?.link).filter(Boolean);
    if (urls.length === 0) continue;
    if (topN === 1) return urls[0] || null;
    return urls;
  }

  // 모든 쿼리 실패 → 억지로 채우지 않고 null 반환 (무관 이미지 삽입 차단)
  return null;
}

async function enrichExistingRestaurantPhotos(payload, googleApiKey, supabaseCacheClient) {
  const regions = payload?.regions && typeof payload.regions === 'object' ? payload.regions : {};
  const metrics = {
    cacheHit: 0,
    cacheMiss: 0,
    googleCalled: 0,
  };
  let updatedCount = 0;

  for (const [regionKey, items] of Object.entries(regions)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const existingPhotoUrl = String(item?.googlePhotoUrl || '').trim();
      if (existingPhotoUrl) continue;

      let placeId = String(item?.googlePlaceId || '').trim();
      let rating = item?.googleRating ?? null;
      let ratingCount = item?.googleRatingCount ?? null;
      let photoUrl = null;

      if (!placeId) {
        const cached = await getCachedRestaurantRating(supabaseCacheClient, item?.id);
        if (cached?.placeId) {
          metrics.cacheHit += 1;
          placeId = cached.placeId;
          if (rating == null) rating = cached.rating;
          if (ratingCount == null) ratingCount = cached.ratingCount;
        } else {
          metrics.cacheMiss += 1;
        }
      }

      try {
        if (placeId) {
          photoUrl = await fetchGooglePlacePhotoById(placeId, googleApiKey);
        }

        if (!photoUrl) {
          metrics.googleCalled += 1;
          const googleResult = await fetchGooglePlaceDetails(item.name, item.address, googleApiKey);
          if (googleResult?.placeId) {
            placeId = googleResult.placeId;
            if (rating == null) rating = googleResult.rating ?? null;
            if (ratingCount == null) ratingCount = googleResult.userRatingCount ?? null;
            photoUrl = googleResult.photoUrl || null;
            await upsertRestaurantRatingCache(supabaseCacheClient, item, googleResult);
          }
        }
      } catch (error) {
        console.warn(`  [Google Places] 기존 사진 보강 실패: ${item?.name || '이름 미상'} - ${error?.message || error}`);
      }

      if (placeId) {
        item.googlePlaceId = placeId;
      }
      if (rating != null && item.googleRating == null) {
        item.googleRating = rating;
      }
      if (ratingCount != null && item.googleRatingCount == null) {
        item.googleRatingCount = ratingCount;
      }
      if (photoUrl) {
        item.googlePhotoUrl = photoUrl;
        updatedCount += 1;
        console.log(`  ✅ 사진 보강: [${REGION_LABEL[regionKey] || regionKey}] ${item.name}`);
      } else {
        console.log(`  - 사진 없음: [${REGION_LABEL[regionKey] || regionKey}] ${item.name}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { payload, metrics, updatedCount };
}

async function filterByGoogleRating(items, googleApiKey, supabaseCacheClient, naverClientId, naverClientSecret) {
  const metrics = {
    cacheHit: 0,
    cacheMiss: 0,
    googleCalled: 0,
  };

  if (!googleApiKey) {
    console.warn('[Google Places] API 키 없음 — 평점 필터 건너뜀');
    return {
      filtered: items.map((item) => ({
        ...item,
        googleRating: null,
        googleRatingCount: null,
        googlePriceLevel: '',
        googleBusinessStatus: '',
        googlePrimaryType: '',
        googleOpenNow: null,
        googleWeekdayText: [],
      })),
      metrics,
    };
  }

  const filtered = [];
  for (const item of items) {
    let usedCache = false;
    let placeId = '';
    let rating = null;
    let ratingCount = null;

    const cached = await getCachedRestaurantRating(supabaseCacheClient, item.id);
    if (cached) {
      usedCache = true;
      metrics.cacheHit += 1;
      placeId = cached.placeId;
      rating = cached.rating;
      ratingCount = cached.ratingCount;
    } else {
      metrics.cacheMiss += 1;
    }

    let googleResult = null;
    let photoUrl = null;
    try {
      if (!usedCache) {
        metrics.googleCalled += 1;
        googleResult = await fetchGooglePlaceDetails(item.name, item.address, googleApiKey);
        placeId = googleResult?.placeId || '';
        rating = googleResult?.rating ?? null;
        ratingCount = googleResult?.userRatingCount ?? null;
        photoUrl = googleResult?.photoUrl || null;
      } else if (placeId) {
        // 캐시 hit: photo만 별도 취득
        photoUrl = await fetchGooglePlacePhotoById(placeId, googleApiKey);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.warn(`  [Google Places] ${item.name} 조회 오류, 통과 처리:`, error?.message || error);
    }

    if (!usedCache && googleResult) {
      await upsertRestaurantRatingCache(supabaseCacheClient, item, googleResult);
    }

    if (rating === null) {
      console.log(`  ❌ 구글 평점 미확인 제외: ${item.name}`);
      continue;
    }

    if (rating < GOOGLE_PLACES_MIN_RATING) {
      console.log(`  ❌ 평점 미달 제외: ${item.name} (${rating}점)`);
    } else if (!Number.isFinite(Number(ratingCount)) || Number(ratingCount) < GOOGLE_PLACES_MIN_REVIEW_COUNT) {
      console.log(`  ❌ 리뷰 수 미달 제외: ${item.name} (${rating}점, ${ratingCount ?? '?'}개 리뷰)`);
    } else {
      console.log(`  ✅ 평점 통과: ${item.name} (${rating}점, ${ratingCount ?? '?'}개 리뷰${usedCache ? ', cache' : ''}${photoUrl ? ', 📷사진' : ''})`);
      const naverUrls = naverClientId && naverClientSecret
        ? (await fetchNaverRestaurantPhoto(item.name, item.address, naverClientId, naverClientSecret, 2)) || []
        : [];
      filtered.push({
        ...item,
        googlePlaceId: placeId,
        googleRating: rating,
        googleRatingCount: ratingCount,
        googlePhotoUrl: photoUrl,
        naverPhotoUrl: naverUrls[0] || null,
        naverPhotoUrl2: naverUrls[1] || null,
        googlePriceLevel: '',
        googleBusinessStatus: '',
        googlePrimaryType: '',
        googleOpenNow: null,
        googleWeekdayText: [],
      });
    }
    // 구글 API 속도 제한 방지 (200ms 간격)
    if (!usedCache) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return {
    filtered,
    metrics,
  };
}

/**
 * 기존 restaurants.json의 각 항목에 naverPhotoUrl을 보강한다.
 * BACKFILL_NAVER_PHOTOS_ONLY=true 모드에서 사용.
 * 이미 naverPhotoUrl이 있는 항목은 건너뛴다.
 */
async function enrichNaverPhotos(payload, naverClientId, naverClientSecret) {
  const regions = payload?.regions && typeof payload.regions === 'object' ? payload.regions : {};
  let updatedCount = 0;
  let skippedCount = 0;

  for (const [regionKey, items] of Object.entries(regions)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (item.naverPhotoUrl && item.naverPhotoUrl2) {
        skippedCount += 1;
        continue;
      }

      const naverUrls = (await fetchNaverRestaurantPhoto(item.name, item.address, naverClientId, naverClientSecret, 2)) || [];
      if (naverUrls.length > 0) {
        if (!item.naverPhotoUrl) item.naverPhotoUrl = naverUrls[0];
        if (!item.naverPhotoUrl2 && naverUrls[1]) item.naverPhotoUrl2 = naverUrls[1];
        updatedCount += 1;
        console.log(`  ✅ Naver 사진 보강: [${REGION_LABEL[regionKey] || regionKey}] ${item.name}`);
      } else {
        console.log(`  - Naver 사진 없음: [${REGION_LABEL[regionKey] || regionKey}] ${item.name}`);
      }

      // 네이버 API 속도 제한 방지 (100ms 간격)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { payload, updatedCount, skippedCount };
}

// ────────────────────────────────────────────────────────────────────────────

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

  const restaurantGeminiModel = process.env.RESTAURANT_GEMINI_MODEL || process.env.GEMINI_MODEL || RESTAURANT_GEMINI_MODEL_FALLBACK;

  const safeInput = items.map((item) => ({
    id: item.id,
    name: item.name,
    address: item.address,
    phone: item.phone,
    mapUrl: item.mapUrl,
    categoryName: item.categoryName || '',
    sourceQuery: item.sourceQuery || '',
    scenarioHint: item.scenarioHint || '',
    vibeHint: item.vibeHint || '',
    cuisineHint: item.cuisineHint || '',
    googleRating: item.googleRating ?? null,
    googleRatingCount: item.googleRatingCount ?? null,
  }));

  const prompt = [
    '당신은 2030 취향을 잘 아는 맛집 큐레이터입니다.',
    '아래 JSON 배열의 각 맛집에 대해 카드용 2문장 요약을 작성해주세요.',
    '진부한 표현("고민될 때가 종종 있어요", "방문해보셔도 좋아요")은 금지합니다.',
    'sourceQuery, scenarioHint, vibeHint, cuisineHint, googleRating을 참고해 왜 저장해둘 만한지 짧고 세련되게 써주세요.',
    '과장/허위 없이, 빠르게 본론만 전달해주세요.',
    '문체 규칙:',
    '1) 반드시 가벼운 존댓말(~해요/~네요/~거든요) 사용',
    '2) 항목당 2~3문장',
    '3) 2문장마다 줄바꿈(\\n\\n) 적용',
    '4) 과장/허위 금지',
    '5) 반드시 JSON 배열만 반환',
    '6) 주소만 반복하거나 템플릿처럼 똑같은 문장 구조를 복붙하지 마세요.',
    '7) 확인되지 않은 메뉴/주차/웨이팅 시간은 절대 단정하지 마세요.',
    '반환 스키마: [{"id":"...","summary":"..."}]',
    `지역: ${regionLabel}`,
    '입력 데이터:',
    JSON.stringify(safeInput),
  ].join('\n');

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(restaurantGeminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

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

async function collectRegion(region, kakaoKey, geminiKey, googleKey, supabaseCacheClient, naverClientId, naverClientSecret) {
  const queries = REGION_QUERY_MAP[region];
  const results = [];
  for (const meta of queries) {
    const places = await fetchKakaoByKeyword(meta.query, kakaoKey);
    results.push({ meta, places });
  }

  const deduped = new Map();
  for (const { meta, places } of results) {
    for (const row of places) {
      if (!row.id) continue;
      const item = toRestaurantItem(row, meta);
      if (isFranchise(item.name)) {
        console.log(`  [${region}] 프렌차이즈 제외: ${item.name}`);
        continue;
      }
      const score = getTrendScore(item, meta);
      const existing = deduped.get(row.id);
      if (!existing || score > existing.score) {
        deduped.set(row.id, { item, score });
      }
    }
  }

  // 구글 필터 전 상위 N개 추출
  const preFilterItems = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, GOOGLE_PRE_FILTER_SIZE)
    .map((entry) => entry.item);
  if (preFilterItems.length === 0) {
    return {
      items: [],
      cacheMetrics: { cacheHit: 0, cacheMiss: 0, googleCalled: 0 },
    };
  }

  console.log(`  [${region}] Google Places 평점 필터 (${preFilterItems.length}건 → 기준: ${GOOGLE_PLACES_MIN_RATING}점 이상, 리뷰 ${GOOGLE_PLACES_MIN_REVIEW_COUNT}개 이상)`);
  const { filtered: googleFiltered, metrics: cacheMetrics } = await filterByGoogleRating(preFilterItems, googleKey, supabaseCacheClient, naverClientId, naverClientSecret);
  const items = googleFiltered.slice(0, MAX_ITEMS_PER_REGION);
  if (items.length === 0) {
    console.warn(`  [${region}] Google 평점 필터 후 후보 없음`);
    return {
      items: [],
      cacheMetrics,
    };
  }

  let summaryMap = new Map();
  try {
    summaryMap = await summarizeWithGemini(REGION_LABEL[region], items, geminiKey);
  } catch (error) {
    console.warn(`[${region}] Gemini 요약 생성 실패, fallback 사용`, error?.message || error);
  }

  return {
    items: items.map((item) => ({
      ...item,
      summary: getRestaurantSummary({
        ...item,
        summary: summaryMap.get(item.id) || buildFallbackSummary(item.name, item.address),
      }),
    })),
    cacheMetrics,
  };
}

async function run() {
  loadLocalEnvFiles();

  const kakaoKey = process.env.KAKAO_REST_API_KEY || process.env.KAKAO_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  const supabaseCacheClient = createSupabaseCacheClient();
  const restaurantGeminiModel = process.env.RESTAURANT_GEMINI_MODEL || process.env.GEMINI_MODEL || RESTAURANT_GEMINI_MODEL_FALLBACK;

  if (!googleKey) {
    console.warn('⚠️  GOOGLE_PLACES_API_KEY 없음 — 구글 평점 필터 건너뜀');
  }

  if (BACKFILL_EXISTING_GOOGLE_PHOTOS_ONLY) {
    if (!googleKey) {
      console.error('GOOGLE_PLACES_API_KEY가 없습니다. 기존 사진 보강을 중단합니다.');
      process.exit(1);
    }

    console.log('🖼️  기존 restaurants.json 대상 Google 사진 보강 시작');
    console.log(`🗄️  Supabase 캐시 사용: ${supabaseCacheClient ? 'ON' : 'OFF'}`);

    const payload = await readExistingRestaurantsPayload();
    const { payload: enrichedPayload, metrics, updatedCount } = await enrichExistingRestaurantPhotos(payload, googleKey, supabaseCacheClient);

    enrichedPayload.updatedAt = new Date().toISOString();
    enrichedPayload.source = String(enrichedPayload.source || 'kakao+google+gemini');
    enrichedPayload.metrics = {
      ...(enrichedPayload.metrics || {}),
      cache_hit: Number(enrichedPayload?.metrics?.cache_hit || 0) + metrics.cacheHit,
      cache_miss: Number(enrichedPayload?.metrics?.cache_miss || 0) + metrics.cacheMiss,
      google_called: Number(enrichedPayload?.metrics?.google_called || 0) + metrics.googleCalled,
    };

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(enrichedPayload, null, 2), 'utf-8');

    console.log(`✅ 기존 사진 보강 완료: ${OUTPUT_PATH}`);
    console.log(`   - 사진 보강 건수: ${updatedCount}`);
    console.log(`   - cache_hit=${metrics.cacheHit}, cache_miss=${metrics.cacheMiss}, google_called=${metrics.googleCalled}`);
    return;
  }

  if (BACKFILL_NAVER_PHOTOS_ONLY) {
    if (!naverClientId || !naverClientSecret) {
      console.error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 없습니다. Naver 사진 보강을 중단합니다.');
      process.exit(1);
    }

    console.log('🖼️  기존 restaurants.json 대상 Naver 이미지 사진 보강 시작');

    const payload = await readExistingRestaurantsPayload();
    const { payload: enrichedPayload, updatedCount, skippedCount } = await enrichNaverPhotos(payload, naverClientId, naverClientSecret);

    enrichedPayload.updatedAt = new Date().toISOString();

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(enrichedPayload, null, 2), 'utf-8');

    console.log(`✅ Naver 사진 보강 완료: ${OUTPUT_PATH}`);
    console.log(`   - 보강 건수: ${updatedCount}, 스킵(기존 보유): ${skippedCount}`);
    return;
  }

  if (!kakaoKey) {
    console.error('KAKAO_REST_API_KEY(또는 KAKAO_API_KEY)가 없습니다. 수집을 중단합니다.');
    process.exit(1);
  }

  console.log('🥢 일상의 즐거움 맛집 데이터 수집 시작');
  if (geminiKey) {
    console.log(`🤖 맛집 요약 Gemini 모델: ${restaurantGeminiModel}`);
  }
  console.log(`🗄️  Supabase 캐시 사용: ${supabaseCacheClient ? 'ON' : 'OFF'}`);

  const regions = {};
  let totalCacheMetrics = { cacheHit: 0, cacheMiss: 0, googleCalled: 0 };
  for (const regionKey of Object.keys(REGION_QUERY_MAP)) {
    const { items, cacheMetrics } = await collectRegion(
      regionKey,
      kakaoKey,
      geminiKey,
      googleKey,
      supabaseCacheClient,
      naverClientId,
      naverClientSecret,
    );
    regions[regionKey] = items;
    totalCacheMetrics = mergeCacheMetrics(totalCacheMetrics, cacheMetrics);

    console.log(`   [${REGION_LABEL[regionKey] || regionKey}] cache_hit=${cacheMetrics.cacheHit}, cache_miss=${cacheMetrics.cacheMiss}, google_called=${cacheMetrics.googleCalled}`);
  }

  console.log(`📊 맛집 캐시 지표 합계: cache_hit=${totalCacheMetrics.cacheHit}, cache_miss=${totalCacheMetrics.cacheMiss}, google_called=${totalCacheMetrics.googleCalled}`);
  appendGithubOutput('cache_hit', totalCacheMetrics.cacheHit);
  appendGithubOutput('cache_miss', totalCacheMetrics.cacheMiss);
  appendGithubOutput('google_called', totalCacheMetrics.googleCalled);

  const payload = {
    updatedAt: new Date().toISOString(),
    source: googleKey ? 'kakao+google+gemini' : 'kakao+gemini',
    metrics: {
      cache_hit: totalCacheMetrics.cacheHit,
      cache_miss: totalCacheMetrics.cacheMiss,
      google_called: totalCacheMetrics.googleCalled,
    },
    regions,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`✅ 저장 완료: ${OUTPUT_PATH}`);
  for (const [key, items] of Object.entries(regions)) {
    console.log(`   - ${REGION_LABEL[key] || key}: ${items.length}건`);
  }
}

run().catch((error) => {
  console.error('❌ 맛집 데이터 수집 실패', error);
  process.exit(1);
});
