const fs = require('fs/promises');
const path = require('path');

async function run() {
  const TOUR_API_KEY = process.env.TOUR_API_KEY;
  if (!TOUR_API_KEY) {
    console.error("Missing TOUR_API_KEY in process.env");
    return;
  }

  // contentTypeId 15 = 축제/공연/행사
  const endpoint = `https://apis.data.go.kr/B551011/KorService2/areaBasedList1?serviceKey=${TOUR_API_KEY}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=pick-n-joy&_type=json&listYN=Y&arrange=C&contentTypeId=15`;

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

  const dataPath = path.join(process.cwd(), 'public', 'data', 'festival.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

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
  console.log(`전국 축제·여행 정보 수집 완료: 신규 ${newItems.length}건 추가 (총 ${merged.length}건)`);
}

run();
