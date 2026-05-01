import fs from 'fs/promises';
import path from 'path';
import { getSortedPostsData } from '@/lib/posts';
import { getAllTopIds } from '@/lib/priority-calculator';

export const dynamic = 'force-static';

type DataItem = Record<string, unknown>;

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  category: string;
  guid: string;
};

const SITE_URL = 'https://pick-n-joy.com';
const MAX_FEED_ITEMS = 100;
const MAX_BLOG_ITEMS = 40;
const MAX_INCHEON_ITEMS = 20;
const MAX_SUBSIDY_ITEMS = 25;
const MAX_FESTIVAL_ITEMS = 15;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pickString(item: DataItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function parseDateCandidate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // 20260501 / 20260501123059
  if (/^\d{8}(\d{6})?$/.test(raw)) {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    const hh = raw.length >= 10 ? Number(raw.slice(8, 10)) : 0;
    const mm = raw.length >= 12 ? Number(raw.slice(10, 12)) : 0;
    const ss = raw.length >= 14 ? Number(raw.slice(12, 14)) : 0;
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }

  // 2026-05-01, 2026.05.01, 2026/05/01, 2026.05.01.(금)
  const cleaned = raw
    .replace(/[()]/g, ' ')
    .replace(/[^\d./:\- TZ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = cleaned.replace(/[./]/g, '-');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function pickDate(item: DataItem, keys: string[]): Date {
  for (const key of keys) {
    const parsed = parseDateCandidate(item[key]);
    if (parsed) return parsed;
  }
  return new Date();
}

async function readJsonArray(fileName: string): Promise<DataItem[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildBlogItems(): FeedItem[] {
  return getSortedPostsData()
    .slice(0, MAX_BLOG_ITEMS)
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}/`;
      return {
        title: post.title || post.slug,
        link,
        description: post.summary || post.description || '',
        pubDate: parseDateCandidate(post.date) || new Date(),
        category: post.category || '블로그',
        guid: link,
      };
    });
}

function buildSubsidyItems(items: DataItem[], topIds: Set<unknown>): FeedItem[] {
  return items
    .filter((item) => !item.expired)
    .map((item) => {
      const id = pickString(item, ['서비스ID', 'id']);
      if (!id || !topIds.has(id)) return null;

      const name = pickString(item, ['서비스명', 'name', 'title']) || `보조금 ${id}`;
      const summary = pickString(item, ['서비스목적요약', 'summary', 'description']);
      const link = `${SITE_URL}/subsidy/${encodeURIComponent(id)}/`;

      return {
        title: name,
        link,
        description: summary,
        pubDate: pickDate(item, ['수정일시', '등록일시', 'updatedAt', 'collectedAt']),
        category: '전국 보조금·복지',
        guid: link,
      } as FeedItem;
    })
    .filter((entry): entry is FeedItem => entry !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_SUBSIDY_ITEMS);
}

function buildIncheonItems(items: DataItem[], topIds: Set<unknown>): FeedItem[] {
  return items
    .filter((item) => !item.expired)
    .map((item) => {
      const id = pickString(item, ['서비스ID', 'id']);
      if (!id || !topIds.has(id)) return null;

      const name = pickString(item, ['서비스명', 'name', 'title']) || `인천 정보 ${id}`;
      const summary = pickString(item, ['서비스목적요약', 'summary', 'description']);
      const link = `${SITE_URL}/incheon/${encodeURIComponent(id)}/`;

      return {
        title: name,
        link,
        description: summary,
        pubDate: pickDate(item, ['수정일시', '등록일시', 'updatedAt', 'collectedAt']),
        category: '인천 지역 정보',
        guid: link,
      } as FeedItem;
    })
    .filter((entry): entry is FeedItem => entry !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_INCHEON_ITEMS);
}

function buildFestivalItems(items: DataItem[], topIds: Set<unknown>): FeedItem[] {
  return items
    .filter((item) => !item.expired)
    .map((item) => {
      const id = pickString(item, ['contentid', 'id']);
      if (!id || !topIds.has(id)) return null;

      const name = pickString(item, ['title', 'name', '서비스명']) || `축제 ${id}`;
      const summary = pickString(item, ['overview', 'summary', 'description', '서비스목적요약']);
      const link = `${SITE_URL}/festival/${encodeURIComponent(id)}/`;

      return {
        title: name,
        link,
        description: summary,
        pubDate: pickDate(item, ['modifiedtime', 'description_markdown_updated_at', 'updatedAt', 'collectedAt']),
        category: '전국 축제·여행',
        guid: link,
      } as FeedItem;
    })
    .filter((entry): entry is FeedItem => entry !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_FESTIVAL_ITEMS);
}

export async function GET() {
  const [incheonData, subsidyData, festivalData] = await Promise.all([
    readJsonArray('incheon.json'),
    readJsonArray('subsidy.json'),
    readJsonArray('festival.json'),
  ]);

  const topIds = getAllTopIds(incheonData, subsidyData, festivalData);

  const merged = [
    ...buildBlogItems(),
    ...buildIncheonItems(incheonData, topIds.incheon),
    ...buildSubsidyItems(subsidyData, topIds.subsidy),
    ...buildFestivalItems(festivalData, topIds.festival),
  ]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_FEED_ITEMS);

  const unique = Array.from(new Map(merged.map((item) => [item.link, item])).values());

  const items = unique
    .map((item) => {
      const title = escapeXml(item.title);
      const link = escapeXml(item.link);
      const description = escapeXml(item.description);
      const category = escapeXml(item.category);
      const pubDate = item.pubDate.toUTCString();

      return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      ${category ? `<category>${category}</category>` : ''}
      <guid>${link}</guid>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>픽앤조이 - 인천·전국 생활정보</title>
    <link>${SITE_URL}</link>
    <description>인천 및 전국의 최신 행사, 축제, 보조금, 여행 정보 (SSG 기준)</description>
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
