import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POSTS_PER_RUN = Number(process.env.LIFE_RESTAURANT_POSTS_PER_RUN || '2');
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${err}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0] || {};
  return {
    text: candidate?.content?.parts?.[0]?.text || '',
    finishReason: candidate?.finishReason || '',
  };
}

function looksIncompleteGeminiOutput(text) {
  const value = (text || '').trim();
  if (!value) return true;
  if (!/FILENAME:\s*\S+/m.test(value)) return true;

  const withoutFilename = value
    .split('\n')
    .filter((line) => !line.trim().startsWith('FILENAME:'))
    .join('\n')
    .trim();

  if (withoutFilename.length < 900) return true;
  if (!/[.!?…]$/.test(withoutFilename)) return true;
  return false;
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
  const seed = (title || fallback || '이번 맛집').trim();
  const cleaned = seed
    .replace(/["'“”‘’]/g, '')
    .replace(/[!?.,:;]+$/g, '')
    .trim();
  const core = cleaned.split(/[,:]/)[0].trim() || cleaned;
  return `## ${core}, 여기서 결정하면 고민이 좀 줄어들어요`;
}

function postProcessRestaurantMarkdown(markdown, context) {
  const { frontmatter, body } = splitMarkdownSections(markdown);
  let normalizedBody = (body || '').trim();

  normalizedBody = normalizedBody
    .split('\n')
    .map((line) => line.replace(/^#\s+/, '## '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const firstNonEmpty = normalizedBody.split('\n').find((line) => line.trim()) || '';
  if (!/^##\s+/.test(firstNonEmpty)) {
    const title = extractTitleFromFrontmatter(frontmatter) || context.itemName;
    normalizedBody = `${buildHookFromTitle(title, context.itemName)}\n\n${normalizedBody}`;
  }

  // 숫자형 보고서 톤 소제목이 나오면 최대한 완화
  normalizedBody = normalizedBody
    .replace(/^###\s+1\.\s+/gm, '### 이 지점이 먼저 끌려요 — ')
    .replace(/^###\s+2\.\s+/gm, '### 그래서 후보에서 안 빼게 돼요 — ')
    .replace(/^###\s+3\.\s+/gm, '### 가기 전에 이것만 챙기면 돼요 — ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return `${frontmatter}\n\n${normalizedBody}`.trim();
}

async function getExistingRestaurantSourceIds() {
  const ids = new Set();
  await fs.mkdir(postsDir, { recursive: true });
  const files = await fs.readdir(postsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const fullPath = path.join(postsDir, file);
    const raw = await fs.readFile(fullPath, 'utf-8');
    const parsed = matter(raw);
    if (parsed.data.category !== '픽앤조이 맛집 탐방') continue;
    const sourceId = String(parsed.data.source_id || parsed.data.sourceId || '').trim();
    if (sourceId) ids.add(sourceId);
  }

  return ids;
}

async function readSnapshot() {
  const raw = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(raw);
}

function buildRoundRobinCandidates(regions) {
  const queues = Object.entries(regions).map(([region, items]) => ({
    region,
    items: Array.isArray(items) ? [...items] : [],
  }));

  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      if (queue.items.length > 0) {
        out.push({ region: queue.region, item: queue.items.shift() });
        progressed = true;
      }
    }
  }
  return out;
}

async function generateRestaurantPost(candidate) {
  const today = new Date().toISOString().split('T')[0];
  const slugBase = `${today}-restaurant-${candidate.item.id}`;
  const defaultImage = '/images/default-og.svg';

  const prompt = `아래 맛집 데이터를 바탕으로 'AI 티 나지 않는 고품격 맛집 블로그 글'을 작성해줘.\n\n입력 데이터:\n${JSON.stringify(candidate, null, 2)}\n\n반드시 아래 형식만 출력해줘. 다른 설명은 절대 붙이지 마:\n---\ntitle: (콜론(:) 포함 시 반드시 큰따옴표로 감싸기)\ndate: ${today}\nsummary: (130~160자. 문제 상황 + 왜 이곳을 보게 됐는지 + 기대 포인트를 자연스럽게 담기)\ndescription: (summary와 동일)\ncategory: 픽앤조이 맛집 탐방\ntags: [맛집탐방, ${candidate.regionLabel}, ${candidate.areaTag}, 로컬맛집, 카카오맵]\nimage: \"${defaultImage}\"\nsource_id: \"${candidate.item.id}\"\nslug: \"${slugBase}\"\n---\n\n[맛집 카테고리 전용 생성 규칙]\n- 제목은 '지역 + 상황 + 보상' 구조로 작성해.\n- 연도/숫자/TOP/베스트/총정리/완전정복 같은 나열형 제목은 금지.\n- 예: \"송도에서 메뉴 고민 길어질 때, 결국 여기로 정하면 마음이 편해져요\"\n- 첫 단락은 반드시 '뭐 먹을지/어디 갈지 고민' 같은 페인 포인트로 시작해.\n- 본문 구조는 [공감 → 발견 근거 → 디테일 → 가기 전 팁] 흐름으로 써줘.\n- 소제목은 감성 문장형으로 3~4개. 숫자 번호(1. 2. 3.)는 사용 금지.\n- 문장은 짧고 모바일 가독성 좋게. 2문장마다 반드시 줄바꿈.\n- 경어체(~해요/~입니다/~네요)만 사용. 평어체(~이다/~한다) 금지.\n- 금지어: 추천합니다, 최고의 선택, 다양한 메뉴, 방문해보세요, 무조건, 인생맛집 TOP, 총정리.\n- 리뷰/카카오맵 톤을 참고한 것처럼 쓰되, 입력 데이터에 없는 사실은 단정하지 마.\n- 메뉴명, 맛, 인테리어, 주차, 웨이팅, 예약 팁은 입력 데이터로 확인되거나 상호명에서 합리적으로 추론 가능한 범위만 언급해.\n- 모르면 '확인 필요' 또는 조심스럽게 표현해. 절대 지어내지 마.\n- 과장 광고 문구 금지. 대신 생활형 참견 한 줄은 1개 이상 넣어.\n  예: '이럴 땐 후보에서 제일 먼저 남겨두게 되더라고요.'\n- 본문 끝에는 작가의 개인적인 여운 한 줄로 마무리해.\n\n[반드시 포함할 정보 박스 섹션]\n본문 후반에 '## 방문 정보 한눈에' 섹션을 만들고 아래를 모두 넣어줘.\n- 상호명: markdown 링크 형식으로 카카오맵 주소 연결\n- 주소\n- 전화번호\n- 주차: 확인 필요 (명확한 정보가 없으면 이렇게 쓰기)\n- 에디터 한 줄 평\n\n[형식 규칙]\n- 본문 첫 줄은 반드시 ## 훅 소제목\n- 표는 필요할 때만 간단히 사용\n- 마지막 줄에는 반드시 FILENAME: ${slugBase} 형식으로 출력\n`;

  let generatedText = '';
  let lastFinishReason = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const retryHint = attempt > 1
      ? '\n\n[재시도 지시]\n응답이 중간에 끊기지 않게 처음부터 완성본으로 다시 작성하고, 마지막 줄 FILENAME까지 반드시 출력해줘.'
      : '';

    const gemini = await callGemini(`${prompt}${retryHint}`);
    generatedText = gemini.text || '';
    lastFinishReason = gemini.finishReason || '';

    const incomplete = lastFinishReason === 'MAX_TOKENS' || looksIncompleteGeminiOutput(generatedText);
    if (!incomplete) break;
    if (attempt < 3) await sleep(2000);
  }

  if (!generatedText || looksIncompleteGeminiOutput(generatedText)) {
    throw new Error(`Gemini 응답 불완전(finishReason=${lastFinishReason || 'N/A'})`);
  }

  const lines = generatedText.split('\n');
  let filename = `${slugBase}.md`;
  const contentLines = [];
  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = `${line.replace('FILENAME:', '').trim().replace(/\.md$/i, '')}.md`;
    } else {
      contentLines.push(line);
    }
  }

  let finalContent = contentLines.join('\n').trim();
  if (finalContent.startsWith('```markdown')) finalContent = finalContent.substring(11);
  else if (finalContent.startsWith('```')) finalContent = finalContent.substring(3);
  if (finalContent.endsWith('```')) finalContent = finalContent.slice(0, -3);
  finalContent = finalContent.trim();

  finalContent = finalContent.replace(/^(title:\s*)(.+)$/m, (match, prefix, value) => {
    if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
      return `${prefix}"${value.replace(/"/g, '\\"')}"`;
    }
    return match;
  });

  finalContent = postProcessRestaurantMarkdown(finalContent, {
    itemName: candidate.item.name,
  });

  await fs.writeFile(path.join(postsDir, filename), finalContent, 'utf-8');
  console.log(`✅ 맛집 포스트 생성: ${filename} (${candidate.item.name})`);
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  const snapshot = await readSnapshot();
  const existingIds = await getExistingRestaurantSourceIds();
  const rawCandidates = buildRoundRobinCandidates(snapshot.regions || {});

  const candidates = rawCandidates
    .filter(({ item }) => item?.id && item?.name && !existingIds.has(String(item.id)))
    .map(({ region, item }) => ({
      region,
      regionLabel: region === 'incheon-gyeongin' ? '인천/경인' : '서울/경기',
      areaTag: region === 'incheon-gyeongin' ? '송도·부천·김포' : '서울·경기·수원',
      item,
    }))
    .slice(0, POSTS_PER_RUN);

  console.log(`🥢 맛집 포스트 생성 후보: ${candidates.length}건`);
  if (candidates.length === 0) {
    console.log('생성할 새 맛집 포스트가 없습니다.');
    return;
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    await generateRestaurantPost(candidate);
    if (i < candidates.length - 1) {
      console.log('  ⏳ 5초 대기 중...');
      await sleep(5000);
    }
  }
}

run().catch((error) => {
  console.error('❌ 맛집 포스트 생성 실패', error);
  process.exit(1);
});
