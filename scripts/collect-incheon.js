const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY || '';
const TOUR_PHOTO_GALLERY_BASE = 'https://apis.data.go.kr/B551011/PhotoGalleryService1';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const requestedGeminiModel = process.env.GEMINI_MODEL || '';
if (/\bpro\b/i.test(requestedGeminiModel)) {
  throw new Error('안전장치: 수집 스크립트는 Pro 모델을 사용하지 않습니다. gemini-2.5-flash-lite만 허용됩니다.');
}
if (requestedGeminiModel && requestedGeminiModel !== GEMINI_MODEL) {
  console.warn(`GEMINI_MODEL 오버라이드(${requestedGeminiModel}) 무시: ${GEMINI_MODEL} 고정 사용`);
}
const INCHEON_PHOTO_TOKEN = process.env.INCHEON_PHOTO_TOKEN || '';
const INCHEON_PHOTO_API_URL = process.env.INCHEON_PHOTO_API_URL || 'https://api.incheoneasy.com/api/tour/touristPhotoInfo';
const INCHEON_PHOTO_MAX_PAGES = Number.parseInt(process.env.INCHEON_PHOTO_MAX_PAGES || '2', 10);

const INCHEON_LANDMARK_KEYWORDS = [
  '송도',
  '월미도',
  '차이나타운',
  '개항장',
  '영종도',
  '강화도',
  '센트럴파크',
  '인천대교',
  '을왕리',
];

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#034;|&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function parsePhotoApiJson(rawText) {
  const decoded = decodeHtmlEntities(rawText);
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isIncheonEventItem(item) {
  const name = normalizeSpace(item['서비스명'] || item.name || item.title || '');
  const category = normalizeSpace(item.category || item['서비스분야'] || '');
  return /(축제|행사|페스티벌|문화)/.test(`${name} ${category}`);
}

function buildIncheonPhotoKeywords(item) {
  const name = normalizeSpace(item['서비스명'] || item.name || item.title || '');
  const location = normalizeSpace(item.location || item['소관기관명'] || item['접수기관명'] || '');

  const cleanedName = name
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/(지원|행사|축제|페스티벌|프로그램|모집|접수|사업)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = [
    cleanedName,
    ...cleanedName.split(/\s+/).filter((t) => t.length >= 2),
    ...location.split(/\s+/).filter((t) => t.length >= 2),
  ];

  return [...new Set(tokens.filter(Boolean))].slice(0, 6);
}

function scorePhotoCandidate(photo, item, keyword) {
  const title = normalizeSpace(photo.trrsrtNm);
  const addr = normalizeSpace(photo.trrsrtAddr);
  const name = normalizeSpace(item['서비스명'] || item.name || item.title || '');
  const location = normalizeSpace(item.location || item['소관기관명'] || item['접수기관명'] || '');

  let score = 0;
  if (title.includes(keyword)) score += 40;
  if (name.includes(title) || title.includes(name)) score += 30;
  if (location && (addr.includes(location) || location.includes(addr))) score += 20;

  const reviewCount = Number(photo.trrsrtRvGcnt || 0);
  if (Number.isFinite(reviewCount)) {
    score += Math.min(15, reviewCount);
  }

  return score;
}

