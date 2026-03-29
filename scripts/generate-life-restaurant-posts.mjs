import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POSTS_PER_RUN = Number(process.env.LIFE_RESTAURANT_POSTS_PER_RUN || '2');
const FORCE_RESTAURANT_SOURCE_IDS = new Set(
  String(process.env.FORCE_RESTAURANT_SOURCE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');

function slugifyKorean(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function inferLocality(address, regionLabel) {
  const text = String(address || '').trim();
  if (text.startsWith('인천')) return '인천';
  if (text.startsWith('서울')) return '서울';
  if (text.startsWith('경기')) return '경기';
  if (text.startsWith('부천')) return '경기';
  if (text.startsWith('김포')) return '경기';
  if (text.startsWith('수원')) return '경기';
  return regionLabel.includes('인천') ? '인천' : '서울/경기';
}

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

    if (sourceId && FORCE_RESTAURANT_SOURCE_IDS.has(sourceId)) {
      await fs.unlink(fullPath);
      ids.delete(sourceId);
      console.log(`♻️ 기존 맛집 포스트 재생성 준비: ${file} (${sourceId})`);
    }
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
  const locality = inferLocality(candidate.item.address, candidate.regionLabel);
  const slugKeyword = slugifyKorean(`${locality} ${candidate.item.name}`) || `restaurant-${candidate.item.id}`;
  const slugBase = `${today}-${slugKeyword}`;
  const defaultImage = '/images/default-og.svg';

  // Google 평점이 있으면 frontmatter에 평점 필드 포함 (posts.ts → JSON-LD aggregateRating 연결)
  const ratingFrontmatter = candidate.item.googleRating != null
    ? `\nrating_value: "${candidate.item.googleRating}"\nreview_count: "${candidate.item.googleRatingCount ?? ''}"`
    : '';

  const prompt = `아래 맛집 데이터를 바탕으로 '2030이 저장해두고 싶은 핫플 큐레이션 글'을 작성해줘.\n\n입력 데이터:\n${JSON.stringify(candidate, null, 2)}\n\n반드시 아래 형식만 출력해줘. 다른 설명은 절대 붙이지 마:\n---\ntitle: (콜론(:) 포함 시 반드시 큰따옴표로 감싸기)\ndate: ${today}\nsummary: (130~160자. 약속 전 메뉴/분위기 고민 + 이곳을 체크하게 되는 이유 + 기대 포인트를 자연스럽게 담기)\ndescription: (130~160자. 지역명/상호명/상황 키워드가 자연스럽게 들어간 검색용 문장)\ncategory: 픽앤조이 맛집 탐방\ntags: [맛집탐방, ${candidate.regionLabel}, ${candidate.areaTag}, ${candidate.item.cuisineHint || '핫플'}, ${candidate.item.vibeHint || '분위기맛집'}, 카카오맵]\nimage: \"${defaultImage}\"\nsource_id: \"${candidate.item.id}\"\nslug: \"${slugBase}\"\nplace_name: \"${candidate.item.name.replace(/"/g, '\\"')}\"\nplace_address: \"${candidate.item.address.replace(/"/g, '\\"')}\"\nplace_locality: \"${locality}\"\nplace_region: \"KR\"\nplace_phone: \"${candidate.item.phone.replace(/"/g, '\\"')}\"\nplace_url: \"${candidate.item.mapUrl.replace(/"/g, '\\"')}\"\nparking_info: \"확인 필요\"${ratingFrontmatter}\n---\n\n[핫플 맛집 생성 규칙]\n- 페르소나는 '힙한 핫플을 너무 과장 없이 골라주는 30대 초반 에디터'예요.\n- 글은 교과서 설명처럼 쓰지 말고, 친구에게 '여긴 저장해둬도 되겠다'라고 말해주는 톤으로 써줘.\n- 제목은 '지역 + 상황 + 왜 여기 체크하는지' 흐름으로, 너무 길지 않게 써줘.\n- 연도/숫자/TOP/베스트/총정리/완전정복/맛집 추천 리스트 같은 제목은 금지.\n- slug는 이미 정해져 있으니 바꾸지 마.\n- 첫 단락은 반드시 '뭐 먹지'보다 '오늘 약속 분위기 어디로 잡지' 같은 현실 고민에서 시작해줘.\n- 첫 훅은 너무 모범답안 같지 않게, 감정적으로 툭 던지는 문장이어야 해.\n- 본문 구조는 [공감되는 상황 → 왜 후보에 남는지 → 공간/동선/메뉴 결 → 가기 전 체크포인트] 흐름으로 써줘.\n- 소제목은 감성 문장형으로 3~4개. 숫자 번호(1. 2. 3.)는 사용 금지.\n- 문장은 짧고 템포 있게. 2문장마다 반드시 줄바꿈.\n- 경어체(~해요/~네요/~입니다)만 사용. 평어체(~이다/~한다) 금지.\n- 반드시 아래 입력값을 자연스럽게 활용해줘: sourceQuery, scenarioHint, vibeHint, cuisineHint.\n- 입력 데이터로 확인되지 않는 메뉴 세부, 웨이팅 시간, 인테리어 디테일, 대표 메뉴, 주차 가능 여부는 절대 단정하지 마.\n- 모르면 '확인 필요', '이럴 가능성이 있어 보여요', '이런 결을 기대하게 돼요'처럼 안전하게 써줘.\n- 금지어: 추천합니다, 방문해보세요, 만족도가 높습니다, 다양한 메뉴, 최고의 선택, 무조건, 찐으로, 인생맛집 TOP, 총정리.\n- 생활형 참견 한 줄을 2개 이상 넣어줘. 예: '이럴 땐 1차 후보에서 안 빼게 되더라고요.'\n- 조도, 공간감, 음식 결(질감·온도)처럼 감각적 묘사를 2개 이상 포함해줘. 단, 입력 데이터로 확인된 범위 내에서만.\n- 센서리 표현은 가능하지만, 입력 데이터로 확인 가능한 범위를 넘어서 구체적 맛/향/음악/인테리어를 지어내면 안 돼.\n- 마지막 문장은 광고 카피처럼 끝내지 말고, 에디터의 개인적인 여운 한 줄로 마무리해줘.\n\n[반드시 포함할 정보 박스 섹션]\n본문 후반에 '## 방문 정보 한눈에' 섹션을 만들고 아래를 모두 넣어줘.\n- 상호명: markdown 링크 형식으로 카카오맵 주소 연결\n- 주소\n- 전화번호\n- 주차: 확인 필요 (명확한 정보가 없으면 이렇게 쓰기)\n- 이럴 때 체크하면 좋아요: scenarioHint를 바탕으로 한 한 줄\n- 식사 후 동선: 근처에서 자연스럽게 이어갈 수 있는 스팟 한 곳 제안(카페·공원·편집샵 등, 확인되지 않으면 생략 가능)\n- 에디터 한 줄 평\n\n[형식 규칙]\n- 본문 첫 줄은 반드시 ## 훅 소제목\n- 표는 필요할 때만 간단히 사용\n- 마지막 줄에는 반드시 FILENAME: ${slugBase} 형식으로 출력\n`;

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

  finalContent = finalContent.replace(/^(description:\s*)(.+)$/m, (match, prefix, value) => {
    const clean = String(value || '').replace(/^"|"$/g, '').trim();
    const shortened = clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}...` : clean;
    return `${prefix}"${shortened.replace(/"/g, '\\"')}"`;
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
    .filter(({ item }) => item?.id && item?.name)
    .filter(({ item }) => {
      const sourceId = String(item.id);
      if (FORCE_RESTAURANT_SOURCE_IDS.size > 0) {
        return FORCE_RESTAURANT_SOURCE_IDS.has(sourceId);
      }
      return !existingIds.has(sourceId);
    })
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
