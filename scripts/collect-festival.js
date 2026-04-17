const fs = require('fs/promises');
const path = require('path');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const ALLOW_GEMINI_PRO = process.env.ALLOW_GEMINI_PRO === 'true';
if (/\bpro\b/i.test(GEMINI_MODEL) && !ALLOW_GEMINI_PRO) {
  throw new Error(`안전장치: Pro 모델(${GEMINI_MODEL})은 차단됩니다. 필요하면 ALLOW_GEMINI_PRO=true를 명시하세요.`);
}

// detailCommon2로 축제 상세 설명(overview) 가져오기
async function fetchOverview(contentId, apiKey) {
  const url = `https://apis.data.go.kr/B551011/KorService2/detailCommon2?serviceKey=${apiKey}&contentId=${contentId}&MobileOS=ETC&MobileApp=pick-n-joy&_type=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    const item = data?.response?.body?.items?.item;
    if (Array.isArray(item) && item.length > 0) return item[0].overview || '';
    if (item && typeof item === 'object') return item.overview || '';
    return '';
  } catch {
    return '';
  }
}

// searchKeyword2로 특정 축제 키워드 검색 (샘플 데이터 API 교체용)
async function fetchByKeyword(keyword, apiKey) {
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${apiKey}&MobileOS=ETC&MobileApp=pick-n-joy&_type=json&keyword=${encodedKeyword}&numOfRows=10&pageNo=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const item = data?.response?.body?.items?.item || [];
    return Array.isArray(item) ? item : [item];
  } catch {
    return [];
  }
}

// HTML 태그 제거 (상세 페이지용 원문 최대 보존)
function cleanOverview(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
  return text;
}

// API 호출 간 딜레이 (rate limit 방지)
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function sourceHash(item) {
  return [
    item.title || item.name || '',
    item.eventstartdate || '',
    item.eventenddate || '',
    item.overview || '',
    item.addr1 || item.location || '',
    item.tel || '',
    item.homepage || '',
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

async function fetchFestivalPage({ apiKey, startDate, endDate, pageNo, numOfRows }) {
  const endpoint = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${apiKey}&numOfRows=${numOfRows}&pageNo=${pageNo}&MobileOS=ETC&MobileApp=PicknJoy&_type=json&eventStartDate=${startDate}&eventEndDate=${endDate}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`searchFestival2 failed: ${response.status}`);
  }
  const data = await response.json();
  const body = data?.response?.body || {};
  let pageItems = body?.items?.item || [];
  if (!Array.isArray(pageItems)) pageItems = pageItems ? [pageItems] : [];
  return {
    totalCount: Number(body.totalCount || 0),
    pageItems,
  };
}

async function fetchAllFestivalItems({ apiKey, startDate, endDate, numOfRows = 100 }) {
  const first = await fetchFestivalPage({ apiKey, startDate, endDate, pageNo: 1, numOfRows });
  const totalCount = first.totalCount;
  const pages = Math.max(1, Math.ceil(totalCount / numOfRows));
  const all = [...first.pageItems];

  for (let pageNo = 2; pageNo <= pages; pageNo++) {
    const next = await fetchFestivalPage({ apiKey, startDate, endDate, pageNo, numOfRows });
    all.push(...next.pageItems);
    await delay(80);
  }

  return { items: all, totalCount, pages };
}

async function generateFestivalMarkdown(item) {
  if (!GEMINI_API_KEY) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };

  const prompt = `아래 축제 정보를 블로그처럼 가독성 높은 한국어 Markdown으로 재작성해줘.

[요구사항]
- 첫 줄은 훅: ## ...
- 다음 구조를 반드시 포함
  ### ✨ 축제 소개
  ### 📌 방문 정보
- 과장/허위 금지, 제공된 사실만 사용
- 500~900자
- 출력은 Markdown 본문만 (코드블록 금지)

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
  const TOUR_API_KEY = process.env.TOUR_API_KEY;
  const DESCRIPTION_MARKDOWN_BATCH_LIMIT = Number.parseInt(process.env.DESCRIPTION_MARKDOWN_BATCH_LIMIT || '10', 10);
  const OVERVIEW_FETCH_LIMIT = Number.parseInt(process.env.FESTIVAL_OVERVIEW_FETCH_LIMIT || '120', 10);
  if (!TOUR_API_KEY) {
    console.error("Missing TOUR_API_KEY in process.env");
    return;
  }

  // searchFestival2: 기간별 축제 목록 조회
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  const startDate = fmt(today);
  const endDate = fmt(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));

  let items = [];
  try {
    const fetched = await fetchAllFestivalItems({
      apiKey: TOUR_API_KEY,
      startDate,
      endDate,
      numOfRows: 100,
    });
    items = fetched.items;
    console.log(`searchFestival2 수집 완료: totalCount=${fetched.totalCount}, pages=${fetched.pages}, collected=${items.length}`);
  } catch (err) {
    console.error("Error fetching festival data:", err);
    return;
  }

  const dataPath = path.join(process.cwd(), 'public', 'data', 'festival.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

  // 각 축제의 상세 설명(overview) 가져오기 - 누락 항목에 한해 제한적으로 호출
  const existingById = new Map(existing.map((ex) => [String(ex.contentid || ex.id), ex]));
  const overviewTargets = items
    .filter((it) => {
      const key = String(it.contentid || it.id || '');
      if (!key) return false;
      const ex = existingById.get(key);
      return !(ex && ex.overview);
    })
    .slice(0, Math.max(0, OVERVIEW_FETCH_LIMIT));

  console.log(`${overviewTargets.length}개 축제 상세 설명(overview) 보강 시작...`);
  for (let i = 0; i < overviewTargets.length; i++) {
    const target = overviewTargets[i];
    const itemIndex = items.findIndex((it) => it.contentid === target.contentid);
    if (itemIndex < 0) continue;
    const item = items[itemIndex];
    if (item.contentid) {
      const raw = await fetchOverview(item.contentid, TOUR_API_KEY);
      item.overview = cleanOverview(raw);
      if (item.overview) {
        console.log(`  [${i + 1}/${overviewTargets.length}] ${item.title} - 설명 수집 완료`);
      } else {
        console.log(`  [${i + 1}/${overviewTargets.length}] ${item.title} - 설명 없음`);
      }
      await delay(100); // rate limit 방지
    }
  }

  const validationStatus = validateFetchedData('전국 축제·여행 정보', existing.length, items.length);

  // 오래된 샘플 3건(id 기반)을 TourAPI 원본 항목으로 교체
  const legacyKeywordMap = {
    'festival-001': ['진해군항제', '군항제'],
    'festival-002': ['경주벚꽃마라톤', '벚꽃마라톤'],
    'festival-003': ['영등포 여의도 봄꽃축제', '여의도 봄꽃축제']
  };

  let replacedLegacyCount = 0;
  for (let i = 0; i < existing.length; i++) {
    const ex = existing[i];
    const legacyId = ex?.id;

    if (!legacyId || ex?.contentid || !legacyKeywordMap[legacyId]) continue;

    let found = null;
    for (const keyword of legacyKeywordMap[legacyId]) {
      const candidates = await fetchByKeyword(keyword, TOUR_API_KEY);
      found = candidates.find(c => c?.contenttypeid === '15') || candidates[0] || null;
      if (found?.contentid) break;
      await delay(100);
    }

    if (!found?.contentid) continue;

    const rawOverview = await fetchOverview(found.contentid, TOUR_API_KEY);
    const replacement = {
      ...found,
      expired: false,
      collectedAt: new Date().toISOString().split('T')[0],
      overview: cleanOverview(rawOverview)
    };

    existing[i] = replacement;
    replacedLegacyCount++;
    console.log(`  샘플 교체 완료: ${legacyId} -> ${replacement.title} (${replacement.contentid})`);
    await delay(100);
  }

  // API 매칭 실패한 오래된 샘플(id만 있고 contentid 없음) 제거
  const beforeLegacyCleanup = existing.length;
  existing = existing.filter(ex => !(ex?.id && !ex?.contentid && String(ex.id).startsWith('festival-')));
  const removedLegacyCount = beforeLegacyCleanup - existing.length;

  // 오늘~6개월 범위의 API 응답을 기준으로 active set 재구성 (지난 데이터는 제거)
  const merged = [];
  let updatedCount = 0;
  let newItemsCount = 0;
  for (const item of items) {
    const key = String(item.contentid || item.id || '');
    if (!key) continue;
    const prev = existingById.get(key);
    const mergedItem = {
      ...(prev || {}),
      ...item,
      overview: item.overview || prev?.overview || '',
      expired: false,
      collectedAt: new Date().toISOString().split('T')[0],
    };
    if (prev) {
      updatedCount++;
    } else {
      newItemsCount++;
    }
    merged.push(mergedItem);
  }

  // description_markdown 생성 (신규/변경 항목만)
  let markdownGenerated = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY 없음: description_markdown 생성 건너뜀');
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
        const { markdown, usage } = await generateFestivalMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = GEMINI_MODEL;
          item.description_markdown_updated_at = new Date().toISOString().split('T')[0];
          markdownGenerated++;
          inputTokens += usage.input_tokens;
          outputTokens += usage.output_tokens;
        }
      } catch (e) {
        console.error(`  description_markdown 생성 실패: ${item.title || item.name || item.contentid}`);
      }
      await delay(80);
    }
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`전국 축제·여행 정보 수집 완료: 신규 ${newItemsCount}건 추가, 기존 ${updatedCount}건 갱신, 샘플 ${replacedLegacyCount}건 API 교체, 샘플 ${removedLegacyCount}건 정리, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건)`);
  if (markdownGenerated > 0) {
    console.log(`  Gemini usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
  if (validationStatus !== 'ok') {
    console.warn(`  데이터 검증 경고: ${validationStatus}`);
  }

  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = require('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_summary=신규 ${newItemsCount}건, 업데이트 ${updatedCount}건, 총 ${merged.length}건\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `gemini_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `anthropic_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_validation=${validationStatus}\n`);
  }
}

run();
