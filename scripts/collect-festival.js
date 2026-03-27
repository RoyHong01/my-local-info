const fs = require('fs/promises');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

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

async function generateFestivalMarkdown(item) {
  if (!anthropic) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };

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

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const markdown = (msg.content?.[0]?.text || '').trim();
  return {
    markdown,
    usage: {
      input_tokens: msg.usage?.input_tokens || 0,
      output_tokens: msg.usage?.output_tokens || 0,
    },
  };
}

async function run() {
  const TOUR_API_KEY = process.env.TOUR_API_KEY;
  if (!TOUR_API_KEY) {
    console.error("Missing TOUR_API_KEY in process.env");
    return;
  }

  // searchFestival2: 기간별 축제 목록 조회
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  const startDate = fmt(today);
  const endDate = fmt(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
  const endpoint = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_API_KEY}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=pick-n-joy&_type=json&eventStartDate=${startDate}&eventEndDate=${endDate}`;

  let items = [];
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error("Failed to fetch festival data:", await response.text());
      return;
    }
    const data = await response.json();
    items = data?.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
  } catch (err) {
    console.error("Error fetching festival data:", err);
    return;
  }

  // 각 축제의 상세 설명(overview) 가져오기
  console.log(`${items.length}개 축제 상세 정보 수집 시작...`);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.contentid) {
      const raw = await fetchOverview(item.contentid, TOUR_API_KEY);
      item.overview = cleanOverview(raw);
      if (item.overview) {
        console.log(`  [${i + 1}/${items.length}] ${item.title} - 설명 수집 완료`);
      } else {
        console.log(`  [${i + 1}/${items.length}] ${item.title} - 설명 없음`);
      }
      await delay(100); // rate limit 방지
    }
  }

  const dataPath = path.join(process.cwd(), 'public', 'data', 'festival.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

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

  // 기존 데이터 overview 보강 (신규 조회 결과 우선 사용)
  let updatedCount = 0;
  for (const ex of existing) {
    if (ex.contentid) {
      const fromFetched = items.find(it => it.contentid === ex.contentid)?.overview;

      if (fromFetched) {
        ex.overview = fromFetched;
        updatedCount++;
        continue;
      }

      if (!ex.overview || ex.overview.endsWith('...')) {
        const raw = await fetchOverview(ex.contentid, TOUR_API_KEY);
        ex.overview = cleanOverview(raw);
        if (ex.overview) {
          console.log(`  기존 항목 보강: ${ex.title} - 설명 수집 완료`);
          updatedCount++;
        }
        await delay(100);
      }
    }
  }

  // 중복 제거 후 신규 항목 추가
  const existingIds = new Set(existing.map(e => e.contentid));
  const newItems = items.filter(item => !existingIds.has(item.contentid));

  const mergedRaw = [
    ...existing,
    ...newItems.map(item => ({
      ...item,
      expired: false,
      collectedAt: new Date().toISOString().split('T')[0]
    }))
  ];

  // contentid(또는 id) 기준 중복 제거
  const dedupMap = new Map();
  for (const item of mergedRaw) {
    const key = item.contentid || item.id;
    if (!key) continue;
    dedupMap.set(String(key), item);
  }
  const merged = Array.from(dedupMap.values());

  // description_markdown 생성 (신규/변경 항목만)
  let markdownGenerated = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!anthropic) {
    console.log('ANTHROPIC_API_KEY 없음: description_markdown 생성 건너뜀');
  } else {
    for (const item of merged) {
      const hash = sourceHash(item);
      if (item.description_markdown && item.description_markdown_source_hash === hash) {
        continue;
      }

      try {
        const { markdown, usage } = await generateFestivalMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = 'claude-haiku-4-5-20251001';
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
  console.log(`전국 축제·여행 정보 수집 완료: 신규 ${newItems.length}건 추가, 기존 ${updatedCount}건 보강, 샘플 ${replacedLegacyCount}건 API 교체, 샘플 ${removedLegacyCount}건 정리, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건)`);
  if (markdownGenerated > 0) {
    console.log(`  Anthropic usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
}

run();
