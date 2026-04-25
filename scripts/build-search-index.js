/**
 * build-search-index.js
 * prebuild에서 실행: 모든 데이터 소스 + 블로그 마크다운을 합쳐 검색 인덱스 생성
 *
 * 출력: public/data/search-index.json
 *
 * 데이터 소스 (자동 수집되어 매일 갱신되므로 빌드마다 자동 반영됨):
 *  - public/data/incheon.json   (인천시 정보)
 *  - public/data/subsidy.json   (전국 보조금·복지 정책)
 *  - public/data/festival.json  (전국 축제·여행 정보)
 *  - src/app/life/restaurant/data/restaurants.json (맛집 정보)
 *  - src/content/posts/*.md     (블로그 정보)
 *  - src/content/life/*.md      (일상의 즐거움/초이스 블로그)
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = process.cwd();
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');
const OUT_PATH = path.join(PUBLIC_DATA, 'search-index.json');

function readJsonSafe(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

function readMarkdownDir(dirAbs) {
  try {
    return fs
      .readdirSync(dirAbs)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        file: f,
        slug: f.replace(/\.md$/, ''),
        parsed: matter(fs.readFileSync(path.join(dirAbs, f), 'utf8')),
      }));
  } catch {
    return [];
  }
}

/**
 * 마크다운 기호와 HTML을 제거해 plain text로 변환
 */
function stripMarkdown(input) {
  if (!input) return '';
  let s = String(input);
  // frontmatter 제거 (혹시 본문에 남아있는 경우 방지)
  s = s.replace(/^---[\s\S]*?---/m, '');
  // 코드 펜스/인라인 코드
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`([^`]+)`/g, '$1');
  // 이미지/링크
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // HTML 태그
  s = s.replace(/<[^>]+>/g, ' ');
  // 헤딩/리스트/인용/구분선
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  s = s.replace(/^\s{0,3}>\s?/gm, '');
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, '');
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, '');
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, ' ');
  // 강조/취소선
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');
  // 표 파이프
  s = s.replace(/\|/g, ' ');
  // 잔여 마크다운 기호 정리
  s = s.replace(/[#*_>`~]+/g, ' ');
  // 공백 정리
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function truncate(text, len) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) : text;
}

function buildIndex() {
  const index = [];

  // 1. 인천시 정보
  const incheon = readJsonSafe(path.join(PUBLIC_DATA, 'incheon.json')) || [];
  for (const item of incheon) {
    if (!item || item.expired) continue;
    const id = item.id || item['서비스ID'];
    const title = item.name || item['서비스명'] || '';
    if (!id || !title) continue;
    const summary = stripMarkdown(item.summary || item['서비스목적요약'] || item.description || '');
    index.push({
      id: `incheon-${id}`,
      type: 'incheon',
      category: '인천시 정보',
      title: stripMarkdown(title),
      summary: truncate(summary, 500),
      href: `/incheon/${encodeURIComponent(id)}/`,
    });
  }

  // 2. 전국 보조금·복지 정책
  const subsidy = readJsonSafe(path.join(PUBLIC_DATA, 'subsidy.json')) || [];
  for (const item of subsidy) {
    if (!item || item.expired) continue;
    const id = item.id || item['서비스ID'];
    const title = item.name || item['서비스명'] || '';
    if (!id || !title) continue;
    const summary = stripMarkdown(item.summary || item['서비스목적요약'] || item.description || '');
    index.push({
      id: `subsidy-${id}`,
      type: 'subsidy',
      category: '전국 보조금·복지 정책',
      title: stripMarkdown(title),
      summary: truncate(summary, 500),
      href: `/subsidy/${encodeURIComponent(id)}/`,
    });
  }

  // 3. 전국 축제·여행 정보
  const festival = readJsonSafe(path.join(PUBLIC_DATA, 'festival.json')) || [];
  for (const item of festival) {
    if (!item || item.expired) continue;
    const id = item.contentid || item.id;
    const title = item.title || item.name || '';
    if (!id || !title) continue;
    const summary = stripMarkdown(item.overview || item.summary || item.description || '');
    index.push({
      id: `festival-${id}`,
      type: 'festival',
      category: '전국 축제·여행 정보',
      title: stripMarkdown(title),
      summary: truncate(summary, 500),
      href: `/festival/${encodeURIComponent(id)}/`,
    });
  }

  // 4. 맛집 정보
  const restaurantsJson = readJsonSafe(
    path.join(ROOT, 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json')
  );
  if (restaurantsJson && restaurantsJson.regions) {
    for (const [region, list] of Object.entries(restaurantsJson.regions)) {
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        if (!r || !r.id || !r.name) continue;
        const summaryParts = [r.summary, r.address, r.categoryName].filter(Boolean).join(' · ');
        index.push({
          id: `restaurant-${region}-${r.id}`,
          type: 'restaurant',
          category: '맛집 정보',
          title: stripMarkdown(r.name),
          summary: truncate(stripMarkdown(summaryParts), 500),
          href: `/life/restaurant/`,
          region,
        });
      }
    }
  }

  // 5. 블로그 정보 (posts + life)
  const mdDirs = [
    { abs: path.join(ROOT, 'src', 'content', 'posts'), category: '블로그' },
    { abs: path.join(ROOT, 'src', 'content', 'life'), category: '일상의 즐거움' },
  ];
  for (const { abs, category } of mdDirs) {
    const entries = readMarkdownDir(abs);
    for (const { slug, parsed } of entries) {
      const data = parsed.data || {};
      const content = parsed.content || '';
      if (data.expired) continue;
      const title = data.title || slug;
      const summarySrc = data.summary || data.description || '';
      const bodyPlain = stripMarkdown(content);
      const summary = truncate(stripMarkdown(summarySrc) || bodyPlain, 500);
      const bodyExcerpt = truncate(bodyPlain, 500);
      index.push({
        id: `blog-${slug}`,
        type: 'blog',
        category: data.category || category,
        title: stripMarkdown(title),
        summary,
        body: bodyExcerpt,
        href: `/blog/${data.slug || slug}/`,
      });
    }
  }

  return index;
}

function main() {
  const index = buildIndex();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(index));
  console.log(`Search index built: ${index.length} entries`);
}

main();
