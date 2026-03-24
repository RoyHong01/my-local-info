const fs = require('fs/promises');
const path = require('path');

async function run() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in process.env");
    return;
  }

  // [1단계] 최신 데이터 확인
  const dataPath = path.join(process.cwd(), 'public', 'data', 'local-info.json');
  let data = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    data = JSON.parse(fileContent);
  } catch (err) {
    console.error("Failed to read local-info.json:", err.message);
    return;
  }

  if (data.length === 0) {
    console.log("데이터가 없습니다.");
    return;
  }

  // 마지막 항목 가져오기
  const latestItem = data[data.length - 1];
  const itemName = latestItem.name || latestItem["서비스명"];
  
  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');

  try {
    await fs.mkdir(postsDir, { recursive: true });
  } catch (e) {
    // Ignore if directory already exists
  }

  let postsFiles = [];
  try {
    postsFiles = await fs.readdir(postsDir);
  } catch (err) {
    console.error("Failed to read posts directory:", err.message);
    return;
  }

  let isDuplicate = false;
  for (const file of postsFiles) {
    if (file.endsWith('.md')) {
      const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
      // 글 안에 이름이 포함되어 있는지로 중복 여부 확인
      if (itemName && content.includes(itemName)) {
        isDuplicate = true;
        break;
      }
    }
  }

  if (isDuplicate) {
    console.log("이미 작성된 글입니다");
    return;
  }

  // [2단계] Gemini AI로 블로그 글 생성
  const prompt = `아래 공공서비스 정보를 바탕으로 블로그 글을 작성해줘.

정보: ${JSON.stringify(latestItem, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목)
date: (오늘 날짜 YYYY-MM-DD)
summary: (한 줄 요약)
category: 정보
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

  // [3단계] 파일 저장
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
  
  // 마크다운 코드블록 안의 내용일 경우 정리
  if (finalContent.startsWith('```markdown')) {
    finalContent = finalContent.substring(11);
  } else if (finalContent.startsWith('```')) {
    finalContent = finalContent.substring(3);
  }
  
  if (finalContent.endsWith('```')) {
    finalContent = finalContent.substring(0, finalContent.length - 3);
  }
  
  finalContent = finalContent.trim();

  // 안전장치
  if (!filename) {
    const today = new Date().toISOString().split('T')[0];
    filename = `${today}-new-service`;
  }
  
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  const destPath = path.join(postsDir, filename);

  try {
    await fs.writeFile(destPath, finalContent, 'utf-8');
    console.log(`블로그 글 성공적으로 생성: ${filename}`);
  } catch (err) {
    console.error("Failed to save blog post:", err.message);
  }
}

run();
