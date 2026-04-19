import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.resolve('src/content/posts');
const LIFE_DIR = path.resolve('src/content/life');

export interface PostData {
  slug: string;
  title: string;
  date: string;
  summary: string;
  description?: string;
  category?: string;
  tags?: string[];
  image?: string;
  imageSource?: string;
  imageSourceNote?: string;
  sourceId?: string;
  coupangLink?: string;
  coupangBannerImage?: string;
  coupangBannerAlt?: string;
  placeName?: string;
  placeAddress?: string;
  placeLocality?: string;
  placeRegion?: string;
  placePhone?: string;
  placeUrl?: string;
  parkingInfo?: string;
  ratingValue?: string;
  reviewCount?: string;
  priceRange?: string;
  openingHours?: string;
  content: string;
}

function buildHookFromTitle(title: string): string {
  const cleaned = title
    .replace(/["'“”‘’]/g, '')
    .replace(/[!?.,:;]+$/g, '')
    .trim();
  const core = cleaned.split(/[,:]/)[0].trim() || cleaned;
  return `${core}, 핵심부터 빠르게 볼까요?`;
}

function normalizeNumberedInlineSections(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1) "1. **소제목** 설명" 한 줄 패턴
    const numberedBoldInline = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*[:：]?\s+(.+)$/);
    if (numberedBoldInline) {
      out.push(`### ${numberedBoldInline[1]}. ${numberedBoldInline[2].trim()}`);
      out.push('');
      out.push(numberedBoldInline[3].trim());
      out.push('');
      continue;
    }

    // 2) "1. **소제목**" + 다음 줄 설명 패턴
    const numberedBoldOnly = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*$/);
    if (numberedBoldOnly) {
      out.push(`### ${numberedBoldOnly[1]}. ${numberedBoldOnly[2].trim()}`);
      out.push('');
      continue;
    }

    // 3) "**1. 소제목**" 패턴
    const standaloneBoldNumber = trimmed.match(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/);
    if (standaloneBoldNumber) {
      out.push(`### ${standaloneBoldNumber[1]}. ${standaloneBoldNumber[2].trim()}`);
      out.push('');
      continue;
    }

    // 4) "**1️⃣ 소제목**" / "**2️⃣ 소제목**" 패턴 (키캡 숫자 변형 포함)
    const emojiNumberHeading = trimmed.match(/^\*\*([1-9])(?:\uFE0F?\u20E3)\s+(.+?)\*\*\s*$/u);
    if (emojiNumberHeading) {
      out.push(`### ${emojiNumberHeading[1]}. ${emojiNumberHeading[2].trim()}`);
      out.push('');
      continue;
    }

    // 4-1) "1️⃣ 소제목" (bold 없는 키캡 숫자) 패턴
    const emojiPlainHeading = trimmed.match(/^([1-9])(?:\uFE0F?\u20E3)\s+(.+)$/u);
    if (emojiPlainHeading) {
      out.push(`### ${emojiPlainHeading[1]}. ${emojiPlainHeading[2].trim()}`);
      out.push('');
      continue;
    }

    // 5) "1. 소제목 설명" 한 줄 패턴
    const plainWithDesc = trimmed.match(
      /^(\d+)\.\s+(.+?(?:니다|요|됩니다|있습니다|합니다|간단합니다|큽니다|좋습니다|가능합니다))\s+(.+)$/
    );
    if (plainWithDesc) {
      out.push(`### ${plainWithDesc[1]}. ${plainWithDesc[2].trim()}`);
      out.push('');
      out.push(plainWithDesc[3].trim());
      out.push('');
      continue;
    }

    // 6) "1. 소제목" 단독 패턴
    const standalonePlainNumber = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (standalonePlainNumber) {
      out.push(`### ${standalonePlainNumber[1]}. ${standalonePlainNumber[2].trim()}`);
      out.push('');
      continue;
    }

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeBlogContent(content: string, title: string): string {
  if (!content) return content;

  let normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // 본문의 H1은 카드 상단 메인 제목보다 커 보이지 않도록 H2로 낮춤
  normalized = normalized
    .split('\n')
    .map((line) => line.replace(/^#\s+/, '## '))
    .join('\n');

  // "1. 소제목 설명" 형태를 "소제목 + 다음 단락 설명" 형태로 자동 보정
  normalized = normalizeNumberedInlineSections(normalized);

  // 번호 소제목 다음 설명이 4칸 이상 들여쓰기 되어 code block(<pre>)로 렌더링되는 문제 방지
  normalized = normalized
    .split('\n')
    .map((line) => {
      if (!/^\s+/.test(line)) return line;
      if (/^\s*(```|~~~)/.test(line)) return line;
      if (/^\s*>/.test(line)) return line;
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) return line;
      return line.trimStart();
    })
    .join('\n');

  const lines = normalized.split('\n');
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);
  const firstNonEmpty = firstNonEmptyIndex >= 0 ? lines[firstNonEmptyIndex] : '';

  if (!/^#{2,6}\s+/.test(firstNonEmpty)) {
    const hook = `## ${buildHookFromTitle(title)}`;
    normalized = `${hook}\n\n${normalized}`;
  } else if (/^##\s+훅\s*$/.test(firstNonEmpty)) {
    const nextContentIndex = lines.findIndex(
      (line, index) => index > firstNonEmptyIndex && line.trim().length > 0
    );

    if (nextContentIndex > firstNonEmptyIndex) {
      lines[firstNonEmptyIndex] = `## ${lines[nextContentIndex].trim()}`;
      lines.splice(nextContentIndex, 1);
      normalized = lines.join('\n');
    } else {
      normalized = normalized.replace(/^##\s+훅\s*$/m, `## ${buildHookFromTitle(title)}`);
    }
  }

  return normalized.replace(/\n{3,}/g, '\n\n').trim();
}

export function getSortedPostsData(): PostData[] {
  const allPostsData: PostData[] = [];

  const collectFromPostsDir = () => {
    try {
      if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
        return;
      }
      const fileNames = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
      for (const fileName of fileNames) {
        try {
          const fullPath = path.join(POSTS_DIR, fileName);
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          const matterResult = matter(fileContents);

          let dateStr = matterResult.data.date || '';
          if (dateStr instanceof Date) {
            const year = dateStr.getFullYear();
            const month = String(dateStr.getMonth() + 1).padStart(2, '0');
            const day = String(dateStr.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          } else if (typeof dateStr === 'string' && dateStr) {
            dateStr = dateStr.split('T')[0];
          }

          const slug = fileName.replace(/\.md$/, '');
          allPostsData.push({
            slug: matterResult.data.slug || slug,
            title: matterResult.data.title || slug,
            date: dateStr,
            summary: matterResult.data.summary || '',
            description: matterResult.data.description || matterResult.data.summary || '',
            category: matterResult.data.category,
            tags: matterResult.data.tags,
            image: matterResult.data.image,
            imageSource: matterResult.data.image_source || matterResult.data.imageSource || '',
            imageSourceNote: matterResult.data.image_source_note || matterResult.data.imageSourceNote || '',
            sourceId: matterResult.data.source_id || matterResult.data.sourceId || '',
            coupangLink: matterResult.data.coupang_link || matterResult.data.coupangLink || '',
            coupangBannerImage: matterResult.data.coupang_banner_image || matterResult.data.coupangBannerImage || '',
            coupangBannerAlt: matterResult.data.coupang_banner_alt || matterResult.data.coupangBannerAlt || '',
            placeName: matterResult.data.place_name || matterResult.data.placeName || '',
            placeAddress: matterResult.data.place_address || matterResult.data.placeAddress || '',
            placeLocality: matterResult.data.place_locality || matterResult.data.placeLocality || '',
            placeRegion: matterResult.data.place_region || matterResult.data.placeRegion || '',
            placePhone: matterResult.data.place_phone || matterResult.data.placePhone || '',
            placeUrl: matterResult.data.place_url || matterResult.data.placeUrl || '',
            parkingInfo: matterResult.data.parking_info || matterResult.data.parkingInfo || '',
            ratingValue: matterResult.data.rating_value || matterResult.data.ratingValue || '',
            reviewCount: matterResult.data.review_count || matterResult.data.reviewCount || '',
            priceRange: matterResult.data.price_range || matterResult.data.priceRange || '',
            openingHours: matterResult.data.opening_hours || matterResult.data.openingHours || '',
            content: normalizeBlogContent(matterResult.content, matterResult.data.title || slug),
          });
        } catch {
          // skip individual broken files
        }
      }
    } catch {
      // skip inaccessible directories
    }
  };

  const collectFromLifeDir = () => {
    try {
      if (!fs.existsSync(LIFE_DIR)) {
        fs.mkdirSync(LIFE_DIR, { recursive: true });
        return;
      }
      const fileNames = fs.readdirSync(LIFE_DIR).filter((f) => f.endsWith('.md'));
      for (const fileName of fileNames) {
        try {
          const fullPath = path.join(LIFE_DIR, fileName);
          const fileContents = fs.readFileSync(fullPath, 'utf8');
          const matterResult = matter(fileContents);

          let dateStr = matterResult.data.date || '';
          if (dateStr instanceof Date) {
            const year = dateStr.getFullYear();
            const month = String(dateStr.getMonth() + 1).padStart(2, '0');
            const day = String(dateStr.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          } else if (typeof dateStr === 'string' && dateStr) {
            dateStr = dateStr.split('T')[0];
          }

          const slug = fileName.replace(/\.md$/, '');
          allPostsData.push({
            slug: matterResult.data.slug || slug,
            title: matterResult.data.title || slug,
            date: dateStr,
            summary: matterResult.data.summary || '',
            description: matterResult.data.description || matterResult.data.summary || '',
            category: matterResult.data.category,
            tags: matterResult.data.tags,
            image: matterResult.data.image,
            imageSource: matterResult.data.image_source || matterResult.data.imageSource || '',
            imageSourceNote: matterResult.data.image_source_note || matterResult.data.imageSourceNote || '',
            sourceId: matterResult.data.source_id || matterResult.data.sourceId || '',
            coupangLink: matterResult.data.coupang_link || matterResult.data.coupangLink || '',
            coupangBannerImage: matterResult.data.coupang_banner_image || matterResult.data.coupangBannerImage || '',
            coupangBannerAlt: matterResult.data.coupang_banner_alt || matterResult.data.coupangBannerAlt || '',
            placeName: matterResult.data.place_name || matterResult.data.placeName || '',
            placeAddress: matterResult.data.place_address || matterResult.data.placeAddress || '',
            placeLocality: matterResult.data.place_locality || matterResult.data.placeLocality || '',
            placeRegion: matterResult.data.place_region || matterResult.data.placeRegion || '',
            placePhone: matterResult.data.place_phone || matterResult.data.placePhone || '',
            placeUrl: matterResult.data.place_url || matterResult.data.placeUrl || '',
            parkingInfo: matterResult.data.parking_info || matterResult.data.parkingInfo || '',
            ratingValue: matterResult.data.rating_value || matterResult.data.ratingValue || '',
            reviewCount: matterResult.data.review_count || matterResult.data.reviewCount || '',
            priceRange: matterResult.data.price_range || matterResult.data.priceRange || '',
            openingHours: matterResult.data.opening_hours || matterResult.data.openingHours || '',
            content: normalizeBlogContent(matterResult.content, matterResult.data.title || slug),
          });
        } catch {
          // skip individual broken files
        }
      }
    } catch {
      // skip inaccessible directories
    }
  };

  collectFromPostsDir();
  collectFromLifeDir();

  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostData(slug: string): PostData | null {
  const normalizeSlug = (value: string) => {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      // ignore decode error and keep raw value
    }
    return String(decoded || '').trim().normalize('NFC');
  };

  const requestedSlug = normalizeSlug(slug);

  // 디렉토리별 명시적 읽기로 Turbopack 파일 패턴을 좁힘
  const readFromDir = (dir: string, fileName: string): string | null => {
    try {
      return fs.readFileSync(path.join(dir, fileName), 'utf8');
    } catch {
      return null;
    }
  };

  let fileContents: string | null = null;

  // 1) 직접 경로 매칭
  const directFileName = `${requestedSlug}.md`;
  fileContents = readFromDir(POSTS_DIR, directFileName) ?? readFromDir(LIFE_DIR, directFileName);

  // 2) 파일명과 frontmatter slug가 다를 수 있으므로 fallback 스캔 수행
  if (fileContents === null) {
    const scanDir = (dir: string): string | null => {
      if (!fs.existsSync(dir)) return null;
      const fileNames = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));

      for (const fileName of fileNames) {
        const fileSlug = normalizeSlug(fileName.replace(/\.md$/, ''));
        if (fileSlug === requestedSlug) {
          return readFromDir(dir, fileName);
        }

        try {
          const contents = readFromDir(dir, fileName);
          if (!contents) continue;
          const parsed = matter(contents);
          const frontmatterSlug = normalizeSlug(String(parsed.data.slug || ''));
          if (frontmatterSlug && frontmatterSlug === requestedSlug) {
            return contents;
          }
        } catch {
          // ignore broken markdown and continue
        }
      }

      return null;
    };

    fileContents = scanDir(POSTS_DIR) ?? scanDir(LIFE_DIR);
  }

  if (!fileContents) return null;

  try {
    const matterResult = matter(fileContents);
    
    let dateStr = matterResult.data.date || '';
    if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string' && dateStr) {
        dateStr = dateStr.split('T')[0];
    }

    return {
      slug,
      title: matterResult.data.title || slug,
      date: dateStr,
      summary: matterResult.data.summary || '',
      description: matterResult.data.description || matterResult.data.summary || '',
      category: matterResult.data.category,
      tags: matterResult.data.tags,
      image: matterResult.data.image,
      sourceId: matterResult.data.source_id || matterResult.data.sourceId || '',
      coupangLink: matterResult.data.coupang_link || matterResult.data.coupangLink || '',
      coupangBannerImage: matterResult.data.coupang_banner_image || matterResult.data.coupangBannerImage || '',
      coupangBannerAlt: matterResult.data.coupang_banner_alt || matterResult.data.coupangBannerAlt || '',
      placeName: matterResult.data.place_name || matterResult.data.placeName || '',
      placeAddress: matterResult.data.place_address || matterResult.data.placeAddress || '',
      placeLocality: matterResult.data.place_locality || matterResult.data.placeLocality || '',
      placeRegion: matterResult.data.place_region || matterResult.data.placeRegion || '',
      placePhone: matterResult.data.place_phone || matterResult.data.placePhone || '',
      placeUrl: matterResult.data.place_url || matterResult.data.placeUrl || '',
      parkingInfo: matterResult.data.parking_info || matterResult.data.parkingInfo || '',
      ratingValue: matterResult.data.rating_value || matterResult.data.ratingValue || '',
      reviewCount: matterResult.data.review_count || matterResult.data.reviewCount || '',
      priceRange: matterResult.data.price_range || matterResult.data.priceRange || '',
      openingHours: matterResult.data.opening_hours || matterResult.data.openingHours || '',
      content: normalizeBlogContent(matterResult.content, matterResult.data.title || slug),
    };
  } catch {
    return null;
  }
}
