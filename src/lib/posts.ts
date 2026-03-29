import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDirectory = path.join(process.cwd(), 'src/content/posts');

export interface PostData {
  slug: string;
  title: string;
  date: string;
  summary: string;
  description?: string;
  category?: string;
  tags?: string[];
  image?: string;
  sourceId?: string;
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

  const firstNonEmpty = normalized.split('\n').find((line) => line.trim().length > 0) || '';
  if (!/^#{2,6}\s+/.test(firstNonEmpty)) {
    const hook = `## ${buildHookFromTitle(title)}`;
    normalized = `${hook}\n\n${normalized}`;
  }

  return normalized.replace(/\n{3,}/g, '\n\n').trim();
}

export function getSortedPostsData(): PostData[] {
  let fileNames: string[] = [];
  try {
    if (!fs.existsSync(postsDirectory)) {
      fs.mkdirSync(postsDirectory, { recursive: true });
    }
    fileNames = fs.readdirSync(postsDirectory);
  } catch (error) {
    return [];
  }
  
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      const matterResult = matter(fileContents);
      
      let dateStr = matterResult.data.date || '';
      if (dateStr instanceof Date) {
        // YYYY-MM-DD
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string' && dateStr) {
        // Assume it's already YYYY-MM-DD or similar
        dateStr = dateStr.split('T')[0];
      }

      return {
        slug: matterResult.data.slug || slug,
        title: matterResult.data.title || slug,
        date: dateStr,
        summary: matterResult.data.summary || '',
        description: matterResult.data.description || matterResult.data.summary || '',
        category: matterResult.data.category,
        tags: matterResult.data.tags,
        image: matterResult.data.image,
        sourceId: matterResult.data.source_id || matterResult.data.sourceId || '',
        content: normalizeBlogContent(matterResult.content, matterResult.data.title || slug),
      };
    });

  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getPostData(slug: string): PostData | null {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  try {
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
      content: normalizeBlogContent(matterResult.content, matterResult.data.title || slug),
    };
  } catch (e) {
    return null;
  }
}
