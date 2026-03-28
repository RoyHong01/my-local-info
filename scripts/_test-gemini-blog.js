const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const item = {
  "서비스ID": "349000000108",
  "서비스명": "저소득 노인 부분틀니 지대치 비용 지원",
  "서비스목적요약": "구강건강 상태가 취약한 중구 저소득층 노인을 대상으로 부분틀니 시술 시 지대치 비용 지원",
  "서비스분야": "보건·의료",
  "소관기관명": "인천광역시 중구",
  "신청기한": "시술 완료일로부터 30일 이내에 신청",
  "신청방법": "방문신청",
  "전화문의": "복지정책과/032-760-7524",
  "지원내용": "지원대상: 인천광역시 중구에 2년 이상 주민등록상 주소를 두고 거주하는 만 65세 이상 의료급여 수급권자 중 의료급여법에 따른 노인틀니 지원대상자로 부분틀니를 사전등록하고 지대치 시술을 종료한 자. 지대치: 부분틀니를 지지하는 역할의 치아. 지원내용: 1인당 최대 2대, 최대 50만원 지원 (본인부담 10% 제외). 지원횟수: 7년에 1회",
  "지원대상": "인천광역시 중구에 2년 이상 주민등록상 주소를 두고 거주하는 65세 이상 의료급여 수급권자 중 의료급여법에 따른 노인틀니 지원대상자로 부분틀니를 사전등록하고 지대치 시술을 종료한 자",
  "지원유형": "현금",
  "상세조회URL": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/349000000108",
  "_category": "인천 지역 정보"
};

const prompt = `아래 공공서비스 정보를 바탕으로 블로그 글을 작성해줘.
카테고리: 인천 지역 정보

정보: ${JSON.stringify(item, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목. 콜론(:) 포함 시 반드시 큰따옴표로 감싸기)
date: 2026-03-28
summary: (130~160자 한국어 요약. 핵심 키워드를 앞에 배치. Google 검색 결과에 표시되는 문장이므로 금액·날짜·장소 등 구체적 정보 포함)
description: (summary와 동일한 내용)
category: 인천 지역 정보
tags: [태그1, 태그2, 태그3, 태그4, 태그5]
image: "https://pick-n-joy.com/images/default-incheon.svg"
source_id: "349000000108"
---

[Gemini 감성 글쓰기 지침 - 반드시 따를 것]
- 독자가 글을 읽는 순간 당장이라도 도움을 받고 싶은 생동감 넘치는 MZ 스타일 문체로 작성
- 감성적이고 따뜻하되, MZ 세대가 공감하는 솔직하고 톡톡 튀는 표현 사용
  예) "진짜 이건 알고 가야 해요", "이거 모르면 진짜 손해", "부모님께 꼭 알려드리세요"
- 첫 문장은 독자의 감성을 자극하는 도입부로 시작
  예) "부모님 치아 걱정되신 적 있으신가요?", "사실 이런 지원이 있는지 몰랐어요."
- 이모지를 자연스럽게 활용해 읽는 재미를 더할 것 🦷✨
- 마무리는 독자가 당장 행동하고 싶게 만드는 따뜻한 한마디로 끝낼 것
- 딱딱한 공문서 스타일, 항목 나열식 정보 전달은 절대 금지

(본문 작성 규칙 - MZ 감성 스타일 적용)
1) 본문 첫 줄은 반드시 훅(Hook) 소제목으로 시작: "## ..." 형식
2) 훅 첫 문장은 짧고 강렬하게, 1~2줄로 독자를 바로 끌어당길 것
3) 문체는 친구에게 말하듯 편하게. 존댓말이지만 가볍고 자연스럽게
4) 추천 이유 또는 핵심 포인트 3가지는 반드시 아래 형식으로 작성:
  ### 1. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 2. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 3. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)
5) 표(table)를 활용해 신청 정보 정리 (신청방법, 기한, 문의처 등)
6) 전체 1000자 이상, 신청 방법 안내 포함
7) 마무리는 감성 있게, 독자가 바로 행동하고 싶게 만드는 한마디로 끝낼 것

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  console.log('Gemini API 호출 중...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${err}`);
  }

  const data = await res.json();
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!generatedText) {
    console.error('응답 없음');
    process.exit(1);
  }

  // FILENAME 추출
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

  if (!filename) {
    filename = `2026-03-28-post-${Date.now()}`;
  }
  if (!filename.endsWith('.md')) filename += '.md';

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  const outPath = path.join(postsDir, filename);
  await fs.writeFile(outPath, finalContent, 'utf-8');

  console.log(`\n✅ 저장 완료: ${filename}`);
  console.log(`\n--- 생성된 내용 미리보기 ---\n`);
  console.log(finalContent.substring(0, 800));
  console.log('\n...(이하 생략)');
}

main().catch(console.error);