async function fetchIncheonPhotoList({ keyword, pageNo = 1 }) {
  if (!INCHEON_PHOTO_TOKEN) return { ok: false, error: 'missing_token', dataList: [] };

  const params = new URLSearchParams({
    accessToken: INCHEON_PHOTO_TOKEN,
    pageNo: String(pageNo),
    trrsrtNm: keyword,
  });

  const url = `${INCHEON_PHOTO_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const raw = await response.text();
    const parsed = parsePhotoApiJson(raw);

    if (!response.ok || !parsed) {
      return { ok: false, error: `http_${response.status}`, dataList: [] };
    }

    const returnCode = String(parsed.returnCode || '');
    if (returnCode !== '200') {
      return { ok: false, error: `api_${returnCode}:${parsed.returnMsg || ''}`, dataList: [] };
    }

    return {
      ok: true,
      error: '',
      dataList: Array.isArray(parsed.dataList) ? parsed.dataList : [],
      returnMsg: parsed.returnMsg || '',
      expireDt: parsed.expireDt || '',
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'network_error', dataList: [] };
  }
}

async function resolvePhotoForIncheonEvent(item, photoCache, fallbackPool) {
  if (!isIncheonEventItem(item) || !INCHEON_PHOTO_TOKEN) return null;

  const keywords = buildIncheonPhotoKeywords(item);
  let best = null;
  let bestScore = -1;

  for (const keyword of keywords) {
    if (!keyword) continue;

    if (!photoCache.has(keyword)) {
      const merged = [];
      for (let pageNo = 1; pageNo <= INCHEON_PHOTO_MAX_PAGES; pageNo++) {
        const result = await fetchIncheonPhotoList({ keyword, pageNo });
        if (!result.ok) {
          if (pageNo === 1) {
            console.warn(`관광사진 API 조회 실패(keyword=${keyword}): ${result.error}`);
          }
          break;
        }

        const list = result.dataList || [];
        merged.push(...list);
        if (list.length === 0) break;
      }
      photoCache.set(keyword, merged);
    }

    const list = photoCache.get(keyword) || [];
    for (const photo of list) {
      const imageUrl = normalizeSpace(photo.photoFileCours);
      if (!imageUrl) continue;
      const score = scorePhotoCandidate(photo, item, keyword);
      if (score > bestScore) {
        best = { photo, keyword, imageUrl, score };
        bestScore = score;
      }
      fallbackPool.push({ imageUrl, keyword, photo });
    }
  }

  if (best) {
    return {
      imageUrl: best.imageUrl,
      keyword: best.keyword,
      matchedName: normalizeSpace(best.photo.trrsrtNm),
      matchedAddr: normalizeSpace(best.photo.trrsrtAddr),
      fallbackApplied: false,
    };
  }

  // 특정 행사 키워드로 찾지 못하면 인천 랜드마크 사진을 랜덤 fallback
  for (const fallbackKeyword of INCHEON_LANDMARK_KEYWORDS) {
    if (!photoCache.has(fallbackKeyword)) {
      const result = await fetchIncheonPhotoList({ keyword: fallbackKeyword, pageNo: 1 });
      photoCache.set(fallbackKeyword, result.ok ? (result.dataList || []) : []);
    }

    const list = photoCache.get(fallbackKeyword) || [];
    for (const photo of list) {
      const imageUrl = normalizeSpace(photo.photoFileCours);
      if (!imageUrl) continue;
      fallbackPool.push({ imageUrl, keyword: fallbackKeyword, photo });
    }
  }

  if (fallbackPool.length === 0) return null;

  const randomPick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  return {
    imageUrl: randomPick.imageUrl,
    keyword: randomPick.keyword,
    matchedName: normalizeSpace(randomPick.photo.trrsrtNm),
    matchedAddr: normalizeSpace(randomPick.photo.trrsrtAddr),
    fallbackApplied: true,
  };
}

function sourceHash(item) {
  return [
    item['서비스명'] || item.name || item.title || '',
    item['서비스목적요약'] || item.summary || item.description || '',
    item['지원내용'] || '',
    item['지원대상'] || item.target || '',
    item['신청방법'] || '',
    item['신청기한'] || item.endDate || '',
  ].join('||');
}

function validateFetchedData(sourceName, existingCount, fetchedCount) {
  if (fetchedCount === 0 && existingCount > 0) {
    return `warning: ${sourceName} API 조회 결과가 0건입니다. 데이터 존재 여부를 확인하세요.`;
  }
  if (existingCount > 0 && fetchedCount < Math.max(1, Math.floor(existingCount * 0.5))) {
    return `warning: ${sourceName} API 조회 결과가 기존 데이터(${existingCount}건)의 절반 미만입니다.`;
  }
  return 'ok';
}

function parseDateCandidates(text) {
  const src = String(text || '');
  const matches = [...src.matchAll(/(\d{4})[.-](\d{2})[.-](\d{2})/g)];
  if (matches.length === 0) return [];
  return matches
    .map((m) => `${m[1]}-${m[2]}-${m[3]}`)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
}

function extractEndDateFromIncheonItem(item) {
  const fields = [
    item.endDate,
    item['신청기한'],
    item['신청기간'],
    item['접수기간'],
    item['서비스목적요약'],
  ];

  const dates = fields.flatMap(parseDateCandidates).sort();
  if (dates.length === 0) return null;
  return dates[dates.length - 1];
}

function getIncheonViewRank(item) {
  const raw = item?.['조회수'] ?? item?.viewCount ?? item?.readCount ?? item?.hit ?? 0;
  const parsed = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getIncheonModifiedRank(item) {
  return String(item?.['수정일시'] || item?.modifiedtime || item?.updatedAt || item?.modifiedAt || item?.collectedAt || '').trim();
}

async function fetchIncheonPages(apiKey, { perPage = 100, maxPages = 30 } = {}) {
  const all = [];
  let totalCount = 0;

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      returnType: 'JSON',
    });
    params.append('cond[소관기관명::LIKE]', '인천');

    const endpoint = `https://api.odcloud.kr/api/gov24/v3/serviceList?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Infuser ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`incheon page ${page} fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const pageItems = data.data || data.items || [];
    const list = Array.isArray(pageItems) ? pageItems : [];
    all.push(...list);

    totalCount = Number(data.totalCount || totalCount || 0);
    const currentCount = Number(data.currentCount || list.length);
    if (currentCount === 0) break;
    if (totalCount > 0 && all.length >= totalCount) break;
  }

  return { items: all, totalCount };
}

