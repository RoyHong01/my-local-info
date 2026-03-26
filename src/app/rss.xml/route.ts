import { getSortedPostsData } from '@/lib/posts';

export const dynamic = 'force-static';

export async function GET() {
  const posts = getSortedPostsData().slice(0, 50);

  const items = posts.map((post) => {
    const pubDate = post.date ? new Date(post.date).toUTCString() : '';
    const link = `https://pick-n-joy.com/blog/${post.slug}`;
    const title = post.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const description = (post.summary || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const category = (post.category || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      ${category ? `<category>${category}</category>` : ''}
      <guid>${link}</guid>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>픽앤조이 - 인천·전국 생활정보</title>
    <link>https://pick-n-joy.com</link>
    <description>인천 및 전국의 최신 행사, 축제, 보조금, 여행 정보</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
