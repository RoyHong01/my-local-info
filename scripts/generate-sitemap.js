const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const baseUrl = 'https://my-local-info-2gs.pages.dev';
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');
const outFile = path.join(__dirname, '..', 'out', 'sitemap.xml');

// 정적 페이지
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/blog/', priority: '0.8', changefreq: 'daily' },
  { url: '/about/', priority: '0.5', changefreq: 'monthly' },
];

// 블로그 포스트
let postPages = [];
try {
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  postPages = files.map(file => {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const { data } = matter(content);
    let dateStr = data.date || '';
    if (dateStr instanceof Date) {
      dateStr = dateStr.toISOString().split('T')[0];
    }
    const slug = file.replace(/\.md$/, '');
    return { url: `/blog/${slug}/`, priority: '0.6', changefreq: 'weekly', lastmod: dateStr };
  });
} catch (e) {
  // no posts
}

const allPages = [...staticPages, ...postPages];
const today = new Date().toISOString().split('T')[0];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${p.lastmod || today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(outFile, xml, 'utf8');
console.log('sitemap.xml 생성 완료:', outFile);
