/* eslint-disable @typescript-eslint/no-require-imports */
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');

const GEMINI_MODEL = process.env.CHOICE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.CHOICE_GEMINI_TIMEOUT_MS || 120000);
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.CHOICE_GEMINI_MAX_OUTPUT_TOKENS || 8192);

function loadLocalEnvFiles() {
  const envFiles = [
    { file: '.env', override: false },
    { file: '.env.local', override: true },
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile.file);
    if (!fsSync.existsSync(envPath)) continue;

    const raw = fsSync.readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (!key) continue;
      if (process.env[key] && !envFile.override) continue;

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function getGeminiApiKey() {
  loadLocalEnvFiles();
  return process.env.GEMINI_API_KEY || '';
}

function parseArgs(argv) {
  const args = { input: '', outdir: '', help: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--help' || key === '-h') {
      args.help = true;
      continue;
    }
    if (key === '--input' && next) {
      args.input = next;
      i++;
      continue;
    }
    if (key === '--outdir' && next) {
      args.outdir = next;
      i++;
      continue;
    }
  }
  return args;
}

function printHelp() {
  console.log('Usage: node scripts/generate-choice-post.js --input scripts/choice-input.json [--outdir src/content/life]');
  console.log('');
  console.log('Required JSON fields:');
  console.log('- title');
  console.log('- englishName  (example: cj-biocore-probiotics)');
  console.log('- summary');
  console.log('- coupangUrl');
  console.log('- coupangHtml');
  console.log('');
  console.log('Optional fields: sourceUrl, rating, reviewCount, tags, image, fileName, outputFileName, brand');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function extractCoupangBannerImage(coupangHtml) {
  const html = String(coupangHtml || '');
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultChoiceImage(candidate) {
  if (candidate.image) return String(candidate.image).trim();
  const baseName = toSlug(candidate.fileName || candidate.englishName || candidate.title || 'choice-item');
  return `/images/choice/${baseName}.jpg`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags) && tags.length > 0) return tags;
  return ['쿠팡', '리뷰', '라이프스타일', '자기관리', '픽앤조이초이스'];
}

