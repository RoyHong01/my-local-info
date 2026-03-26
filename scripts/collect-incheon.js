const fs = require('fs/promises');
const path = require('path');

async function run() {
  const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;
  if (!PUBLIC_DATA_API_KEY) {
    console.error("Missing PUBLIC_DATA_API_KEY in process.env");
    return;
  }

  const endpoint = `https://apis.data.go.kr/1741000/Subsidy24/getSubsidy24List?serviceKey=${PUBLIC_DATA_API_KEY}&page=1&perPage=100&returnType=JSON`;

  let items = [];
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error("Failed to fetch incheon data:", await response.text());
      return;
    }
    const data = await response.json();
    items = data.data || data.items || [];
  } catch (err) {
    console.error("Error fetching incheon data:", err);
    return;
  }

  // 인천 키워드 필터링
  const filtered = items.filter(item => {
    const text = [
      item['서비스명'],
      item['서비스목적요약'],
      item['지원대상'],
      item['소관기관명'],
      item['서비스분야']
    ].join(' ');
    return text.includes('인천');
  });

  const dataPath = path.join(process.cwd(), 'public', 'data', 'incheon.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

  // 중복 제거 후 신규 항목 추가
  const existingNames = new Set(existing.map(e => e['서비스명'] || e.name));
  const newItems = filtered.filter(item => !existingNames.has(item['서비스명'] || item.name));

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
  console.log(`인천 지역 정보 수집 완료: 신규 ${newItems.length}건 추가 (총 ${merged.length}건)`);
}

run();
