const fs = require('fs/promises');
const path = require('path');

async function run() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in process.env");
    return;
  }

  // [1단계] 3개 데이터 파일 모두 읽기
  const dataFiles = [
    { file: 'incheon.json', category: '인천 지역 정보' },
    { file: 'subsidy.json', category: '전국 보조금·복지 정책' },
    { file: 'festival.json', category: '전국 축제·여행' }
  ];

  let allItems = [];
  for (const { file, category } of dataFiles) {
    const dataPath = path.join(process.cwd(), 'public', 'data', file);
    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const items = JSON.parse(content);
      allItems = allItems.concat(items.map(item => ({ ...item, _category: category })));
    } catch (_) {
      console.log(`${file} 없음, 건너뜀`);
    }
  }

  if (allItems.length === 0) {
    console.log("데이터가 없습니다.");
    return;
  }

  // [2단계] 이미 블로그 글이 있는 항목 확인
  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  let postsFiles = [];
  try {
    postsFiles = await fs.readdir(postsDir);
  } catch (err) {
    console.error("Failed to read posts directory:", err.message);
    return;
  }

  let postsContent = '';
  for (const file of postsFiles) {
    if (file.endsWith('.md')) {
      postsContent += await fs.readFile(path.join(postsDir, file), 'utf-8');
    }
  }

  // 아직 글이 없는 항목 선택 (만료되지 않은 것 우선)
  const candidate = allItems.find(item => {
    const name = item['서비스명'] || item['title'] || item['name'] || '';
    return name && !postsContent.includes(name) && !item.expired;
  });

  if (!candidate) {
    console.log("블로그 글을 생성할 새로운 항목이 없습니다.");
    return;
  }

  // [3단계] Gemini 2.5 Pro로 블로그 글 생성
  const prompt = `아래 공공서비스/행사/정보를 바탕으로 블로그 글을 작성해줘.
카테고리: ${candidate._category}

정보: ${JSON.stringify(candidate, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목)
date: (오늘 날짜 YYYY-MM-DD)
summary: (한 줄 요약)
category: ${candidate._category}
tags: [태그1, 태그2, 태그3]
---

(본문: 800자 이상, 친근한 블로그 톤, 추천 이유 3가지 포함, 신청 방법 안내)

마지막 줄에 FILENAME: YYYY-MM-DD-keyword 형식으로 파일명도 출력해줘. 키워드는 영문으로.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  let geminiRes;
  try {
    geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
  } catch (err) {
    console.error("Gemini fetch error:", err.message);
    return;
  }

  if (!geminiRes.ok) {
    console.error("Gemini API error:", await geminiRes.text());
    return;
  }

  let geminiData;
  try {
    geminiData = await geminiRes.json();
  } catch (err) {
    console.error("Failed to parse Gemini JSON:", err.message);
    return;
  }

  const generatedText = geminiData.candidates[0].content.parts[0].text;

  // [4단계] 파일 저장
  const lines = generatedText.split('\n');
  let filename = '';
  let contentLines = [];

  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  let finalContent = contentLines.join('\n').trim();

  if (finalContent.startsWith('```markdown')) {
    finalContent = finalContent.substring(11);
  } else if (finalContent.startsWith('```')) {
    finalContent = finalContent.substring(3);
  }
  if (finalContent.endsWith('```')) {
    finalContent = finalContent.substring(0, finalContent.length - 3);
  }
  finalContent = finalContent.trim();

  // YAML frontmatter에서 title 값에 콜론이 있으면 따옴표로 감싸기
  finalContent = finalContent.replace(/^(title:\s*)(.+)$/m, (match, prefix, value) => {
    if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
      return `${prefix}"${value.replace(/"/g, '\\"')}"`;
    }
    return match;
  });

  if (!filename) {
    const today = new Date().toISOString().split('T')[0];
    filename = `${today}-new-post`;
  }
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  const destPath = path.join(postsDir, filename);
  try {
    await fs.writeFile(destPath, finalContent, 'utf-8');
    console.log(`블로그 글 생성 완료: ${filename}`);
  } catch (err) {
    console.error("Failed to save blog post:", err.message);
  }
}

run();
