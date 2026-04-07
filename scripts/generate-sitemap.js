const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const baseUrl = 'https://pick-n-joy.com';
const postsDirs = [
  path.join(__dirname, '..', 'src', 'content', 'posts'),
  path.join(__dirname, '..', 'src', 'content', 'life'),
];
const outFile = path.join(__dirname, '..', 'out', 'sitemap.xml');
const dataDir = path.join(__dirname, '..', 'public', 'data');

const today = new Date().toISOString().split('T')[0];

const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/blog/', priority: '0.8', changefreq: 'daily' },
  { url: '/incheon/', priority: '0.8', changefreq: 'daily' },
  { url: '/subsidy/', priority: '0.8', changefreq: 'daily' },
  { url: '/festival/', priority: '0.8', changefreq: 'daily' },
  { url: '/life/', priority: '0.7', changefreq: 'weekly' },
  { url: '/life/choice/', priority: '0.6', changefreq: 'weekly' },
  { url: '/life/restaurant/', priority: '0.6', changefreq: 'weekly' },
  { url: '/about/', priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy/', priority: '0.5', changefreq: 'monthly' },
  { url: '/terms/', priority: '0.5', changefreq: 'monthly' },
  { url: '/rss.xml', priority: '0.4', changefreq: 'daily' },
];

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  const stringValue = String(value).trim();
  if (!stringValue) return '';
  if (/^\d{8}$/.test(stringValue)) {
    return `${stringValue.slice(0, 4)}-${stringValue.slice(4, 6)}-${stringValue.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 10);
  }
  return '';
}

function readJsonArray(fileName) {
  try {
    const content = fs.readFileSync(path.join(dataDir, fileName), 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildLoc(urlPath) {
  return xmlEscape(`${baseUrl}${encodeURI(urlPath)}`);
}

function buildPage(url, priority, changefreq, lastmod) {
  return {
    url,
    priority,
    changefreq,
    lastmod: normalizeDate(lastmod) || today,
  };
}

function collectMarkdownPages() {
  const pages = [];
  for (const dir of postsDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const { data } = matter(content);
      const fallbackSlug = file.replace(/\.md$/, '');
      const slug = String(data.slug || fallbackSlug).trim();
      if (!slug) continue;
      pages.push(
        buildPage(
          `/blog/${slug}/`,
          '0.6',
          'weekly',
          data.date || data.updated_at || data.modified_at
        )
      );
    }
  }
  return pages;
}

function collectIncheonPages() {
  return readJsonArray('incheon.json')
    .map((item) => item['서비스ID'] || item.id)
    .filter(Boolean)
    .map((id) => buildPage(`/incheon/${encodeURIComponent(String(id))}/`, '0.7', 'weekly'));
}

function collectSubsidyPages() {
  return readJsonArray('subsidy.json')
    .map((item) => item['서비스ID'] || item.id)
    .filter(Boolean)
    .map((id) => buildPage(`/subsidy/${encodeURIComponent(String(id))}/`, '0.7', 'weekly'));
}

function collectFestivalPages() {
  return readJsonArray('festival.json')
    .map((item) => ({
      id: item.contentid || item.id,
      lastmod: item.description_markdown_updated_at || item.collectedAt || item.modifiedtime,
    }))
    .filter((item) => item.id)
    .map((item) => buildPage(`/festival/${encodeURIComponent(String(item.id))}/`, '0.7', 'weekly', item.lastmod));
}

const allPages = [
  ...staticPages.map((page) => buildPage(page.url, page.priority, page.changefreq, today)),
  ...collectMarkdownPages(),
  ...collectIncheonPages(),
  ...collectSubsidyPages(),
  ...collectFestivalPages(),
];

const uniquePages = Array.from(new Map(allPages.map((page) => [page.url, page])).values())
  .sort((a, b) => a.url.localeCompare(b.url, 'ko'));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniquePages.map((page) => `  <url>
    <loc>${buildLoc(page.url)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(outFile, xml, 'utf8');
console.log('sitemap.xml 생성 완료:', outFile, `(${uniquePages.length}개 URL)`);
