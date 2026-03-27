const fs = require('fs/promises');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// 카테고리별 우선순위 정렬 함수
function sortByPriority(items, category) {
  if (category === '인천 지역 정보') {
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
    return items.sort((a, b) => (b['조회수'] || 0) - (a['조회수'] || 0));
  }
  if (category === '전국 축제·여행') {
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

// 이미 작성된 블로그 글의 source_id 및 파일명 목록 가져오기
async function getExistingPosts(postsDir) {
  // source_id가 있는 파일: ID로 정확 매칭
  const serviceIds = new Set();
  // source_id가 없는 파일: 파일명 키워드로 부분 매칭
  const filenameKeywords = [];

  try {
    const files = await fs.readdir(postsDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(postsDir, file), 'utf-8');

      // source_id 추출 — 따옴표 제거 후 저장
      const idMatch = content.match(/^source_id:\s*(.+)\s*$/m);
      if (idMatch) {
        serviceIds.add(idMatch[1].trim().replace(/^["']|["']$/g, ''));
      } else {
        // source_id 없는 파일은 파일명(날짜 제외)을 키워드로 보관
        const keyword = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
        filenameKeywords.push(keyword);
      }
    }
  } catch (_) {}

  return { serviceIds, filenameKeywords };
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
summary: (130~160자 한국어 요약. 핵심 키워드를 앞에 배치. Google 검색 결과에 표시되는 문장이므로 금액·날짜·장소 등 구체적 정보 포함)
description: (summary와 동일한 내용)
category: ${candidate._category}
tags: [태그1, 태그2, 태그3, 태그4, 태그5]
---

(본문 작성 규칙)
1) 본문 첫 줄은 반드시 훅(Hook) 소제목으로 시작: "## ..." 형식 (절대 "#" 사용 금지)
2) 추천 이유 3가지는 반드시 아래 형식으로 작성
  ### 1. 소제목
  (다음 줄에 설명 단락)

  ### 2. 소제목
  (다음 줄에 설명 단락)

  ### 3. 소제목
  (다음 줄에 설명 단락)
3) "1. 소제목 설명"을 한 줄에 붙여 쓰지 말고, 소제목과 설명은 반드시 줄바꿈으로 분리
4) 전체 800자 이상, 친근한 블로그 톤, 신청 방법 안내 포함

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  });

  const generatedText = message.content?.[0]?.text || '';

  if (!generatedText) {
    console.error('Claude API 응답 없음');
    return false;
  }

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

  // source_id 반드시 삽입
  if (sourceId) {
    if (/^image:/m.test(finalContent)) {
      finalContent = finalContent.replace(/^(image:.*)$/m, `$1\nsource_id: "${sourceId}"`);
    } else {
      // image 필드가 없으면 tags 바로 뒤에 삽입
      finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nsource_id: "${sourceId}"`);
    }
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

  // slug 삽입: 파일명(확장자 제거)을 slug로 사용
  const slugValue = filename.replace(/\.md$/, '');
  if (/^source_id:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^(source_id:.*)$/m, `$1\nslug: "${slugValue}"`);
  } else if (!/^slug:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nslug: "${slugValue}"`);
  }

  await fs.writeFile(path.join(postsDir, filename), finalContent, 'utf-8');
  console.log(`✅ 생성 완료: ${filename} (${itemName})`);
  return true;
}

async function run() {
  if (!ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY");
    return;
  }

  const dataFiles = [
    { file: 'incheon.json', category: '인천 지역 정보' },
    { file: 'subsidy.json', category: '전국 보조금·복지 정책' },
    { file: 'festival.json', category: '전국 축제·여행' }
  ];

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  const { serviceIds, filenameKeywords } = await getExistingPosts(postsDir);
  console.log(`기존 블로그 글: source_id ${serviceIds.size}건, 파일명 키워드 ${filenameKeywords.length}건`);

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

    // 중복 체크: source_id 정확 매칭 우선, 없으면 파일명 키워드 부분 매칭
    const candidates = validItems.filter(item => {
      const name = item['서비스명'] || item['title'] || item['name'] || '';
      const id = String(item['서비스ID'] || item['contentid'] || item['id'] || '');
      if (!name) return false;

      // 1순위: source_id 정확 매칭
      if (id && serviceIds.has(id)) return false;

      // 2순위: source_id 없는 기존 파일의 파일명 키워드 부분 매칭
      if (filenameKeywords.some(kw => name.includes(kw) || kw.includes(name.slice(0, 6)))) return false;

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
          if (generated < 2) {
            console.log('  ⏳ 5초 대기 중...');
            await sleep(5000);
          }
        }
      } catch (err) {
        console.error(`  생성 오류: ${err.message}`);
      }
    }

    if (generated === 0) {
      console.log(`  ⚠️ 생성할 새 항목 없음`);
    }
  }

  console.log(`\n🎉 총 ${totalGenerated}편 생성 완료`);
}

run();