function buildChoicePrompt(candidate, today) {
  const outputFileName = candidate.outputFileName || `${today}-choice-${candidate.englishName || 'choice-item'}.md`;
  return `당신은 픽앤조이(Pick-n-Joy)의 30대 초반 라이프스타일 에디터입니다.
아래 [입력 데이터]만 근거로, 호기심을 유발하지만 과장하지 않는 제품 큐레이션 포스트를 작성하세요.

[입력 데이터]
카테고리: 픽앤조이 초이스
제품정보: ${JSON.stringify(candidate, null, 2)}
쿠팡태그원문: ${candidate.coupangHtml}
참고링크: ${candidate.sourceUrl || '없음'}
작성일: ${today}

[출력 계약 - 반드시 준수]
1) 출력은 markdown 코드블록 하나만
2) frontmatter + 본문만 출력
3) 마지막 줄은 반드시: FILENAME: ${outputFileName}
4) 아래 금지 항목 포함 시 실패:
   - 1단계, 2단계, The Hook, The Choice, Curation 같은 구조 라벨
   - 본문 내 JSON-LD 코드
   - 본문 내 쿠팡 파트너스 고지문(하단 공통영역에서 자동 처리됨)
  - "가장 확실한 방법", "정착기", "완벽한", "무조건", "끝판왕" 같은 과장형 제목 문구
  - 입력 데이터에 없는 통계, 임상 수치, 비교 실험 결과, 사용자 후기 비율

[Frontmatter 스키마 - 키 이름 정확히]
---
title: "(자연스러운 한국어 제목. 번역투 금지. 문제 제기 + 제품명 + 선택 이유 구조 권장)"
date: "${today}"
slug: "choice-${candidate.englishName}"
summary: "(110~150자, 검색 노출용. 과장 없이 제품명/용도/선택 이유를 설명)"
description: "(summary와 동일)"
category: "픽앤조이 초이스"
tags: ["태그1", "태그2", "태그3", "태그4", "태그5", "쿠팡", "리뷰"]
rating_value: "${candidate.rating || '4.8'}"
review_count: "${candidate.reviewCount || '100'}"
image: "(아래 이미지 규칙 적용)"
source_id: "manual-choice-${candidate.englishName}"
coupang_link: "${candidate.coupangUrl}"
coupang_banner_image: "(쿠팡태그원문 내 이미지 URL 또는 입력값)"
coupang_banner_alt: "(제품명 + 핵심 사양 포함 대체텍스트)"
---

[본문 구조]
- 첫 소제목은 반드시 ## 로 시작하고, 한 문장 훅으로 독자 문제를 찌르기
- 소제목은 총 4~6개, 전부 자연어 제목 (번호/단계 라벨 금지)
- 아래 흐름을 반드시 포함:
  1) 공감 훅: 일상 장면 + 불편 포인트
  2) 검증 근거: 리뷰/스펙/비교 관점의 근거 2~3개
  3) 선택 근거: 왜 이 제품인지 명확한 기준
  4) 반론 처리: 아쉬운 점 1개 + 누구에게 맞는지/안 맞는지
  5) 마무리: 상황형 한 줄 평(여운)

[제목/리드 품질 규칙]
- 제목은 한국어로 자연스럽게 읽혀야 하며, 억지 번역투나 광고 문구처럼 보이면 실패
- 제목은 "왜 오래 살아남는 이유"처럼 중복 표현 금지
- 건강기능식품/영양제는 치료를 암시하는 표현 금지
- 리드 문단은 독자의 생활 장면을 먼저 보여주고, 바로 제품 자랑으로 뛰어들지 말 것
- 본문에 "The Choice" 또는 영어 구조 라벨을 그대로 쓰지 마세요

[호기심 유발 장치 - 최소 3개 반영]
- 반전 문장: "좋다는 말보다 먼저 봐야 할 건..."
- 대비 문장: "고함량인데도 불편함이 적은 이유는..."
- 구체 장면: "오후 3시 회의 전에 배가 묵직해질 때..."
- 데이터 갈등: "후기 평점은 높은데, 실제로 갈리는 포인트는..."
- 독자 질문: "그래서 내 루틴에 넣을 만하냐고요?"

※ 단, 위 장치는 입력 데이터와 어울릴 때만 사용하고 억지로 모두 넣지 말 것

[쿠팡파트너스 제휴 링크 규칙]
- 이 포스트는 Web/Mobile 모두 본문에 쿠팡 파트너스 제휴 링크를 반드시 포함해야 합니다.
- 쿠팡 배너나 위젯 형태의 본문 삽입은 여전히 금지됩니다. 텍스트 기반 CTA 링크만 본문에 넣으세요.
- 링크는 본문 중간에 **정확히 1회만** 삽입하세요.
- 제품 이미지가 있어도 상단(첫 소제목 직후)에는 링크를 넣지 말고, 본문 중간 전환 지점에 배치하세요.
- 링크는 별도 줄에 작성하고, 모바일에서 클릭하기 쉬운 문구로 만드세요.
- 예시: **👉 [제품명] 최저가 확인 및 상세정보 보기** / **🛒 오늘의 추천 상품, 실시간 할인 가격 확인하기**
- 기존 글 업데이트 시에도 원문 맥락을 유지하며 자연스럽게 제휴 링크를 후방 삽입하세요.
- 톤은 픽앤조이의 프리미엄 라이프스타일 큐레이션으로 유지하고, 지나치게 공격적이지 않게 작성하세요.

[큐레이션 포인트 섹션]
### 픽앤조이 큐레이션 포인트 3 ✨
1. **(짧고 강한 소제목)**
   (2~4문장. 효용 + 사용 맥락 + 왜 중요한지)
2. **(짧고 강한 소제목)**
   (2~4문장. 스펙이 실제 체감으로 어떻게 이어지는지)
3. **(짧고 강한 소제목)**
   (2~4문장. 경제성/루틴 지속성 관점)

### 솔직히 아쉬운 점 딱 하나 🧐
- (실제 사용자가 체감할 단점 1개를 구체적으로)

[이미지 규칙]
1) 배너 제외: 120x240 등 홍보 배너형 이미지는 frontmatter image로 사용 금지
2) 우선순위:
   - 참고링크에서 추출 가능한 고화질 제품 이미지
   - 없으면 /images/choice/${candidate.fileName || candidate.englishName}.jpg
3) 본문에 frontmatter image와 동일한 이미지 마크다운을 다시 넣지 말 것(상단 자동 노출과 중복 방지)
4) 본문 중간 상세 이미지는 최대 1장만 허용하며, 대표 이미지와 다른 파일일 때만 사용

[문체/톤]
- 반드시 경어체: ~해요 / ~거든요 / ~입니다 / ~네요
- 금지: ~이다 / ~한다 / ~됐다
- AI 금지어: 결론적으로, 무엇보다도, 다양한, 인상적인, 포착한, 주목할 만한, 대표적인, 각광받는, 눈길을 끄는, 대명사, 선사한다, 즐길 수 있다, 만끽할 수 있다
- 문단은 2~3문장마다 줄바꿈, 모바일 4~5줄 넘기지 말 것
- 이모지는 소제목 중심으로 1~3개만 절제해서 사용

[사실성/컴플라이언스]
- 입력 데이터 밖의 수치/효능/비교결과를 임의 생성 금지
- 입력 데이터 밖의 임상 결과, 만족도 수치, 검색량, 키워드 빈도, 타 제품 비교 우위 생성 금지
- 건강 제품은 질병 치료/예방 단정 금지
- 개인 체감, 사용자 후기 기반, 제품 정보 기준 같은 안전한 표현 사용
- 성분이나 설계가 좋아 보여도 "해결된다"보다 "기대하는 분이 많다", "이 점을 보고 고른다"처럼 완곡하게 표현

[품질 체크리스트 - 출력 전 자체 검증]
- frontmatter 필수 키 누락 없음
- category 값이 정확히 픽앤조이 초이스
- 본문에 단계 라벨 없음
- 본문에 JSON-LD/법적고지 없음
- 본문에 쿠팡 배너 삽입 없음 (CTA 텍스트 링크는 허용)`;
}

