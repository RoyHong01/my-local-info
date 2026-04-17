const fs = require('fs/promises');
const path = require('path');

const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
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

async function generateIncheonMarkdown(item) {
  if (!anthropic) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };
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

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    markdown: (msg.content?.[0]?.text || '').trim(),
    usage: {
      input_tokens: msg.usage?.input_tokens || 0,
      output_tokens: msg.usage?.output_tokens || 0,
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

  // 인천 행사/축제 항목에 관광사진 API 매칭
  let photoMatched = 0;
  let photoFallback = 0;
  let photoSkipped = 0;
  let photoHealthcheck = 'skipped';
  let photoMode = 'disabled';
  let photoFailureReason = '';
  if (!INCHEON_PHOTO_TOKEN) {
    console.log('INCHEON_PHOTO_TOKEN 없음: 인천 관광 사진 자동 매칭 건너뜀');
  } else {
    photoMode = 'enabled';
    // 토큰 만료(7일 무호출) 방지를 위해 수집 실행 시 최소 1회 헬스체크 호출
    const health = await fetchIncheonPhotoList({ keyword: '송도', pageNo: 1 });
    if (health.ok) {
      photoHealthcheck = 'ok';
      console.log(`인천 관광사진 API 헬스체크 성공: expireDt=${health.expireDt || '-'}, 샘플=${(health.dataList || []).length}건`);
    } else {
      photoHealthcheck = `failed:${health.error}`;
      photoFailureReason = String(health.error || 'unknown_error');

      if (/api_432/.test(photoFailureReason)) {
        console.warn('인천 관광사진 API 비활성화: UNREGISTERED_IP_ERROR(432) - 등록된 호출서버 IP와 현재 실행 환경 IP가 다릅니다.');
      } else if (/api_431/.test(photoFailureReason)) {
        console.warn('인천 관광사진 API 비활성화: DEADLINE_HAS_EXPIRED_ERROR(431) - 토큰 사용기한이 만료되었습니다.');
      } else if (/api_430/.test(photoFailureReason)) {
        console.warn('인천 관광사진 API 비활성화: SERVICE_KEY_IS_NOT_REGISTERED_ERROR(430) - 토큰값이 잘못되었거나 미등록 상태입니다.');
      } else {
        console.warn(`인천 관광사진 API 비활성화: 헬스체크 실패 (${photoFailureReason})`);
      }

      // 헬스체크가 실패하면 이번 실행에서 사진 API 호출을 중단하고 기본 수집만 계속 진행
      photoMode = 'disabled';
    }

    if (photoMode === 'enabled') {
      const photoCache = new Map();
      const fallbackPool = [];
      for (const item of merged) {
        if (!isIncheonEventItem(item)) {
          photoSkipped++;
          continue;
        }

        // 기존 이미지가 있으면 유지
        if (normalizeSpace(item.firstimage)) {
          photoSkipped++;
          continue;
        }

        const matched = await resolvePhotoForIncheonEvent(item, photoCache, fallbackPool);
        if (!matched || !matched.imageUrl) {
          photoSkipped++;
          continue;
        }

        item.firstimage = matched.imageUrl;
        item.image_source = '인천관광공사';
        item.image_source_note = '출처: 인천관광공사';
        item.image_source_api = 'API003';
        item.image_keyword = matched.keyword;
        item.image_matched_name = matched.matchedName;
        item.image_matched_addr = matched.matchedAddr;

        photoMatched++;
        if (matched.fallbackApplied) photoFallback++;
      }

      console.log(`인천 관광사진 매칭: 총 ${photoMatched}건 (fallback ${photoFallback}건, 스킵 ${photoSkipped}건)`);
    } else {
      console.log('인천 관광사진 매칭: 헬스체크 실패로 이번 실행에서는 건너뜀 (기본 데이터 수집은 계속 진행)');
    }
  }

  let markdownGenerated = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!anthropic) {
    console.log('ANTHROPIC_API_KEY 없음: description_markdown 생성 건너뜀');
  } else {
    const markdownTargets = merged.filter((item) => {
      const hash = sourceHash(item);
      return !(item.description_markdown && item.description_markdown_source_hash === hash);
    });
    const batchTargets = markdownTargets.slice(0, Math.max(0, DESCRIPTION_MARKDOWN_BATCH_LIMIT));
    console.log(`description_markdown 배치 처리: ${batchTargets.length}건 / 대기 ${Math.max(0, markdownTargets.length - batchTargets.length)}건`);

    for (const item of batchTargets) {
      const hash = sourceHash(item);

      try {
        const { markdown, usage } = await generateIncheonMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = 'claude-haiku-4-5-20251001';
          item.description_markdown_updated_at = new Date().toISOString().split('T')[0];
          markdownGenerated++;
          inputTokens += usage.input_tokens;
          outputTokens += usage.output_tokens;
        }
      } catch {
        console.error(`description_markdown 생성 실패: ${item['서비스명'] || item.name || item.title || item['서비스ID'] || item.id}`);
      }
    }
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`인천 지역 정보 수집 완료: 신규 ${newItemsCount}건 추가, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건, 윈도우 ${INCHEON_WINDOW_MONTHS}개월)`);
  if (markdownGenerated > 0) {
    console.log(`  Anthropic usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
  if (validationStatus !== 'ok') {
    console.warn(`  데이터 검증 경고: ${validationStatus}`);
  }

  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = require('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_summary=신규 ${newItemsCount}건, 총 ${merged.length}건\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `anthropic_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_validation=${validationStatus}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_matched=${photoMatched}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_fallback=${photoFallback}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_healthcheck=${photoHealthcheck}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_mode=${photoMode}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `incheon_photo_failure_reason=${photoFailureReason}\n`);
  }
}

run();
