/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const runFile = promisify(execFile);

function getTodayKstDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadAutoTopics() {
  const topicsPath = path.join(process.cwd(), 'scripts', 'choice-auto-topics.json');
  const raw = await fs.readFile(topicsPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('choice-auto-topics.json에 유효한 주제가 없습니다.');
  }
  return parsed;
}

function pickTopic(topics, dateKst) {
  const explicitIndex = Number(process.env.CHOICE_AUTO_TOPIC_INDEX || -1);
  if (Number.isInteger(explicitIndex) && explicitIndex >= 0 && explicitIndex < topics.length) {
    return topics[explicitIndex];
  }

  const day = Number(dateKst.slice(-2));
  const index = day % topics.length;
  return topics[index];
}

async function buildTempInput(topic, dateKst) {
  const englishName = slugify(topic.key || topic.title || `choice-auto-${dateKst}`);
  const payload = {
    title: topic.title,
    englishName,
    summary: topic.summary,
    brand: topic.brand || '픽앤조이 초이스',
    rating: topic.rating || '4.7',
    reviewCount: topic.reviewCount || '100',
    keywordHint: topic.keywordHint || [],
    tags: Array.isArray(topic.tags) ? topic.tags : ['쿠팡', '리뷰', '픽앤조이초이스'],
    outputFileName: `${dateKst}-choice-${englishName}.md`,
  };

  const tempPath = path.join(os.tmpdir(), `picknjoy-choice-auto-${Date.now()}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  return { tempPath, payload };
}

async function run() {
  const enabled = (process.env.CHOICE_AUTO_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('CHOICE_AUTO_ENABLED=false 이므로 자동 초이스 생성을 건너뜁니다.');
    return;
  }

  const dateKst = getTodayKstDate();
  const topics = await loadAutoTopics();
  const topic = pickTopic(topics, dateKst);
  const { tempPath, payload } = await buildTempInput(topic, dateKst);

  try {
    console.log(`자동 초이스 주제: ${topic.key || topic.title}`);
    console.log(`자동 키워드: ${(payload.keywordHint || []).join(', ') || '없음'}`);

    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-choice-post.js');
    const { stdout, stderr } = await runFile(process.execPath, [scriptPath, '--input', tempPath], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

run().catch((error) => {
  console.error(`❌ 자동 초이스 생성 실패: ${error.message}`);
  process.exit(1);
});