function dedupeAffiliateLinks(content, coupangUrl) {
  const url = String(coupangUrl || '').trim();
  if (!url) return content;

  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mdLinkRegex = new RegExp(`^\\*\\*[^\\n]*\\[[^\\]]+\\]\\(${escapedUrl}\\)[^\\n]*\\*\\*\\s*$`, 'gim');
  const matches = Array.from(content.matchAll(mdLinkRegex));

  if (matches.length <= 1) return content;

  const last = matches[matches.length - 1][0];
  let removed = content.replace(mdLinkRegex, '').replace(/\n{3,}/g, '\n\n').trim();

  if (/\n\n###\s+/m.test(removed)) {
    removed = removed.replace(/\n\n###\s+/, `\n\n${last}\n\n### `);
  } else {
    removed = `${removed}\n\n${last}`;
  }

  return removed.replace(/\n{3,}/g, '\n\n').trim();
}

async function callGemini(prompt) {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${geminiApiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.92,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API 오류: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function removeCodeFence(text) {
  let value = String(text || '').trim();
  if (value.startsWith('```markdown')) value = value.slice(11);
  else if (value.startsWith('```md')) value = value.slice(5);
  else if (value.startsWith('```')) value = value.slice(3);
  if (value.endsWith('```')) value = value.slice(0, -3);
  return value.trim();
}

function splitFilenameLine(content, fallbackName) {
  const lines = content.split('\n');
  let filename = '';
  const bodyLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      bodyLines.push(line);
    }
  }
  if (!filename) filename = fallbackName;
  if (!filename.endsWith('.md')) filename += '.md';
  return { filename, content: bodyLines.join('\n').trim() };
}

function upsertFrontmatterField(content, key, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return content;

  const escaped = value.replace(/"/g, '\\"');
  const line = `${key}: "${escaped}"`;
  const fieldRegex = new RegExp(`^${key}:.*$`, 'm');
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, line);
  }

  const endIdx = content.indexOf('\n---\n', 4);
  if (content.startsWith('---\n') && endIdx > -1) {
    const frontmatter = content.slice(0, endIdx + 1);
    const rest = content.slice(endIdx + 1);
    return `${frontmatter}${line}\n${rest}`;
  }
  return content;
}

