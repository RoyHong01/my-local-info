/**
 * fix-post-images.js
 * 기존 포스트 중 default SVG 이미지를 사용하는 포스트의 이미지를 보강합니다.
 * 1. source_id로 데이터 JSON에서 firstimage 조회
 * 2. 없으면 랜드마크 엔진으로 TourAPI on-demand 조회
 * 3. 성공 시 frontmatter image: 필드 업데이트
 *
 * 실행: node scripts/fix-post-images.js
 * (1회용 스크립트)
 */
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { extractRegionTokens, getRegionalLandmark } = require('./lib/landmark-engine');

// .env.local 자동 로드
(function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fsSync.existsSync(envPath)) return;
  const lines = fsSync.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
})();

const TOUR_API_KEY = process.env.TOUR_API_KEY || '';
const POSTS_DIR = path.join(process.cwd(), 'src', 'content', 'posts');
const DATA_DIR = path.join(process.cwd(), 'public', 'data');

const DEFAULT_SVG_PATTERN = /https:\/\/pick-n-joy\.com\/images\/default-[^"'\s]+\.svg/;
const NATIONAL_LANDMARK_TOKEN_POOL = ['서울', '부산', '제주', '경주', '강릉', '전주', '여수'];
const INTERNAL_NATIONAL_LANDMARK_IMAGES = [
  'https://pick-n-joy.com/images/gyeongbokgung-hero.png',
  'https://pick-n-joy.com/images/changdeokgung-hero.png',
  'https://pick-n-joy.com/images/changgyeonggung-hero.png',
  'https://pick-n-joy.com/images/incheon-family-month-hero.jpg',
  'https://pick-n-joy.com/images/incheon-spring-festival-2026.jpg',
];

async function loadDataJson(filename) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseFrontmatter(content) {
  // CRLF 정규화
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([\w_]+):\s*(.+)$/);
    if (m) {
      result[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return result;
}

function updateFrontmatterImage(content, newImage) {
  // CRLF와 LF 모두 처리
  return content.replace(
    /^(image:\s*)["']?https:\/\/pick-n-joy\.com\/images\/default-[^"'\r\n]+["']?/m,
    `$1"${newImage}"`
  );
}

function expandLandmarkTokens(tokens) {
  const queue = [];
  const seen = new Set();
  for (const token of tokens) {
    const value = String(token || '').trim();
    if (!value) continue;
    if (value === '대한민국') {
      for (const nationalToken of NATIONAL_LANDMARK_TOKEN_POOL) {
        if (!seen.has(nationalToken)) {
          seen.add(nationalToken);
          queue.push(nationalToken);
        }
      }
      continue;
    }
    if (!seen.has(value)) {
      seen.add(value);
      queue.push(value);
    }
  }
  return queue;
}

function hashToIndex(seed, length) {
  if (!length) return 0;
  let hash = 0;
  const text = String(seed || 'pick-n-joy');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

async function run() {
  if (!TOUR_API_KEY) {
    console.warn('TOUR_API_KEY 없음: 랜드마크 조회 불가. 데이터 JSON 이미지만 처리합니다.');
  }

  // 데이터 JSON 로드
  const [incheonItems, subsidyItems, festivalItems] = await Promise.all([
    loadDataJson('incheon.json'),
    loadDataJson('subsidy.json'),
    loadDataJson('festival.json'),
  ]);

  // source_id -> item 맵 구성
  const incheonMap = new Map(incheonItems.map(i => [String(i['서비스ID'] || i.id || ''), i]));
  const subsidyMap = new Map(subsidyItems.map(i => [String(i['서비스ID'] || i.id || ''), i]));
  const festivalMap = new Map(festivalItems.map(i => [String(i.contentid || i.id || ''), i]));

  // 포스트 목록
  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const landmarkCache = new Map();

  let total = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // default SVG 이미지가 아니면 건너뜀
    if (!DEFAULT_SVG_PATTERN.test(content)) {
      skipped++;
      continue;
    }

    total++;
    const fm = parseFrontmatter(content);
    if (!fm) {
      console.warn(`[SKIP] frontmatter 파싱 실패: ${file}`);
      failed++;
      continue;
    }

    const sourceId = fm.source_id || '';
    const category = fm.category || '';
    let newImage = '';

    // 1단계: 데이터 JSON에서 firstimage 조회
    if (!newImage && sourceId) {
      let item = null;
      if (category.includes('인천')) {
        item = incheonMap.get(sourceId);
      } else if (category.includes('보조금') || category.includes('복지')) {
        item = subsidyMap.get(sourceId);
      } else if (category.includes('축제') || category.includes('여행')) {
        item = festivalMap.get(sourceId);
      } else {
        item = incheonMap.get(sourceId) || subsidyMap.get(sourceId) || festivalMap.get(sourceId);
      }

      if (item) {
        const img = item.firstimage || item.firstimage2 || '';
        if (img && !DEFAULT_SVG_PATTERN.test(img)) {
          newImage = img;
        }
      }
    }

    // 2단계: 랜드마크 엔진으로 on-demand TourAPI 조회
    if (!newImage && TOUR_API_KEY) {
      try {
        // 제목에서 지역 토큰 추출 (다양한 소스 조합)
        const titleText = [
          fm.title || '',
          category,
          fm.tags || '',
          fm.summary || '',
        ].join(' ');
        const tokens = extractRegionTokens(titleText);
        // 보조금/복지처럼 전국 공통 성격일 수 있는 항목은 대한민국으로 폴백
        let fallbackTokens = tokens.length > 0 ? tokens : [];
        if (category && category.includes('보조금')) {
          // 인천 명시가 있는 경우만 인천 우선, 그 외는 대한민국
          const isIncheon = titleText.includes('인천') || titleText.includes('인천시');
          if (fallbackTokens.length === 0) {
            fallbackTokens = isIncheon ? ['인천'] : ['대한민국'];
          }
        } else if (category && category.includes('인천')) {
          if (fallbackTokens.length === 0) fallbackTokens = ['인천'];
        } else if (category && (category.includes('축제') || category.includes('여행'))) {
          if (fallbackTokens.length === 0) fallbackTokens = ['대한민국'];
        } else {
          if (fallbackTokens.length === 0) fallbackTokens = ['대한민국'];
        }

        const searchTokens = expandLandmarkTokens(fallbackTokens);
        let tourApiAttempts = 0;
        let tourApiMatches = 0;

        for (const token of searchTokens) {
          tourApiAttempts++;
          try {
            const result = await getRegionalLandmark({
              regionName: token,
              tourApiKey: TOUR_API_KEY,
              cache: landmarkCache,
              numOfRows: 15,
            });
            if (result?.imageUrl) {
              newImage = result.imageUrl;
              tourApiMatches++;
              console.log(`    [TourAPI✅] ${token}: ${result.imageUrl.slice(0, 80)}`);
              break;
            } else {
              console.log(`    [TourAPI❌] ${token}: no image found`);
            }
          } catch (apiErr) {
            console.log(`    [TourAPI⚠️] ${token}: ${apiErr.message}`);
          }
        }
        if (tourApiAttempts > 0 && tourApiMatches === 0) {
          console.log(`  💡 [진단] ${file}: TourAPI 시도 ${tourApiAttempts}회 → 이미지 0회 (2차 폴백 예정)`);
        }
      } catch (err) {
        console.error(`[ERROR] 랜드마크 조회 실패 (${file}): ${err.message}`);
      }
    }

    // 2차 폴백: TourAPI에서 이미지를 못 찾은 전국/모호 항목은 내부 랜드마크 이미지를 사용
    if (!newImage) {
      const seed = `${file}|${sourceId}|${category}`;
      const idx = hashToIndex(seed, INTERNAL_NATIONAL_LANDMARK_IMAGES.length);
      newImage = INTERNAL_NATIONAL_LANDMARK_IMAGES[idx];
      console.log(`  [Fallback] ${file}: 내부 이미지 ${idx + 1}/${INTERNAL_NATIONAL_LANDMARK_IMAGES.length}`);
    }

    if (!newImage) {
      console.log(`[FAIL] 이미지 없음: ${file}`);
      failed++;
      continue;
    }

    // 3단계: frontmatter 업데이트
    const newContent = updateFrontmatterImage(content, newImage);
    if (newContent === content) {
      console.warn(`[WARN] 업데이트 패턴 미매칭: ${file}`);
      failed++;
      continue;
    }

    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`[OK] ${file} -> ${newImage.slice(0, 80)}`);
    updated++;
  }

  console.log(`\n=== 소급 이미지 보강 완료 ===`);
  console.log(`처리 대상: ${total}건 (스킵 ${skipped}건)`);
  console.log(`업데이트 성공: ${updated}건`);
  console.log(`실패/미매칭: ${failed}건`);
}

run().catch(err => {
  console.error('fix-post-images.js 실행 오류:', err);
  process.exit(1);
});
