try { require('dotenv').config({ path: '.env.local' }); } catch (_) {}
const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POSTS_DIR = path.join(__dirname, '../src/content/posts');

const TARGET_FILES = [
  '2026-03-26-gwangan-drone-lightshow.md',
  '2026-03-26-namsan-bongsoo-festival.md',
  '2026-03-27-gangneung-gyeongpo-cherry-blossom.md',
  '2026-03-27-gaya-culture-festival.md',
  '2026-03-27-gurye-sansuyu-flower-festival.md',
  '2026-03-27-nakdonggang-cherry-blossom-festival.md',
  '2026-03-27-nationwide-cherry-blossom-top-15.md',
  '2026-03-27-post-1774652966257.md',
  '2026-03-27-seoul-royal-guard-ceremony.md',
  '2026-03-27-yeouido-spring-flower-festival.md',
  '2026-03-28-gochang-barley-field-festival.md',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized.startsWith('---\n')) return { frontmatter: '', body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: '', body: normalized };
  return {
    frontmatter: normalized.slice(0, end + 5),
    body: normalized.slice(end + 5).trim(),
  };
}

function buildStyleGuide() {
  const lines = [
    '[전국 축제 전용 규칙]',
    '- 제목에 연도(2026 등) 금지. 완전정복/총정리/핵심정리 금지.',
    '- 소제목에 숫자 번호(1. 2. 3.) 금지. 감성 소제목으로.',
    '- 분리선(---) 전체에서 최대 1번만 사용.',
    '',
    '[글쓰기 스타일]',
    '- 페르소나: 30대 초반 감각적인 여행 에디터.',
    '- 경어체 필수: 해요/거든요/입니다/네요만 사용.',
    '- 이다/한다/됐다 평어체 절대 금지.',
    '- 금지어: 결론적으로/무엇보다도/다양한/인상적인/포착한/주목할 만한/대표적인/각광받는/선사한다/즐길 수 있다/만끽할 수 있다.',
    '- 정보 나열 전에 시각적 묘사나 현장 기분 먼저.',
    '- 숫자는 비유로: 77만㎡면 여의도 공원 두 배 크기예요.',
    '- 마무리: 함께 가면 좋은 사람 금지. 작가 본인 솔직한 한 줄 소감.',
    '',
    '[본문 구조]',
    '- 첫 줄: ## 훅 소제목 (# 사용 금지)',
    '- 1500자 이상 (절대 중간에 끊으면 안됨. 반드시 마무리까지 완성할 것)',
    '- 꿀팁: 이모지 리스트 (주차/포토존/교통 등)',
    '- 이모지 1~2개 자연스럽게 (남발 금지)',
    '- 기존 글의 날짜/장소/연락처/입장료 등 실질 정보 반드시 유지',
    '- 글 마지막은 반드시 완전한 문장으로 끝낼 것',
  ];
  return lines.join('\n');
}

function buildPrompt(title, body) {
  return [
    '아래 블로그 글의 본문을 스타일 지침에 맞게 완전히 재작성해줘.',
    '',
    '제목: ' + title,
    '',
    '기존 본문:',
    body,
    '',
    buildStyleGuide(),
    '',
    '중요: 본문만 출력할 것. frontmatter(---로 감싼 부분) 제외.',
    '반드시 1500자 이상으로 작성하고 마지막 문장까지 완성할 것.',
    '토큰 제한으로 중간에 끊기면 안됨.',
  ].join('\n');
}

async function callGemini(prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + GEMINI_API_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw new Error('Gemini 오류: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function run() {
  console.log('재작성 시작. 대상:', TARGET_FILES.length, '개');
  for (let i = 0; i < TARGET_FILES.length; i++) {
    const filename = TARGET_FILES[i];
    const filePath = path.join(POSTS_DIR, filename);
    console.log('\n[' + (i + 1) + '/' + TARGET_FILES.length + '] ' + filename);

    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (e) {
      console.log('파일 없음, 건너뜀');
      continue;
    }

    const { frontmatter, body } = parseFrontmatter(content);
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim().replace(/^"|"$/g, '') : filename;

    console.log('제목:', title);
    console.log('기존 본문 길이:', body.length, '자');

    const prompt = buildPrompt(title, body);

    let newBody;
    try {
      newBody = await callGemini(prompt);
      if (!newBody || newBody.length < 500) throw new Error('응답이 너무 짧음: ' + (newBody || '').length + '자');
    } catch (e) {
      console.error('Gemini 실패:', e.message, '→ 원본 유지');
      continue;
    }

    console.log('새 본문 길이:', newBody.length, '자');

    const newContent = frontmatter + '\n\n' + newBody.trim();
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log('저장 완료 ✓');

    if (i < TARGET_FILES.length - 1) {
      console.log('15초 대기...');
      await sleep(15000);
    }
  }
  console.log('\n전체 완료!');
}

run().catch(console.error);
