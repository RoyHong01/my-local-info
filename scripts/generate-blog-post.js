const fs = require('fs/promises');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 블로그 글 생성: Gemini 1.5 Pro 사용
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2048,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

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

function splitMarkdownSections(markdown) {
  const normalized = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: '', body: normalized };
  }

  const frontmatter = normalized.slice(0, end + 5);
  const body = normalized.slice(end + 5).trim();
  return { frontmatter, body };
}

function extractTitleFromFrontmatter(frontmatter) {
  const m = frontmatter.match(/^title:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function buildHookFromTitle(title, fallback) {
  const seed = (title || fallback || '이번 소식').trim();
  const cleaned = seed
    .replace(/["'“”‘’]/g, '')
    .replace(/[!?.,:;]+$/g, '')
    .trim();
  const core = cleaned.split(/[,:]/)[0].trim() || cleaned;
  return `## ${core}, 핵심부터 빠르게 볼까요?`;
}

function normalizeNumberedInlineSections(content) {
  const lines = content.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const numberedBoldInline = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*[:：]?\s+(.+)$/);
    if (numberedBoldInline) {
      out.push(`### ${numberedBoldInline[1]}. ${numberedBoldInline[2].trim()}`);
      out.push('');
      out.push(numberedBoldInline[3].trim());
      out.push('');
      continue;
    }

    const numberedBoldOnly = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*$/);
    if (numberedBoldOnly) {
      out.push(`### ${numberedBoldOnly[1]}. ${numberedBoldOnly[2].trim()}`);
      out.push('');
      continue;
    }

    const standaloneBoldNumber = trimmed.match(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/);
    if (standaloneBoldNumber) {
      out.push(`### ${standaloneBoldNumber[1]}. ${standaloneBoldNumber[2].trim()}`);
      out.push('');
      continue;
    }

    const emojiNumberHeading = trimmed.match(/^\*\*([1-9])(?:\uFE0F?\u20E3)\s+(.+?)\*\*\s*$/u);
    if (emojiNumberHeading) {
      out.push(`### ${emojiNumberHeading[1]}. ${emojiNumberHeading[2].trim()}`);
      out.push('');
      continue;
    }

    const emojiPlainHeading = trimmed.match(/^([1-9])(?:\uFE0F?\u20E3)\s+(.+)$/u);
    if (emojiPlainHeading) {
      out.push(`### ${emojiPlainHeading[1]}. ${emojiPlainHeading[2].trim()}`);
      out.push('');
      continue;
    }

    const plainWithDesc = trimmed.match(
      /^(\d+)\.\s+(.+?(?:니다|요|됩니다|있습니다|합니다|간단합니다|큽니다|좋습니다|가능합니다))\s+(.+)$/
    );
    if (plainWithDesc) {
      out.push(`### ${plainWithDesc[1]}. ${plainWithDesc[2].trim()}`);
      out.push('');
      out.push(plainWithDesc[3].trim());
      out.push('');
      continue;
    }

    const standalonePlainNumber = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (standalonePlainNumber) {
      out.push(`### ${standalonePlainNumber[1]}. ${standalonePlainNumber[2].trim()}`);
      out.push('');
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function removeFalseCodeBlockIndentation(content) {
  return content
    .split('\n')
    .map((line) => {
      if (!/^\s+/.test(line)) return line;
      if (/^\s*(```|~~~)/.test(line)) return line;
      if (/^\s*>/.test(line)) return line;
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) return line;
      return line.trimStart();
    })
    .join('\n');
}

function calculateToneScore(content) {
  const emotionalKeywords = [
    '따스', '설렘', '기분', '여유', '기다리고', '추천', '즐겨', '함께',
    '소중한', '특별한', '가볍게', '산책', '봄바람', '감성', '마음', '따뜻'
  ];

  let score = 0;
  if (/\?/.test(content)) score += 20;
  if (/##\s+/.test(content)) score += 15;
  if (/###\s+1\./.test(content) && /###\s+2\./.test(content) && /###\s+3\./.test(content)) score += 25;

  const hitCount = emotionalKeywords.reduce((acc, keyword) => {
    return acc + (content.includes(keyword) ? 1 : 0);
  }, 0);
  score += Math.min(30, hitCount * 5);

  if (content.length >= 1000) score += 10;
  return Math.min(100, score);
}

function ensureEmotionalIntro(body, category) {
  const paragraphs = body.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return body;

  const introText = paragraphs.slice(0, 2).join(' ');
  const hasEmotion = /(따스|설렘|여유|기분|함께|특별한|소중한|가볍게|마음)/.test(introText);
  if (hasEmotion) return body;

  const fallbackByCategory = {
    '전국 축제·여행': '여행의 설렘이 필요한 주말이라면, 잠깐의 발걸음으로도 기분 좋은 추억을 만들 수 있어요.',
    '전국 보조금·복지 정책': '복잡하게 느껴지는 정책도 생활 속 언어로 풀어보면, 지금 바로 도움이 되는 정보가 됩니다.',
    '인천 지역 정보': '우리 동네의 작은 변화가 일상을 더 따뜻하게 만들 수 있다는 점, 그래서 더 반갑게 느껴집니다.',
  };

  const fallback = fallbackByCategory[category] || '오늘 정보가 여러분의 하루를 조금 더 가볍고 따뜻하게 만들어주길 바랍니다.';

  // 훅 바로 다음에 감성 도입 단락 추가
  if (/^##\s+.+/m.test(body)) {
    return body.replace(/^(##\s+.+)$/m, `$1\n\n${fallback}`);
  }
  return `${fallback}\n\n${body}`;
}

function postProcessGeneratedMarkdown(markdown, context) {
  const { frontmatter, body } = splitMarkdownSections(markdown);
  let normalizedBody = (body || '').trim();

  // 본문 H1은 H2로 낮춰 카드 메인 제목보다 과도하게 커 보이지 않게 처리
  normalizedBody = normalizedBody
    .split('\n')
    .map((line) => line.replace(/^#\s+/, '## '))
    .join('\n');

  // 훅 누락 시 자동 삽입
  const firstNonEmpty = normalizedBody.split('\n').find((line) => line.trim().length > 0) || '';
  if (!/^##\s+/.test(firstNonEmpty)) {
    const title = extractTitleFromFrontmatter(frontmatter) || context.itemName;
    normalizedBody = `${buildHookFromTitle(title, context.itemName)}\n\n${normalizedBody}`;
  }

  normalizedBody = normalizeNumberedInlineSections(normalizedBody);
  normalizedBody = removeFalseCodeBlockIndentation(normalizedBody);
  normalizedBody = ensureEmotionalIntro(normalizedBody, context.category);
  normalizedBody = normalizedBody.replace(/\n{3,}/g, '\n\n').trim();

  const toneScore = calculateToneScore(normalizedBody);
  const summary = {
    toneScore,
    hasHook: /^##\s+/.test((normalizedBody.split('\n').find((line) => line.trim()) || '')),
    hasReasonStructure: /###\s+1\./.test(normalizedBody) && /###\s+2\./.test(normalizedBody) && /###\s+3\./.test(normalizedBody),
    length: normalizedBody.length,
  };

  return {
    content: `${frontmatter}\n\n${normalizedBody}`.trim(),
    summary,
  };
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

※ 이미지 주의사항:
- image 필드에는 반드시 글의 핵심 주제와 직접 관련된 이미지 URL을 사용할 것
- 벚꽃 글에 일본 사진, 산수유 글에 벚꽃 사진처럼 관련 없는 이미지는 절대 사용 금지
- TourAPI firstimage가 있으면 그것을 최우선 사용 (가장 관련성 높음)
- TourAPI 이미지가 없으면 카테고리 기본 SVG 사용 (잘못된 외부 이미지보다 낫다)
- 절대로 주제와 무관한 Unsplash 또는 외부 이미지 URL을 임의로 삽입하지 말 것

[정보 완전성 규칙 - 가장 중요, 반드시 지킬 것]
제공된 JSON 데이터에 있는 아래 항목들을 본문에 빠짐없이 모두 포함할 것.
단 하나도 생략하지 말 것:

서비스명/title/name: 서비스 정확한 이름
서비스목적요약/summary/description: 서비스 목적
지원내용: 구체적인 지원 금액, 혜택, 횟수 등 모든 세부 내용
지원대상: 자격 조건 전체 (나이, 거주지, 소득 기준 등 모든 조건)
신청방법: 신청 절차, 방법, 기간, 기한 등
접수기관명/location: 신청 장소
전화문의/tel: 연락처 (반드시 포함)
소관기관명: 담당 기관
선정기준: 선정 기준이 있으면 반드시 포함
eventstartdate/eventenddate/startDate/endDate: 일정/기간
addr1/addr2: 주소
overview: 상세 설명 전체
※ 위 항목 중 JSON에 있는 것은 하나도 빠뜨리지 말 것. 정보 누락 = 잘못된 글.

(본문: 1500자 이상, 아래 스타일 가이드 반드시 적용)
[글쓰기 스타일 가이드 - 반드시 따를 것]
- 페르소나: 30대 초반의 감각적인 여행·생활정보 에디터. 친절하고 세련된 형/오빠가 동생에게 추천해주는 톤.
- 종결어미 규칙 (절대 준수):
  · 금지: '~이다', '~한다', '~됐다', '~있다' 같은 평어체 종결어미
  · 필수: '~해요', '~거든요', '~입니다', '~네요', '~예요', '~있어요' 경어체만 사용
  · 틀림 예: "고창은 전북에 위치한 도시다."
  · 맞음 예: "고창은 전북에 있는 작은 도시인데요, 진짜 한 번쯤은 가볼 만해요."
- AI 금지어 (절대 사용 금지): 결론적으로 / 무엇보다도 / 다양한 / 인상적인 / 포착한 / 주목할 만한 / 대표적인 / 각광받는 / 눈길을 끄는 / ~의 대명사가 됐다 / ~를 선사한다 / 즐길 수 있다 / 만끽할 수 있다
- 대신 쓸 표현: '진짜 대박인 건', '여긴 꼭 가봐야 해요', '솔직히 말하면', '생각보다 훨씬', '가보면 알아요'
- 정보 나열 전에 반드시 시각적 묘사나 현장 기분을 먼저 써줄 것
  예: "초록색 바다에 들어와 있는 것 같은 기분이었어요."
- 숫자·통계는 딱딱하게 쓰지 말고 비유로 풀어줄 것
  예: "77만㎡면 여의도 공원 두 배 크기예요. 진짜 말이 안 되는 넓이거든요."
- 마무리는 "함께 가면 좋은 사람" 같은 공식 추천 문구 절대 금지. 대신 작가의 주관적인 한 줄 평이나 '이런 상황에 가면 딱이다'는 짧은 여운으로 끝낼 것
  예1: "저는 다음에 부모님 모시고 한 번 더 오려고요. 효도 점수 제대로 딸 것 같거든요. 😉"
  예2: "혼자 조용히 생각 정리하고 싶을 때, 여기 창가 자리가 제일 먼저 떠오를 것 같네요."
  예3: "다들 벚꽃만 보러 가는데, 저는 개인적으로 이 초록색 청보리가 더 마음을 울리더라고요."
- 이모지 1~2개 자연스럽게 사용 (남발 금지)

(본문 작성 규칙 - MZ 감성 스타일 적용)
1) 본문 첫 줄은 반드시 훅(Hook) 소제목으로 시작: "## ..." 형식 (절대 "#" 사용 금지)
2) 훅 첫 문장은 짧고 강렬하게, 1~2줄로 독자를 바로 끌어당길 것
  - 예시: "솔직히 말할게요." / "D-5." / "지금 당장 짐 싸세요." / "이건 진짜예요."
3) 문체는 경어체 필수. '~해요/~거든요/~입니다/~네요' 종결어미만 사용할 것.
  - '~이다/~한다/~됐다' 평어체 종결어미는 절대 금지
  - 'AI 금지어' (결론적으로/다양한/인상적인 등) 사용 금지
  - 정보 설명 전에 시각적 묘사나 현장 기분을 먼저 쓸 것
  - 단, 과장/허위/확인되지 않은 정보는 절대 작성 금지
4) 이모지 자연스럽게 활용 (섹션 제목에 1~2개, 과하지 않게)
5) 꿀팁/주의사항은 불릿 대신 이모지 리스트로 표현
  - 예: 🚗 주차는 일찍 / 📸 포토존은 오전 / ☕ 근처 카페도 필수
6) 추천 이유 3가지는 반드시 아래 형식으로 작성
  ### 1. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 2. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 3. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)
7) 소제목과 설명은 반드시 줄바꿈으로 분리 (한 줄에 붙여 쓰지 말 것)
8) 표(table)를 적절히 활용하면 가독성 UP (방문 시간대, 코스 비교 등)
9) 전체 1000자 이상, 신청/방문 방법 안내 포함
10) 마무리는 "함께 가면 좋은 사람" 같은 공식 추천 문구 금지. 작가 본인의 솔직한 한 줄 소감이나 특정 상황/감정을 자연스럽게 언급하며 끝낼 것

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;

  const generatedText = await callGemini(prompt);

  if (!generatedText) {
    console.error('Gemini API 응답 없음');
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

  // image 필드 삽입 (이미 있으면 덮어쓰기, 없으면 tags 뒤에 삽입)
  if (/^image:/m.test(finalContent)) {
    finalContent = finalContent.replace(/^image:.*$/m, `image: "${imageUrl}"`);
  } else {
    finalContent = finalContent.replace(/^(tags:\s*\[.*\])$/m, `$1\nimage: "${imageUrl}"`);
  }

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

  // 생성 후 자동 후처리(구조 보정 + 감성 품질 점검)
  const postProcessed = postProcessGeneratedMarkdown(finalContent, {
    itemName,
    category: candidate._category,
  });
  finalContent = postProcessed.content;
  console.log(`  🔎 품질 점검: tone=${postProcessed.summary.toneScore}/100, hook=${postProcessed.summary.hasHook ? 'Y' : 'N'}, reasons=${postProcessed.summary.hasReasonStructure ? 'Y' : 'N'}, len=${postProcessed.summary.length}`);

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