function normalizeGeneratedContent(content, candidate) {
  let value = String(content || '').trim();

  value = value
    .replace(/##\s*\d+단계\s*:\s*/g, '## ')
    .replace(/##\s*The\s+Hook/gi, '## 시작은 작지만 불편함은 컸어요')
    .replace(/##\s*The\s+Choice/gi, '## 픽앤조이의 선택')
    .replace(/##\s*Curation/gi, '## 왜 이 제품을 골랐을까요?');

  value = value
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/이\s*아래의\s*JSON-LD[\s\S]*$/i, '')
    .replace(/^.*쿠팡\s*파트너스\s*활동의\s*일환.*$/gim, '')
    .replace(/^.*본\s*콘텐츠는\s*AI\s*기술을\s*활용.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const slug = `choice-${toSlug(candidate.englishName || candidate.fileName || candidate.title || 'item')}`;
  const bannerImage = candidate.coupangBannerImage || extractCoupangBannerImage(candidate.coupangHtml);

  value = upsertFrontmatterField(value, 'slug', slug);
  value = upsertFrontmatterField(value, 'category', '픽앤조이 초이스');
  value = upsertFrontmatterField(value, 'summary', candidate.summary || '');
  value = upsertFrontmatterField(value, 'description', candidate.summary || candidate.description || '');
  value = upsertFrontmatterField(value, 'rating_value', String(candidate.rating || '4.8'));
  value = upsertFrontmatterField(value, 'review_count', String(candidate.reviewCount || '100'));
  value = upsertFrontmatterField(value, 'image', defaultChoiceImage(candidate));
  value = upsertFrontmatterField(value, 'source_id', `manual-choice-${toSlug(candidate.englishName || candidate.fileName || 'item')}`);
  value = upsertFrontmatterField(value, 'coupang_link', String(candidate.coupangUrl || '').trim());
  if (bannerImage) value = upsertFrontmatterField(value, 'coupang_banner_image', bannerImage);
  value = upsertFrontmatterField(value, 'coupang_banner_alt', String(candidate.title || '').trim());
  value = dedupeAffiliateLinks(value, candidate.coupangUrl);

  return value;
}

async function loadCandidate(inputPath) {
  const raw = await fs.readFile(inputPath, 'utf-8');
  const parsed = JSON.parse(raw);

  const required = ['title', 'englishName', 'summary', 'coupangUrl', 'coupangHtml'];
  for (const key of required) {
    if (!parsed[key]) {
      throw new Error(`입력 JSON 필수값 누락: ${key}`);
    }
  }

  parsed.tags = normalizeTags(parsed.tags);
  parsed.outputFileName = String(parsed.outputFileName || '').trim();
  parsed.fileName = toSlug(parsed.fileName || parsed.englishName || parsed.title);
  parsed.englishName = toSlug(parsed.englishName || parsed.fileName || parsed.title);
  parsed.coupangBannerImage = parsed.coupangBannerImage || extractCoupangBannerImage(parsed.coupangHtml);
  return parsed;
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const inputPath = args.input || process.env.CHOICE_INPUT_PATH || path.join(process.cwd(), 'scripts', 'choice-input.json');
  const outDir = args.outdir || process.env.CHOICE_OUTPUT_DIR || path.join(process.cwd(), 'src', 'content', 'life');

  const candidate = await loadCandidate(inputPath);
  const today = todayIso();
  const prompt = buildChoicePrompt(candidate, today);

  console.log(`CHOICE_GEMINI_MODEL: ${GEMINI_MODEL}`);
  console.log(`입력 파일: ${inputPath}`);

  let generated = '';
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      generated = await callGemini(prompt);
      if (generated && generated.trim()) break;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`Gemini 호출 재시도 ${attempt + 1}/${maxAttempts}: ${err.message}`);
    }
  }

  if (!generated || !generated.trim()) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }

  const stripped = removeCodeFence(generated);
  const fallbackName = candidate.outputFileName || `${today}-choice-${candidate.englishName}.md`;
  const withFilename = splitFilenameLine(stripped, fallbackName);
  const normalized = normalizeGeneratedContent(withFilename.content, candidate);

  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, withFilename.filename);
  await fs.writeFile(outputPath, normalized.trim() + '\n', 'utf-8');

  console.log(`✅ 초이스 포스트 생성 완료: ${outputPath}`);
}

run().catch((err) => {
  console.error(`❌ 실패: ${err.message}`);
  process.exit(1);
});
