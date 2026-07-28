import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tests', 'model-ab');
const FESTIVAL_PATH = path.join(ROOT, 'public', 'data', 'festival.json');
const SUBSIDY_PATH = path.join(ROOT, 'public', 'data', 'subsidy.json');
function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const CLAUDE_SONNET_MODEL = 'claude-sonnet-5';
const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5';

const TEMPERATURE = 0.4;
const TOP_P = 0.92;
const MAX_OUTPUT_TOKENS = 8192;

const TOTAL_ALLOWED_CALLS = 9;
let totalCalls = 0;

function loadLocalEnvFiles() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fsSync.existsSync(envPath)) return;

  const raw = fsSync.readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key]) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function assertApiKeys() {
  if (!getGeminiApiKey()) {
    throw new Error('GEMINI_API_KEY is missing');
  }
  if (!getAnthropicApiKey()) {
    throw new Error('ANTHROPIC_API_KEY is missing');
  }
}

function isFestivalActive(item) {
  if (!item || item.expired === true) return false;
  const end = String(item.eventenddate || '').trim();
  return /^\d{8}$/.test(end);
}

function isSubsidyActive(item) {
  if (!item || item.expired === true) return false;
  const end = String(item.endDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(end) || end === '';
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function pickFixedSamples(festivalData, subsidyData) {
  const festivalSample = festivalData.find(isFestivalActive);
  const subsidySample = subsidyData.find(isSubsidyActive);
  const curationItems = subsidyData.filter(isSubsidyActive).slice(0, 3);

  if (!festivalSample) throw new Error('No festival sample found');
  if (!subsidySample) throw new Error('No subsidy sample found');
  if (curationItems.length < 3) throw new Error('Not enough curation source items');

  const curationSample = {
    title: '전국 보조금·복지 정책 큐레이션',
    generated_at: new Date().toISOString(),
    items: curationItems.map((item) => ({
      id: item['서비스ID'] || item.id || '',
      name: item['서비스명'] || item.title || item.name || '',
      summary: item['서비스목적요약'] || item.summary || '',
      agency: item['소관기관명'] || '',
      endDate: item.endDate || '',
      location: item.location || item.addr1 || '',
      tel: item['전화문의'] || item.tel || '',
    })),
  };

  return {
    festival: festivalSample,
    subsidy: subsidySample,
    curation: curationSample,
  };
}

function buildPrompt(category, candidate) {
  const today = new Date().toISOString().split('T')[0];

  return `아래 공공서비스/행사/정보를 바탕으로 블로그 글을 작성해줘.
카테고리: ${category}

정보: ${JSON.stringify(candidate, null, 2)}

아래 형식으로 출력해줘. 반드시 이 형식만 출력하고 다른 텍스트는 없이:
---
title: (친근하고 흥미로운 제목. 콜론(:) 포함 시 반드시 큰따옴표로 감싸기)
date: ${today}
summary: (130~160자 한국어 요약. 핵심 키워드를 앞에 배치. Google 검색 결과에 표시되는 문장이므로 금액·날짜·장소 등 구체적 정보 포함)
description: (summary와 동일한 내용)
category: ${category}
published_by: auto
tags: [태그1, 태그2, 태그3, 태그4, 태그5]
---

(본문: 1500자 이상, 아래 스타일 가이드 반드시 적용)
[글쓰기 스타일 가이드 - 반드시 따를 것]
- 페르소나: 30대 초반의 감각적인 여행·생활정보 에디터. 친절하고 세련된 형/오빠가 동생에게 추천해주는 톤.
- 종결어미 규칙 (절대 준수):
  · 금지: '~이다', '~한다', '~됐다', '~있다' 같은 평어체 종결어미
  · 필수: '~해요', '~거든요', '~입니다', '~네요', '~예요', '~있어요' 경어체만 사용
- AI 금지어 (절대 사용 금지): 결론적으로 / 무엇보다도 / 다양한 / 인상적인 / 포착한 / 주목할 만한 / 대표적인 / 각광받는 / 눈길을 끄는 / ~의 대명사가 됐다 / ~를 선사한다 / 즐길 수 있다 / 만끽할 수 있다
- 대신 쓸 표현: '진짜 대박인 건', '여긴 꼭 가봐야 해요', '생각보다 훨씬', '가보면 알아요', '핵심만 먼저 볼게요'
- 정보 나열 전에 반드시 시각적 묘사나 현장 기분을 먼저 써줄 것
- 마무리는 "함께 가면 좋은 사람" 같은 공식 추천 문구 절대 금지

(본문 작성 규칙 - MZ 감성 스타일 적용)
1) 본문 첫 줄은 반드시 훅(Hook) 소제목으로 시작: "## ..." 형식
2) 훅 첫 문장은 짧고 강렬하게, 1~2줄로 독자를 바로 끌어당길 것
3) 문체는 경어체 필수. '~해요/~거든요/~입니다/~네요' 종결어미만 사용할 것.
4) 이모지 자연스럽게 활용 (섹션 제목에 1~2개, 과하지 않게)
5) 꿀팁/주의사항은 불릿 대신 이모지 리스트로 표현
6) 추천 이유 3가지는 반드시 아래 형식으로 작성
  ### 1. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 2. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)

  ### 3. 소제목 (이모지 포함)
  (다음 줄에 설명 단락 2~4문장)
7) 소제목과 설명은 반드시 줄바꿈으로 분리
8) 표(table)를 적절히 활용
9) 전체 1000자 이상
10) 마무리는 작가 본인의 솔직한 한 줄 소감이나 특정 상황/감정을 자연스럽게 언급하며 끝낼 것
11) 문단은 최대 2~3문장마다 반드시 줄바꿈
12) 한 문단이 스마트폰 화면 기준 4~5줄을 넘지 않도록 짧게 끊을 것

마지막 줄에 FILENAME: YYYY-MM-DD-영문키워드 형식으로 파일명 출력`;
}

async function callGemini(prompt) {
  totalCalls += 1;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: TEMPERATURE,
        topP: TOP_P,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(client, model, prompt) {
  totalCalls += 1;
  const result = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return result?.content?.map((part) => part?.text || '').join('\n').trim();
}

function shuffleModels() {
  const labels = ['A', 'B', 'C'];
  const models = [
    { key: 'gemini', model: GEMINI_MODEL, provider: 'gemini' },
    { key: 'claude-sonnet', model: CLAUDE_SONNET_MODEL, provider: 'anthropic' },
    { key: 'claude-haiku', model: CLAUDE_HAIKU_MODEL, provider: 'anthropic' },
  ];

  const randomized = [...models].sort(() => {
    const v = crypto.randomInt(0, 2) === 0 ? -1 : 1;
    return v;
  });

  return labels.reduce((acc, label, index) => {
    acc[label] = randomized[index];
    return acc;
  }, {});
}

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function main() {
  loadLocalEnvFiles();
  assertApiKeys();

  const festivalData = await readJson(FESTIVAL_PATH);
  const subsidyData = await readJson(SUBSIDY_PATH);
  const samples = pickFixedSamples(festivalData, subsidyData);

  const prompts = {
    festival: buildPrompt('전국 축제·여행', samples.festival),
    subsidy: buildPrompt('전국 보조금·복지 정책', samples.subsidy),
    curation: buildPrompt('큐레이션', samples.curation),
  };

  const labelMapping = shuffleModels();
  const anthropic = new Anthropic({ apiKey: getAnthropicApiKey() });

  await ensureOutDir();

  const outputs = [];
  for (const material of ['festival', 'subsidy', 'curation']) {
    for (const label of ['A', 'B', 'C']) {
      const target = labelMapping[label];
      const prompt = prompts[material];
      let text = '';

      if (target.provider === 'gemini') {
        text = await callGemini(prompt);
      } else {
        text = await callClaude(anthropic, target.model, prompt);
      }

      const filename = `sample-${material}-${label}.md`;
      const filePath = path.join(OUT_DIR, filename);
      await fs.writeFile(filePath, `${text.trim()}\n`, 'utf-8');
      outputs.push(filename);
    }
  }

  if (totalCalls !== TOTAL_ALLOWED_CALLS) {
    throw new Error(`Unexpected call count: ${totalCalls} (expected ${TOTAL_ALLOWED_CALLS})`);
  }

  const answerKey = {
    generatedAt: new Date().toISOString(),
    allowedCalls: TOTAL_ALLOWED_CALLS,
    actualCalls: totalCalls,
    labels: labelMapping,
    materials: {
      festival: {
        sourceId: samples.festival.contentid || samples.festival.id || '',
        sourceName: samples.festival.title || samples.festival.name || '',
      },
      subsidy: {
        sourceId: samples.subsidy['서비스ID'] || samples.subsidy.id || '',
        sourceName: samples.subsidy['서비스명'] || samples.subsidy.title || samples.subsidy.name || '',
      },
      curation: {
        sourceId: 'subsidy-top3-fixed',
        sourceName: '전국 보조금·복지 정책 큐레이션',
      },
    },
    files: outputs,
  };

  await fs.writeFile(path.join(OUT_DIR, 'answer-key.json'), `${JSON.stringify(answerKey, null, 2)}\n`, 'utf-8');

  console.log(`done: ${outputs.length} files, calls=${totalCalls}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
