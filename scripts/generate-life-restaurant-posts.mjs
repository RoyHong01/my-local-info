import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { execFileSync } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const TARGET_POSTS_PER_RUN = Number(process.env.LIFE_RESTAURANT_POSTS_PER_RUN || '3');
const TARGET_POSTS_PER_BUCKET = Number(process.env.LIFE_RESTAURANT_POSTS_PER_BUCKET || '1');
const BOOTSTRAP_MIN_PER_BUCKET = Number(process.env.LIFE_RESTAURANT_BOOTSTRAP_MIN_PER_BUCKET || '0');
const MIN_UNUSED_CANDIDATES = Number(process.env.MIN_UNUSED_RESTAURANT_CANDIDATES || '10');
const TARGET_BUCKETS = ['seoul', 'incheon', 'gyeonggi'];
const FORCE_RESTAURANT_SOURCE_IDS = new Set(
  String(process.env.FORCE_RESTAURANT_SOURCE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const postsDir = path.join(process.cwd(), 'src', 'content', 'life');
const existingPostDirs = [
  path.join(process.cwd(), 'src', 'content', 'posts'),
  path.join(process.cwd(), 'src', 'content', 'life'),
];

function slugifyKorean(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function slugifyAscii(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function inferAreaSlug(candidate, locality) {
  const sourceText = [
    locality,
    candidate?.item?.sourceQuery || '',
    candidate?.item?.address || '',
  ].join(' ');

  const areaMap = [
    ['송도', 'songdo'],
    ['청라', 'cheongna'],
    ['구월', 'guwol'],
    ['부평', 'bupyeong'],
    ['부천', 'bucheon'],
    ['김포', 'gimpo'],
    ['성수', 'seongsu'],
    ['연남', 'yeonnam'],
    ['강남', 'gangnam'],
    ['잠실', 'jamsil'],
    ['행궁', 'haenggung'],
    ['수원', 'suwon'],
    ['판교', 'pangyo'],
    ['서울', 'seoul'],
    ['인천', 'incheon'],
    ['경기', 'gyeonggi'],
  ];

  for (const [korean, romanized] of areaMap) {
    if (sourceText.includes(korean)) return romanized;
  }

  const localitySlug = slugifyAscii(locality);
  return localitySlug || 'korea';
}

function buildRestaurantSlug(candidate, locality) {
  const areaSlug = inferAreaSlug(candidate, locality);
  const nameSlugAscii = slugifyAscii(candidate?.item?.name || '');
  const nameSlug = nameSlugAscii || `restaurant-${candidate?.item?.id || 'unknown'}`;
  return `${areaSlug}-${nameSlug}`;
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

function classifyRegionBucket(item) {
  const source = [item?.address || '', item?.sourceQuery || '', item?.name || ''].join(' ');

  if (/서울/.test(source)) return 'seoul';
  if (/인천/.test(source)) return 'incheon';

  if (/경기|수원|성남|용인|고양|안양|화성|하남|의왕|의정부|광명|군포|파주|남양주|김포|부천|판교|분당|광교|동탄/.test(source)) {
    return 'gyeonggi';
  }

  // 기본값: 서울/인천이 아닌 수도권 후보는 경기로 분류
  return 'gyeonggi';
}

function toAreaTag(bucket) {
  if (bucket === 'seoul') return '서울';
  if (bucket === 'incheon') return '인천';
  return '경기';
}

function classifyBucketFromPostFrontmatter(data) {
  const locality = String(data?.place_locality || data?.placeLocality || '').trim();
  if (locality === '서울') return 'seoul';
  if (locality === '인천') return 'incheon';
  if (locality === '경기') return 'gyeonggi';

  const tags = Array.isArray(data?.tags) ? data.tags.join(' ') : String(data?.tags || '');
  const source = [
    tags,
    String(data?.place_address || data?.placeAddress || ''),
    String(data?.title || ''),
  ].join(' ');

  if (/서울/.test(source)) return 'seoul';
  if (/인천/.test(source)) return 'incheon';
  return 'gyeonggi-other';
}

function selectCandidatesByBucket(candidates, existingBucketCounts) {
  const buckets = new Map(TARGET_BUCKETS.map((bucket) => [bucket, []]));

  for (const candidate of candidates) {
    const bucket = classifyRegionBucket(candidate.item);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push({ ...candidate, regionBucket: bucket, areaTag: toAreaTag(bucket) });
  }

  const selected = [];
  const desiredByBucket = new Map();

  for (const bucket of TARGET_BUCKETS) {
    if (BOOTSTRAP_MIN_PER_BUCKET > 0) {
      const existing = existingBucketCounts.get(bucket) || 0;
      desiredByBucket.set(bucket, Math.max(0, BOOTSTRAP_MIN_PER_BUCKET - existing));
    } else {
      desiredByBucket.set(bucket, TARGET_POSTS_PER_BUCKET);
    }
  }

  const totalWanted = BOOTSTRAP_MIN_PER_BUCKET > 0
    ? Array.from(desiredByBucket.values()).reduce((acc, count) => acc + count, 0)
    : TARGET_POSTS_PER_RUN;

  let remaining = 0;
  for (const bucket of TARGET_BUCKETS) {
    const list = buckets.get(bucket) || [];
    const desired = desiredByBucket.get(bucket) || 0;
    const picked = list.slice(0, desired);
    if (picked.length < desired) {
      console.warn(`⚠️ ${bucket} 버킷 후보 부족: ${picked.length}/${desired}`);
      remaining += desired - picked.length;
    }
    selected.push(...picked);
  }

  // 부족한 버킷의 남은 슬롯을 다른 버킷에 재분배
  if (remaining > 0) {
    for (const bucket of TARGET_BUCKETS) {
      if (remaining <= 0) break;
      const list = buckets.get(bucket) || [];
      const alreadyPicked = desiredByBucket.get(bucket) || 0;
      const extra = list.slice(alreadyPicked);
      const fill = extra.slice(0, remaining);
      if (fill.length > 0) {
        console.log(`♻️ ${bucket} 버킷에서 ${fill.length}건 추가 선택 (부족 버킷 재분배)`);
        selected.push(...fill);
        remaining -= fill.length;
      }
    }
  }

  return selected.slice(0, totalWanted);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
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

async function getExistingRestaurantStats() {
  const ids = new Set();
  const bucketCounts = new Map(TARGET_BUCKETS.map((bucket) => [bucket, 0]));

  await fs.mkdir(postsDir, { recursive: true });

  for (const dir of existingPostDirs) {
    let files = [];
    try {
      await fs.mkdir(dir, { recursive: true });
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(dir, file);
      const raw = await fs.readFile(fullPath, 'utf-8');
      const parsed = matter(raw);
      if (parsed.data.category !== '픽앤조이 맛집 탐방') continue;

      const sourceId = String(parsed.data.source_id || parsed.data.sourceId || '').trim();
      if (sourceId) ids.add(sourceId);

      const bucket = classifyBucketFromPostFrontmatter(parsed.data);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);

      if (sourceId && FORCE_RESTAURANT_SOURCE_IDS.has(sourceId)) {
        await fs.unlink(fullPath);
        ids.delete(sourceId);
        bucketCounts.set(bucket, Math.max(0, (bucketCounts.get(bucket) || 1) - 1));
        console.log(`♻️ 기존 맛집 포스트 재생성 준비: ${file} (${sourceId})`);
      }
    }
  }

  return { ids, bucketCounts };
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
  const slugBase = buildRestaurantSlug(candidate, locality);
  const fileStem = `${today}-${slugBase}`;
  const defaultImage = '/images/default-restaurant.svg';

  // Google 평점이 있으면 frontmatter에 평점 필드 포함 (posts.ts → JSON-LD aggregateRating 연결)
  const ratingFrontmatter = candidate.item.googleRating != null
    ? `\nrating_value: "${candidate.item.googleRating}"\nreview_count: "${candidate.item.googleRatingCount ?? ''}"`
    : '';

  const prompt = `아래 맛집 데이터를 바탕으로 '2030이 저장해두고 싶은 핫플 큐레이션 글'을 작성해줘.\n\n입력 데이터:\n${JSON.stringify(candidate, null, 2)}\n\n반드시 아래 형식만 출력해줘. 다른 설명은 절대 붙이지 마:\n---\ntitle: (콜론(:) 포함 시 반드시 큰따옴표로 감싸기)\ndate: ${today}\nsummary: (130~160자. 약속 전 메뉴/분위기 고민 + 이곳을 체크하게 되는 이유 + 기대 포인트를 자연스럽게 담기)\ndescription: (130~160자. '평점 4.2가 증명하는 찐맛집' 뉘앙스를 포함해 클릭을 유도하는 검색 문장)\ncategory: 픽앤조이 맛집 탐방\ntags: [맛집탐방, ${candidate.regionLabel}, ${candidate.areaTag}, ${candidate.item.cuisineHint || '핫플'}, ${candidate.item.vibeHint || '분위기맛집'}, 카카오맵]\nimage: \"${defaultImage}\"\nsource_id: \"${candidate.item.id}\"\nslug: \"${slugBase}\"\nplace_name: \"${candidate.item.name.replace(/"/g, '\\"')}\"\nplace_address: \"${candidate.item.address.replace(/"/g, '\\"')}\"\nplace_locality: \"${locality}\"\nplace_region: \"KR\"\nplace_phone: \"${candidate.item.phone.replace(/"/g, '\\"')}\"\nplace_url: \"${candidate.item.mapUrl.replace(/"/g, '\\"')}\"\nparking_info: \"확인 필요\"${ratingFrontmatter}\n---\n\n[핫플 맛집 생성 규칙]\n- 페르소나는 '인스타 팔로워 수만 명을 둔 픽앤조이 메인 에디터'예요.\n- 글은 광고 문구처럼 쓰지 말고, 진짜 다녀온 사람처럼 체감 중심으로 써줘.\n- 제목에는 반드시 음식 장르(한식, 양식, 일식, 카페, 브런치 등)나 대표 음식(파스타, 오마카세, 국밥 등)을 포함해서 어떤 맛집인지 한눈에 알 수 있게 써줘.\n- 제목 흐름: '지역 + 음식 장르/특색 + 왜 여기 체크하는지' — 상황만 나열하는 제목은 금지.\n- 좋은 예: '성수 파스타, 면 익힘도 골라주는 곳이 있다', '부천 한식 코스, 점심에 이 가격이요?'\n- 나쁜 예: '부천 데이트, 뭐 할지 고민될 때 꺼내보는 카드' (음식 종류가 없음)\n- 연도/숫자/TOP/베스트/총정리/완전정복/맛집 추천 리스트 같은 제목은 금지.\n- slug는 이미 정해져 있으니 바꾸지 마.\n- 첫 줄 훅은 반드시 도발적으로 시작해줘. 예: '여기 안 가본 사람 아직도 있어요?', '나만 알고 싶었는데 이미 웨이팅 1시간이더라고요.'\n- 본문 구조는 [공감되는 상황 → 왜 후보에 남는지 → 공간/동선/메뉴 결 → 가기 전 체크포인트] 흐름으로 써줘.\n- 소제목은 감성 문장형으로 3~4개. 숫자 번호(1. 2. 3.)는 사용 금지.\n- 문장은 짧고 템포 있게. 2~3문장마다 반드시 줄바꿈.\n- 경어체(~해요/~네요/~입니다)만 사용. 평어체(~이다/~한다) 금지.\n- 반드시 아래 입력값을 자연스럽게 활용해줘: sourceQuery, scenarioHint, vibeHint, cuisineHint.\n- 입력 데이터로 확인되지 않는 메뉴 세부, 웨이팅 시간, 인테리어 디테일, 대표 메뉴, 주차 가능 여부는 절대 단정하지 마.\n- 모르면 '확인 필요', '이럴 가능성이 있어 보여요', '이런 결을 기대하게 돼요'처럼 안전하게 써줘.\n- 금지어: 추천합니다, 방문해보세요, 만족도가 높습니다, 다양한 메뉴가 있어요, 최고의 선택, 주말 고민 해결, 무조건, 찐으로, 인생맛집 TOP, 총정리.\n- 조도, 채광, 사진 잘 나오는 각도, 음식 결(질감·온도) 등 감각적 묘사를 2개 이상 포함해줘.\n- 표현 예시는 '미친 식감', '영롱한 비주얼', '입안에서 터지는 육즙', '꾸덕함의 극치' 같은 결로 가능하지만, 확인 가능한 범위 내에서만 사용해줘.\n- 마지막 문장은 광고 카피 대신 개인적 여운으로 마무리해줘. 예: '다음에 비 올 때 또 생각날 것 같아요.'\n\n[반드시 포함할 정보 박스 섹션]\n본문 후반에 '## 방문 정보 한눈에' 섹션을 만들고 아래를 모두 넣어줘.\n- 상호명: markdown 링크 형식으로 카카오맵 주소 연결\n- 주소\n- 전화번호\n- 주차: 확인 필요 (명확한 정보가 없으면 이렇게 쓰기)\n- 이럴 때 체크하면 좋아요: scenarioHint를 바탕으로 한 한 줄\n- 식사 후 동선: '여기서 식사하고 도보 5분 거리의 OO 카페까지 이어가면 코스가 완성돼요' 같은 형태로 한 줄\n- 에디터 한 줄 평\n\n[형식 규칙]\n- 본문 첫 줄 ## 헤딩은 훅 문장 자체를 그대로 써줘. 예: ## 여기 안 가본 사람 아직도 있어요? 처럼 작성하고, \"훅\"이라는 단어 자체를 제목으로 쓰는 것은 절대 금지.\n- 표는 필요할 때만 간단히 사용\n- 마지막 줄에는 반드시 FILENAME: ${fileStem} 형식으로 출력\n`;

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
  let filename = `${fileStem}.md`;
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

function buildFilteredCandidates(snapshot, existingIds) {
  const rawCandidates = buildRoundRobinCandidates(snapshot.regions || {});
  return rawCandidates
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
      regionLabel: { incheon: '인천', seoul: '서울', gyeonggi: '경기' }[region] || region,
      areaTag: { incheon: '인천', seoul: '서울', gyeonggi: '경기' }[region] || region,
      item,
    }));
}

function findEmptyBuckets(candidates) {
  const bucketHas = new Map(TARGET_BUCKETS.map((b) => [b, false]));
  for (const c of candidates) {
    const bucket = classifyRegionBucket(c.item);
    bucketHas.set(bucket, true);
  }
  return TARGET_BUCKETS.filter((b) => !bucketHas.get(b));
}

function recollectRestaurants() {
  const collectScript = path.join(process.cwd(), 'scripts', 'collect-life-restaurants.mjs');
  execFileSync(process.execPath, [collectScript], {
    stdio: 'inherit',
    env: process.env,
  });
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  let snapshot = await readSnapshot();
  const existing = await getExistingRestaurantStats();
  const existingIds = existing.ids;

  let candidates = buildFilteredCandidates(snapshot, existingIds);

  const emptyBuckets = findEmptyBuckets(candidates);
  if (candidates.length < MIN_UNUSED_CANDIDATES && FORCE_RESTAURANT_SOURCE_IDS.size === 0) {
    console.log(`\n🔄 unused 후보 ${candidates.length}건으로 기준 ${MIN_UNUSED_CANDIDATES}건 미만 — Kakao API 재수집 시작...`);
    try {
      recollectRestaurants();
      snapshot = await readSnapshot();
      candidates = buildFilteredCandidates(snapshot, existingIds);
      const stillEmpty = findEmptyBuckets(candidates);
      if (stillEmpty.length > 0) {
        console.warn(`⚠️ 재수집 후에도 ${stillEmpty.join(', ')} 버킷 후보 부족 — 다른 버킷에서 재분배합니다.`);
      } else {
        console.log('✅ 재수집으로 모든 버킷 후보 확보 완료');
      }
    } catch (err) {
      console.warn(`⚠️ 맛집 데이터 재수집 실패: ${err.message || err}`);
    }
  } else if (emptyBuckets.length > 0) {
    console.log(`ℹ️ 일부 버킷이 비어 있어도 전체 unused 후보가 ${candidates.length}건으로 충분하므로 재수집 없이 기존 후보를 우선 사용합니다.`);
  }

  const selectedCandidates = selectCandidatesByBucket(candidates, existing.bucketCounts);

  const bucketCountLog = TARGET_BUCKETS
    .map((bucket) => `${bucket}:${existing.bucketCounts.get(bucket) || 0}`)
    .join(', ');

  if (BOOTSTRAP_MIN_PER_BUCKET > 0) {
    console.log(`🥢 부트스트랩 모드: 버킷별 최소 ${BOOTSTRAP_MIN_PER_BUCKET}건 보정 (현재 ${bucketCountLog})`);
  }

  console.log(`🥢 맛집 포스트 생성 후보: ${selectedCandidates.length}건 (목표 ${TARGET_POSTS_PER_RUN}건: 서울/인천/경기기타 각 ${TARGET_POSTS_PER_BUCKET}건)`);
  if (selectedCandidates.length === 0) {
    console.log('생성할 새 맛집 포스트가 없습니다.');
    return;
  }

  for (let i = 0; i < selectedCandidates.length; i++) {
    const candidate = selectedCandidates[i];
    await generateRestaurantPost(candidate);
    if (i < selectedCandidates.length - 1) {
      console.log('  ⏳ 5초 대기 중...');
      await sleep(5000);
    }
  }
}

run().catch((error) => {
  console.error('❌ 맛집 포스트 생성 실패', error);
  process.exit(1);
});
