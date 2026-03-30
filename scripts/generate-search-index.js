/**
 * generate-search-index.js
 * 빌드 타임에 모든 데이터 소스를 하나의 검색 인덱스 JSON으로 통합
 * postbuild에서 실행
 */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const OUT_DIR = path.join(process.cwd(), 'out');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function readJson(filename) {
  try {
    const raw = fs.readFileSync(path.join(PUBLIC_DIR, 'data', filename), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function readMarkdownDir(dirPath) {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const raw = fs.readFileSync(path.join(dirPath, f), 'utf8');
        return matter(raw);
      });
  } catch {
    return [];
  }
}

function truncate(str, len = 120) {
  if (!str) return '';
  const cleaned = str.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > len ? cleaned.slice(0, len) + '…' : cleaned;
}

function buildIndex() {
  const index = [];

  // 1. 인천 지역 정보
  const incheon = readJson('incheon.json');
  for (const item of incheon) {
    if (item.expired) continue;
    index.push({
      id: `incheon-${item.id || item['서비스ID']}`,
      title: item.name || item['서비스명'] || '',
      summary: truncate(item.summary || item['서비스목적요약'] || ''),
      category: '인천시 정보',
      href: `/incheon/${encodeURIComponent(item.id || item['서비스ID'])}/`,
      tags: [item.category || '', item.location || item['소관기관명'] || ''].filter(Boolean),
    });
  }

  // 2. 전국 보조금·복지
  const subsidy = readJson('subsidy.json');
  for (const item of subsidy) {
    if (item.expired) continue;
    index.push({
      id: `subsidy-${item.id || item['서비스ID']}`,
      title: item.name || item['서비스명'] || '',
      summary: truncate(item.summary || item['서비스목적요약'] || ''),
      category: '전국 보조금·복지',
      href: `/subsidy/${encodeURIComponent(item.id || item['서비스ID'])}/`,
      tags: [item.category || '', item.target || item['지원대상'] || ''].filter(Boolean),
    });
  }

  // 3. 전국 축제·여행
  const festival = readJson('festival.json');
  for (const item of festival) {
    if (item.expired) continue;
    index.push({
      id: `festival-${item.contentid || item.id}`,
      title: item.title || item.name || '',
      summary: truncate(item.overview || item.summary || ''),
      category: '전국 축제·여행',
      href: `/festival/${encodeURIComponent(item.contentid || item.id)}/`,
      tags: [item.addr1 || ''].filter(Boolean),
    });
  }

  // 4. 블로그 (posts + life)
  const postsDirs = [
    path.join(process.cwd(), 'src/content/posts'),
    path.join(process.cwd(), 'src/content/life'),
  ];
  for (const dir of postsDirs) {
    const entries = readMarkdownDir(dir);
    for (const entry of entries) {
      const { data } = entry;
      if (!data.slug || !data.title) continue;
      index.push({
        id: `blog-${data.slug}`,
        title: data.title,
        summary: truncate(data.summary || data.description || ''),
        category: data.category || '블로그',
        href: `/blog/${data.slug}/`,
        tags: data.tags || [],
      });
    }
  }

  return index;
}

// 실행
const index = buildIndex();
const outPath = path.join(OUT_DIR, 'data', 'search-index.json');

// out/data 디렉토리 확인
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(index));

console.log(`search-index.json 생성 완료: ${index.length}건 (${outPath})`);
