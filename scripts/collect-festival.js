const fs = require('fs/promises');
const path = require('path');

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

// HTML 태그 제거 + 200자 요약
function cleanOverview(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
  return text.length > 200 ? text.slice(0, 197) + '...' : text;
}

// API 호출 간 딜레이 (rate limit 방지)
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  // 기존 데이터 중 overview 없는 항목도 보강
  let updatedCount = 0;
  for (const ex of existing) {
    if (ex.contentid && !ex.overview) {
      const raw = await fetchOverview(ex.contentid, TOUR_API_KEY);
      ex.overview = cleanOverview(raw);
      if (ex.overview) {
        console.log(`  기존 항목 보강: ${ex.title} - 설명 수집 완료`);
        updatedCount++;
      }
      await delay(100);
    }
  }

  // 중복 제거 후 신규 항목 추가
  const existingIds = new Set(existing.map(e => e.contentid));
  const newItems = items.filter(item => !existingIds.has(item.contentid));

  const merged = [
    ...existing,
    ...newItems.map(item => ({
      ...item,
      expired: false,
      collectedAt: new Date().toISOString().split('T')[0]
    }))
  ];

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`전국 축제·여행 정보 수집 완료: 신규 ${newItems.length}건 추가, 기존 ${updatedCount}건 보강 (총 ${merged.length}건)`);
}

run();