async function fetchTourFirstImageByKeyword(keyword, apiKey) {
  if (!apiKey || !keyword) return '';
  const encodedKeyword = encodeURIComponent(keyword);
  const endpoint = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${apiKey}&MobileOS=ETC&MobileApp=pick-n-joy&_type=json&keyword=${encodedKeyword}&numOfRows=10&pageNo=1`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return '';
    const data = await response.json();
    const items = data?.response?.body?.items?.item || [];
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    const withImage = list.find((entry) => entry?.firstimage) || list.find((entry) => entry?.firstimage2);
    return withImage?.firstimage || withImage?.firstimage2 || '';
  } catch {
    return '';
  }
}

async function fetchPhotoGalleryImageByKeyword(keyword, apiKey) {
  if (!apiKey || !keyword) return '';

  const endpoint =
    `${TOUR_PHOTO_GALLERY_BASE}/gallerySearchList1` +
    `?serviceKey=${apiKey}` +
    `&MobileOS=ETC&MobileApp=pick-n-joy` +
    `&_type=json` +
    `&arrange=C` +
    `&numOfRows=5&pageNo=1` +
    `&keyword=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return '';
    const data = await response.json();
    const items = data?.response?.body?.items?.item || [];
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    const imageItem = list.find((entry) => entry?.galWebImageUrl);
    return imageItem?.galWebImageUrl || '';
  } catch {
    return '';
  }
}

