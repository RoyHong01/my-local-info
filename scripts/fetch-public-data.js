const fs = require('fs/promises');
const path = require('path');

async function run() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;

  if (!GEMINI_API_KEY || !PUBLIC_DATA_API_KEY) {
    console.error("Missing API keys in process.env");
    return;
  }

  // [1단계] 공공데이터포털 API에서 데이터 가져오기
  const endpoint = 'https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=20&returnType=JSON';
  
  const headers = {
    'Authorization': `Infuser ${PUBLIC_DATA_API_KEY}`
  };

  let items = [];
  try {
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      console.error("Failed to fetch public data", await response.text());
      return;
    }
    const data = await response.json();
    items = data.data || [];
  } catch (err) {
    console.error("Error fetching public data:", err);
    return;
  }

  // 데이터 필터링 (성남 -> 경기 -> 전체)
  let targetItems = items.filter(item => {
    const text = [
      item['서비스명'], 
      item['서비스목적요약'], 
      item['지원대상'], 
      item['소관기관명']
    ].join(' ');
    return text.includes('성남');
  });

  if (targetItems.length === 0) {
    targetItems = items.filter(item => {
      const text = [
        item['서비스명'], 
        item['서비스목적요약'], 
        item['지원대상'], 
        item['소관기관명']
      ].join(' ');
      return text.includes('경기');
    });
  }

  if (targetItems.length === 0) {
    targetItems = items;
  }

  // [2단계] 기존 데이터와 비교
  const dataPath = path.join(process.cwd(), 'public', 'data', 'local-info.json');
  let existingData = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existingData = JSON.parse(fileContent);
  } catch (err) {
    // 파일이 없거나 오류 시 빈 배열로 시작
  }

  let newItem = null;
  for (const item of targetItems) {
    const serviceName = item['서비스명'] || item.name;
    const isDuplicate = existingData.some(existing => existing.name === serviceName);
    if (!isDuplicate) {
      newItem = item;
      break;
    }
  }

  if (!newItem) {
    console.log("새로운 데이터가 없습니다");
    return;
  }

  // [3단계] Gemini AI로 새 항목 1개만 가공
  const prompt = `아래 공공데이터 1건을 분석해서 JSON 객체로 변환해줘. 형식:
{id: 숫자, name: 서비스명, category: '행사' 또는 '혜택', startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', location: 장소 또는 기관명, target: 지원대상, summary: 한줄요약, link: 상세URL}
category는 내용을 보고 행사/축제면 '행사', 지원금/서비스면 '혜택'으로 판단해.
startDate가 없으면 오늘 날짜, endDate가 없으면 '상시'로 넣어.
반드시 JSON 객체만 출력해. 다른 텍스트 없이.

데이터:
${JSON.stringify(newItem, null, 2)}`;

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  let processedItem;
  try {
    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!geminiRes.ok) {
      console.error("Gemini API error", await geminiRes.text());
      return;
    }

    const geminiData = await geminiRes.json();
    let generatedText = geminiData.candidates[0].content.parts[0].text;
    
    // 마크다운 코드블록 제거
    generatedText = generatedText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    processedItem = JSON.parse(generatedText);
    
    // id가 문자열이 아닌 경우 문자열로 형변환 (UI 연동 안전성 위해)
    if (processedItem.id) {
       processedItem.id = processedItem.id.toString();
    } else {
       processedItem.id = Date.now().toString();
    }
  } catch (err) {
    console.error("Failed to parse or fetch Gemini output:", err);
    return; // 에러 발생 시 기존 파일 유지
  }

  // [4단계] 기존 데이터에 추가
  existingData.push(processedItem);
  try {
    // 디렉토리 체크 후 파일 저장
    const dir = path.dirname(dataPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`새로운 공공서비스 항목이 추가되었습니다: ${processedItem.name}`);
  } catch (err) {
    console.error("Failed to write to local-info.json", err);
  }
}

run();
