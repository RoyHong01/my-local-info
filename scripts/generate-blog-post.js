const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 카테고리별 우선순위 정렬 함수
function sortByPriority(items, category) {
  if (category === '인천 지역 정보') {
    // 행사/축제 우선, 최근 등록 순
    return items.sort((a, b) => {
      const aIsEvent = ['행사', '축제', '문화'].some(k =>
        (a['서비스명'] || a['name'] || '').includes(k));
      const bIsEvent = ['행사', '축제', '문화'].some(k =>
        (b['서비스명'] || b['name'] || '').includes(k));
      if (aIsEvent && !bIsEvent) return -1;
      if (!aIsEvent && bIsEvent) return 1;
      return (b['조회수'] || 0) - (a['조회수'] || 0);
    });
  }
  if (category === '전국 보조금·복지 정책') {
    // 조회수 높은 것 우선 (인기 보조금)
    return items.sort((a, b) => (b['조회수'] || 0) - (a['조회수'] || 0));
  }
  if (category === '전국 축제·여행') {
    // 이미지 있는 것 우선 (콘텐츠 풍성), 그 다음 가까운 날짜 순
    return items.sort((a, b) => {
      const aHasImg = !!(a.firstimage || a.firstimage2);
      const bHasImg = !!(b.firstimage || b.firstimage2);
      if (aHasImg && !bHasImg) return -1;
      if (!aHasImg && bHasImg) return 1;
      return (a.eventstartdate || '').localeCompare(b.eventstartdate || '');
    });
  }
  return items;
}

// 이미 작성된 블로그 제목 목록 가져오기
async function getExistingTitles(postsDir) {
  const titles = new Set();
  const serviceIds = new Set();
  try {
    const files = await fs.readdir(postsDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
      // frontmatter에서 title 추출
      const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) titles.add(titleMatch[1].trim());
      // source_id 추출 (중복 방지용)
      const idMatch = content.match(/^source_id:\s*(.+)\s*$/m);
      if (idMatch) serviceIds.add(idMatch[1].trim());
    }
  } catch (_) {}
  return { titles, serviceIds };
}

// 30초 대기
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 블로그 글 1편 생성
async function generatePost(candidate, postsDir) {
  const defaultImages = {
    '인천 지역 정보': 'https://pick-n-joy.com/images/default-incheon.svg',
    '전국 보조금·복지 정책': 'https://pick-n-joy.com/images/default-subsidy.svg',
    '전국 축제·여행': 'https://pick-n-joy.com/images/default-festival.svg',
  };
  const imageUrl = candidate.firstimage || candidate.firstimage2
    || defaultImages[candidate._category]
    || 'https://pick-n-joy.com/images/default-og.svg';

  const itemName = candidate['서비스명'] || candidate['title'] || candidate['name'] || '';
  const sourceId = candidate['서비스ID'] || candidate['contentid'] || candidate['id'] || '';

  const prompt = `아래 공공서비스/행사/정보를 바탕으로 블로그 글을 작성해줘.
카테고리: ${candidate._category}

정보: ${JSON.stringify(candidate, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목. 콜론(:) 포함 시 반드시 큰따옴표로 감싸기)
date: (오늘 날짜 YYYY-MM-DD)
summary: (한 줄 요약, 50자 이내)
category: ${candidate._category}
tags: [태그1, 태그2, 태그3]
---

(본문: 800자 이상, 친근한 블로그 톤, 추천 이유 3가지 포함, 신청 방법 안내)

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Gemini API 오류: ${err}`);
    return false;
  }

  const data = await res.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // 파일명 추출
  const lines = generatedText.split('\n');
  let filename = '';
  const contentLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  let finalContent = contentLines.join('\n').trim();
  if (finalContent.startsWith('```markdown')) finalContent = finalContent.substring(11);
  else if (finalContent.startsWith('```')) finalContent = finalContent.substring(3);
  if (finalContent.endsWith('```')) finalContent = finalContent.slice(0, -3);
  finalContent = finalContent.trim();

  // image 필드 삽입
  finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nimage: "${imageUrl}"`);

  // source_id 삽입 (중복 방지용 ID)
  if (sourceId) {
    finalContent = finalContent.replace(/^(image:.*)$/m, `$1\nsource_id: "${sourceId}"`);
  }

  // title 콜론 처리
  finalContent = finalContent.replace(/^(title:\s*)(.+)$/m, (match, prefix, value) => {
    if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
      return `${prefix}"${value.replace(/"/g, '\\"')}"`;
    }
    return match;
  });

  if (!filename) {
    const today = new Date().toISOString().split('T')[0];
    filename = `${today}-post-${Date.now()}`;
  }
  if (!filename.endsWith('.md')) filename += '.md';

  await fs.writeFile(path.join(postsDir, filename), finalContent, 'utf-8');
  console.log(`✅ 생성 완료: ${filename} (${itemName})`);
  return true;
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    return;
  }

  const dataFiles = [
    { file: 'incheon.json', category: '인천 지역 정보' },
    { file: 'subsidy.json', category: '전국 보조금·복지 정책' },
    { file: 'festival.json', category: '전국 축제·여행' }
  ];

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  const { titles, serviceIds } = await getExistingTitles(postsDir);
  console.log(`기존 블로그 글: ${titles.size}편`);

  let totalGenerated = 0;

  for (const { file, category } of dataFiles) {
    console.log(`\n📂 카테고리: ${category}`);
    const dataPath = path.join(process.cwd(), 'public', 'data', file);
    let items = [];
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      items = JSON.parse(content);
    } catch (_) {
      console.log(`${file} 없음, 건너뜀`);
      continue;
    }

    // 만료 제외 + 우선순위 정렬
    const validItems = sortByPriority(
      items.filter(item => !item.expired),
      category
    );

    // 아직 글 없는 항목 필터링
    const candidates = validItems.filter(item => {
      const name = item['서비스명'] || item['title'] || item['name'] || '';
      const id = item['서비스ID'] || item['contentid'] || item['id'] || '';
      if (!name) return false;
      // 제목 또는 ID로 중복 체크
      if (serviceIds.has(String(id))) return false;
      // 이름이 기존 제목에 포함되면 건너뜀
      for (const t of titles) {
        if (t.includes(name) || name.includes(t.slice(0, 10))) return false;
      }
      return true;
    });

    console.log(`  미작성 항목: ${candidates.length}개`);

    // 카테고리당 2편 생성
    let generated = 0;
    for (const candidate of candidates) {
      if (generated >= 2) break;
      try {
        const ok = await generatePost({ ...candidate, _category: category }, postsDir);
        if (ok) {
          generated++;
          totalGenerated++;
          // API 쿼터 보호: 글 사이 30초 대기
          if (generated < 2 && candidates.indexOf(candidate) < candidates.length - 1) {
            console.log('  ⏳ 30초 대기 중...');
            await sleep(30000);
          }
        }
      } catch (err) {
        console.error(`  생성 오류: ${err.message}`);
      }
    }

    if (generated === 0) {
      console.log(`  ⚠️ 생성할 새 항목 없음`);
    }

    // 카테고리 사이 30초 대기
    if (dataFiles.indexOf({ file, category }) < dataFiles.length - 1) {
      console.log('\n⏳ 다음 카테고리까지 30초 대기...');
      await sleep(30000);
    }
  }

  console.log(`\n🎉 총 ${totalGenerated}편 생성 완료`);
}

run();