async function generateIncheonMarkdown(item) {
  if (!GEMINI_API_KEY) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };
  const prompt = `아래 인천 지역 공공서비스 정보를 블로그처럼 읽기 쉬운 한국어 Markdown으로 재작성해줘.

[요구사항]
- 첫 줄은 훅: ## ...
- 다음 구조 포함:
  ### ✨ 어떤 지원인가요?
  ### 👥 지원 대상
  ### 📝 신청 방법
  ### 📌 한눈에 보는 신청 정보
- 사실만 사용, 과장 금지
- 500~900자
- 출력은 Markdown 본문만

[데이터]
${JSON.stringify(item, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 1200,
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0] || {};
  const markdown = (candidate?.content?.parts?.[0]?.text || '').trim();
  const usageMeta = data?.usageMetadata || {};

  return {
    markdown,
    usage: {
      input_tokens: Number(usageMeta.promptTokenCount || usageMeta.inputTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || usageMeta.outputTokenCount || 0),
    },
  };
}

async function run() {
  const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;
  const DESCRIPTION_MARKDOWN_BATCH_LIMIT = Number.parseInt(process.env.DESCRIPTION_MARKDOWN_BATCH_LIMIT || '10', 10);
  const INCHEON_WINDOW_MONTHS = Math.max(6, Number.parseInt(process.env.INCHEON_WINDOW_MONTHS || '12', 10));
  if (!PUBLIC_DATA_API_KEY) {
    console.error("Missing PUBLIC_DATA_API_KEY in process.env");
    return;
  }

  let items = [];
  try {
    const fetched = await fetchIncheonPages(PUBLIC_DATA_API_KEY, { perPage: 100, maxPages: 50 });
    items = fetched.items;
    console.log(`인천 원천 데이터 수집: totalCount=${fetched.totalCount || '-'}, collected=${items.length}`);
  } catch (err) {
    console.error("Error fetching incheon data:", err);
    return;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const windowEnd = new Date(today.getFullYear(), today.getMonth() + INCHEON_WINDOW_MONTHS, today.getDate());
  const windowEndStr = windowEnd.toISOString().split('T')[0];

  const filtered = items.filter((item) => {
    const endDate = extractEndDateFromIncheonItem(item);
    if (!endDate) return true;
    return endDate >= todayStr && endDate <= windowEndStr;
  });

  const dataPath = path.join(process.cwd(), 'public', 'data', 'incheon.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

  const validationStatus = validateFetchedData('인천 지역 정보', existing.length, filtered.length);

  // active window 기준으로 재구성 (지난 데이터는 파일에서 제거)
  const existingByKey = new Map(
    existing.map((item) => [
      String(item['서비스ID'] || item.id || item['서비스명'] || item.name),
      item,
    ])
  );
  const merged = [];
  let newItemsCount = 0;

  for (const item of filtered) {
    const key = String(item['서비스ID'] || item.id || item['서비스명'] || item.name || '');
    if (!key) continue;
    const prev = existingByKey.get(key);
    if (!prev) newItemsCount++;

    merged.push({
      ...(prev || {}),
      ...item,
      endDate: extractEndDateFromIncheonItem(item) || prev?.endDate || null,
      expired: false,
      collectedAt: todayStr,
    });
  }

  // 인천관광공사 API는 정책상 비활성화.
  // 인천 행사/축제 항목은 TourAPI(searchKeyword2) 우선, 실패 시 PhotoGalleryService1로 fallback.
  let photoMatched = 0;
  let photoFallback = 0;
  let photoSkipped = 0;
  let photoHealthcheck = '';
  let photoMode = '';
  let photoFailureReason = '';

  if (!TOUR_API_KEY) {
    console.log('TOUR_API_KEY 없음: 인천 TourAPI 이미지 매칭 건너뜀');
  } else {
    const imageCache = new Map();
    const imageSourceCache = new Map();
    for (const item of merged) {
      if (!isIncheonEventItem(item)) {
        photoSkipped++;
        continue;
      }

      if (normalizeSpace(item.firstimage)) {
        photoSkipped++;
        continue;
      }

      const itemName = normalizeSpace(item['서비스명'] || item.name || item.title || '');
      const keyword = itemName.split(' ')[0] || itemName;
      if (!keyword) {
        photoSkipped++;
        continue;
      }

      if (!imageCache.has(keyword)) {
        const primary = await fetchTourFirstImageByKeyword(keyword, TOUR_API_KEY);
        if (primary) {
          imageCache.set(keyword, primary);
          imageSourceCache.set(keyword, 'tourapi');
        } else {
          const fallback = await fetchPhotoGalleryImageByKeyword(keyword, TOUR_API_KEY);
          imageCache.set(keyword, fallback || '');
          imageSourceCache.set(keyword, fallback ? 'photo-gallery' : '');
        }
      }

      const imageUrl = imageCache.get(keyword) || '';
      if (!imageUrl) {
        photoSkipped++;
        continue;
      }
      const resolvedSource = imageSourceCache.get(keyword) || 'tourapi';

      item.firstimage = imageUrl;
      if (resolvedSource === 'photo-gallery') {
        item.image_source = '한국관광공사(PhotoGalleryService1)';
        item.image_source_note = '출처: 한국관광공사(PhotoGalleryService1)';
        item.image_source_api = 'PhotoGalleryService1/gallerySearchList1';
        photoFallback++;
      } else {
        item.image_source = '한국관광공사(TourAPI)';
        item.image_source_note = '출처: 한국관광공사(TourAPI)';
        item.image_source_api = 'KorService2/searchKeyword2';
      }
      item.image_keyword = keyword;
      item.image_matched_name = '';
      item.image_matched_addr = '';

      photoMatched++;
    }

    console.log(`인천 이미지 매칭: 총 ${photoMatched}건 (gallery fallback ${photoFallback}건, 스킵 ${photoSkipped}건)`);
  }

  let markdownGenerated = 0;
  let markdownGeneratedTitles = [];
  let markdownAttempted = 0;
  let markdownFailed = 0;
  let markdownPending = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY 없음: description_markdown 생성 건너뜀');
  } else {
    const markdownTargets = merged.filter((item) => {
      const hash = sourceHash(item);
      return !(item.description_markdown && item.description_markdown_source_hash === hash);
    });
    const todayISO = new Date().toISOString().split('T')[0];
    markdownTargets.sort((a, b) => {
      const aEnd = a.endDate || '';
      const bEnd = b.endDate || '';
      const aHasDeadline = aEnd >= todayISO ? 1 : 0;
      const bHasDeadline = bEnd >= todayISO ? 1 : 0;
      if (aHasDeadline !== bHasDeadline) return bHasDeadline - aHasDeadline;
      if (aHasDeadline && bHasDeadline && aEnd !== bEnd) return aEnd < bEnd ? -1 : 1;

      const viewDiff = getIncheonViewRank(b) - getIncheonViewRank(a);
      if (viewDiff !== 0) return viewDiff;

      return getIncheonModifiedRank(b).localeCompare(getIncheonModifiedRank(a));
    });

    const batchTargets = markdownTargets.slice(0, Math.max(0, DESCRIPTION_MARKDOWN_BATCH_LIMIT));
    console.log(`description_markdown 배치 처리: ${batchTargets.length}건 / 대기 ${Math.max(0, markdownTargets.length - batchTargets.length)}건`);

    for (const item of batchTargets) {
      markdownAttempted++;
      const hash = sourceHash(item);

      try {
        const { markdown, usage } = await generateIncheonMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = GEMINI_MODEL;
          item.description_markdown_updated_at = new Date().toISOString().split('T')[0];
          markdownGenerated++;
          markdownGeneratedTitles.push(item['서비스명'] || item.name || item.title || '');
          inputTokens += usage.input_tokens;
          outputTokens += usage.output_tokens;
        } else {
          markdownFailed++;
        }
      } catch {
        markdownFailed++;
        console.error(`description_markdown 생성 실패: ${item['서비스명'] || item.name || item.title || item['서비스ID'] || item.id}`);
      }
    }

    markdownPending = Math.max(0, markdownTargets.length - markdownAttempted);
    console.log(`description_markdown 결과: 시도 ${markdownAttempted}건, 성공 ${markdownGenerated}건, 실패 ${markdownFailed}건, 잔여 ${markdownPending}건`);
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`인천 지역 정보 수집 완료: 신규 ${newItemsCount}건 추가, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건, 윈도우 ${INCHEON_WINDOW_MONTHS}개월)`);
  if (markdownGenerated > 0) {
    console.log(`  Gemini usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
  if (validationStatus !== 'ok') {
    console.warn(`  데이터 검증 경고: ${validationStatus}`);
  }

  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = require('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_summary=신규 ${newItemsCount}건, 총 ${merged.length}건\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `gemini_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `anthropic_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_generated=${markdownGenerated}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_generated_titles=${markdownGeneratedTitles.slice(0, 5).join('|')}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_attempted=${markdownAttempted}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_failed=${markdownFailed}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_pending=${markdownPending}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_validation=${validationStatus}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_matched=${photoMatched}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_fallback=${photoFallback}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_healthcheck=${photoHealthcheck}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_mode=${photoMode}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_failure_reason=${photoFailureReason}\n`);
  }
}

run();
