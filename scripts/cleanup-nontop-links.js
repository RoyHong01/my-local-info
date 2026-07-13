const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { getAllTopIds } = require('./lib/priority-calculator');

const CONTENT_ROOT = path.join(process.cwd(), 'src', 'content');
const POSTS_ROOT = path.join(process.cwd(), 'src', 'content', 'posts');

function walkMarkdownFiles(dirPath, out = []) {
  if (!fs.existsSync(dirPath)) return out;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkMarkdownFiles(nextPath, out);
      continue;
    }
    if (entry.isFile() && nextPath.endsWith('.md')) {
      out.push(nextPath);
    }
  }
  return out;
}

function normalizePathnameForRule(value) {
  if (!value) return '';
  let pathname = String(value).trim();
  if (!pathname) return '';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  return pathname;
}

function parseLinkTarget(target) {
  const value = String(target || '').trim();
  if (!value) return { kind: 'empty' };

  if (/^(mailto:|tel:|javascript:)/i.test(value)) {
    return { kind: 'skip' };
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === 'pick-n-joy.com' || host === 'www.pick-n-joy.com') {
      const pathname = decodeURIComponent(parsed.pathname || '/');
      return {
        kind: 'internal-absolute',
        raw: value,
        pathOnly: pathname,
      };
    }
    return { kind: 'external' };
  } catch {
    // Relative path branch below
  }

  if (value.startsWith('/')) {
    const pathOnly = decodeURIComponent(value.split(/[?#]/)[0]);
    return {
      kind: 'internal-relative',
      raw: value,
      pathOnly,
    };
  }

  return { kind: 'relative-nonroot' };
}

function buildTopIdSets() {
  const top = getAllTopIds();
  return {
    festival: new Set(Array.from(top.festival || []).map((id) => String(id).trim()).filter(Boolean)),
    incheon: new Set(Array.from(top.incheon || []).map((id) => String(id).trim()).filter(Boolean)),
    subsidy: new Set(Array.from(top.subsidy || []).map((id) => String(id).trim()).filter(Boolean)),
  };
}

function toCategoryKey(categoryValue) {
  const normalized = String(categoryValue || '').trim();
  if (!normalized) return '';
  if (normalized === '전국 축제·여행') return 'festival';
  if (normalized === '인천 지역 정보') return 'incheon';
  if (normalized === '전국 보조금·복지 정책') return 'subsidy';
  return '';
}

function getPostDateValue(frontmatterDate, fileName) {
  const fromFrontmatter = Date.parse(String(frontmatterDate || ''));
  if (!Number.isNaN(fromFrontmatter)) return fromFrontmatter;

  const m = String(fileName || '').match(/^(\d{4}-\d{2}-\d{2})-/);
  if (!m) return 0;

  const fromFileName = Date.parse(`${m[1]}T00:00:00Z`);
  if (!Number.isNaN(fromFileName)) return fromFileName;

  return 0;
}

function buildSourceIdSlugMap() {
  const files = walkMarkdownFiles(POSTS_ROOT);
  const map = new Map();

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);

    const categoryKey = toCategoryKey(parsed.data.category);
    if (!categoryKey) continue;

    const sourceIdRaw = parsed.data.source_id;
    if (sourceIdRaw === undefined || sourceIdRaw === null) continue;

    const sourceId = String(sourceIdRaw).trim();
    if (!sourceId) continue;

    const slug = String(parsed.data.slug || fileName.replace(/\.md$/, '')).trim();
    if (!slug) continue;

    const key = `${categoryKey}/${sourceId}`;
    const rankDate = getPostDateValue(parsed.data.date, fileName);
    const current = map.get(key);

    if (!current || rankDate >= current.rankDate) {
      map.set(key, { slug, rankDate });
    }
  }

  return map;
}

function buildLineStartIndices(content) {
  const starts = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function toOffset(lineStarts, pos) {
  const line = (pos && pos.line) || 1;
  const column = (pos && pos.column) || 1;
  const lineStart = lineStarts[Math.max(0, line - 1)] || 0;
  return lineStart + Math.max(0, column - 1);
}

function extractNodeText(node) {
  if (!node) return '';

  if (node.type === 'text' || node.type === 'inlineCode') {
    return String(node.value || '');
  }

  if (Array.isArray(node.children)) {
    return node.children.map(extractNodeText).join('');
  }

  return '';
}

async function main() {
  if (!fs.existsSync(CONTENT_ROOT)) {
    console.log('No content directory found; skipping non-top link cleanup.');
    return;
  }

  const [{ unified }, remarkParseModule, { visit }] = await Promise.all([
    import('unified'),
    import('remark-parse'),
    import('unist-util-visit'),
  ]);
  const remarkParse = remarkParseModule.default;

  const topIds = buildTopIdSets();
  const sourceIdSlugMap = buildSourceIdSlugMap();
  const files = walkMarkdownFiles(CONTENT_ROOT);

  let changedFiles = 0;
  let replacedToBlog = 0;
  let unlinkedToText = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tree = unified().use(remarkParse).parse(content);
    const lineStarts = buildLineStartIndices(content);

    const replacements = [];

    visit(tree, 'link', (node) => {
      const parsed = parseLinkTarget(node.url || '');
      if (!parsed.pathOnly && parsed.kind !== 'internal-absolute') return;

      const rulePath = normalizePathnameForRule((parsed.pathOnly || '').split(/[?#]/)[0]);
      const detailMatch = rulePath.match(/^\/(festival|incheon|subsidy)\/([^/?#]+)\/?$/);
      if (!detailMatch) return;

      const category = detailMatch[1];
      const id = decodeURIComponent(detailMatch[2]);
      const isTop = topIds[category] && topIds[category].has(id);
      if (isTop) return;

      if (!node.position || !node.position.start || !node.position.end) return;

      const key = `${category}/${id}`;
      const slugInfo = sourceIdSlugMap.get(key);
      const label = extractNodeText(node).trim() || String(node.url || '').trim();

      const replacement = slugInfo
        ? `[${label}](/blog/${slugInfo.slug}/)`
        : label;

      replacements.push({
        start: toOffset(lineStarts, node.position.start),
        end: toOffset(lineStarts, node.position.end),
        replacement,
        toBlog: Boolean(slugInfo),
      });
    });

    if (replacements.length === 0) continue;

    replacements.sort((a, b) => b.start - a.start);
    let next = content;

    for (const item of replacements) {
      next = next.slice(0, item.start) + item.replacement + next.slice(item.end);
      if (item.toBlog) replacedToBlog += 1;
      else unlinkedToText += 1;
    }

    if (next !== content) {
      fs.writeFileSync(filePath, next, 'utf8');
      changedFiles += 1;
    }
  }

  console.log(`[cleanup-nontop-links] changed_files=${changedFiles}, to_blog=${replacedToBlog}, unlinked=${unlinkedToText}`);
}

main().catch((error) => {
  console.error('cleanup-nontop-links failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
