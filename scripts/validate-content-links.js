const fs = require('fs');
const path = require('path');
const { getAllTopIds } = require('./lib/priority-calculator');

const CONTENT_ROOT = path.join(process.cwd(), 'src', 'content');
const REDIRECTS_FILE = path.join(process.cwd(), 'public', '_redirects');
const WHITELIST_FILE = path.join(process.cwd(), 'scripts', 'data', 'validation-whitelist.json');

function loadWhitelist() {
  const fallback = {
    sitemap_path_exceptions: ['/rss.xml'],
    internal_link_exceptions: [],
  };

  if (!fs.existsSync(WHITELIST_FILE)) return fallback;

  try {
    const parsed = JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
    return {
      sitemap_path_exceptions: Array.isArray(parsed.sitemap_path_exceptions) ? parsed.sitemap_path_exceptions : fallback.sitemap_path_exceptions,
      internal_link_exceptions: Array.isArray(parsed.internal_link_exceptions) ? parsed.internal_link_exceptions : fallback.internal_link_exceptions,
    };
  } catch {
    return fallback;
  }
}

function walkMarkdownFiles(dirPath, out = []) {
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

function normalizePathname(value) {
  if (!value) return '';
  let pathname = String(value).trim();
  if (!pathname) return '';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  return pathname;
}

function normalizePathnameForRule(value) {
  if (!value) return '';
  let pathname = String(value).trim();
  if (!pathname) return '';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  return pathname;
}

function buildInternalExceptionSet(items) {
  const set = new Set();
  for (const item of items) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    set.add(raw);
    const normalized = normalizePathname(raw.split(/[?#]/)[0]);
    if (normalized) set.add(normalized);
  }
  return set;
}

function parseInternalRedirectOverrides() {
  const set = new Set();
  if (!fs.existsSync(REDIRECTS_FILE)) return set;

  const lines = fs.readFileSync(REDIRECTS_FILE, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const source = parts[0];
    const status = parts[2];
    if (!/^301!?$/.test(status)) continue;

    const match = source.match(/^\/(festival|incheon|subsidy)\/([^\s/*:]+)\/?$/);
    if (!match) continue;

    const category = match[1];
    const id = decodeURIComponent(match[2]);
    set.add(`${category}/${id}`);
  }

  return set;
}

function buildTopIdSets() {
  const top = getAllTopIds();
  return {
    festival: new Set(Array.from(top.festival || []).map((id) => String(id).trim()).filter(Boolean)),
    incheon: new Set(Array.from(top.incheon || []).map((id) => String(id).trim()).filter(Boolean)),
    subsidy: new Set(Array.from(top.subsidy || []).map((id) => String(id).trim()).filter(Boolean)),
  };
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

async function main() {
  if (!fs.existsSync(CONTENT_ROOT)) {
    console.log('No content directory found; skipping content link validation.');
    return;
  }

  const [{ unified }, remarkParseModule, { visit }] = await Promise.all([
    import('unified'),
    import('remark-parse'),
    import('unist-util-visit'),
  ]);

  const remarkParse = remarkParseModule.default;
  const whitelist = loadWhitelist();
  const internalExceptions = buildInternalExceptionSet(whitelist.internal_link_exceptions || []);
  const redirectOverrides = parseInternalRedirectOverrides();
  const topIds = buildTopIdSets();

  const files = walkMarkdownFiles(CONTENT_ROOT);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tree = unified().use(remarkParse).parse(content);

    visit(tree, 'link', (node) => {
      const target = node.url || '';
      const parsed = parseLinkTarget(target);
      if (!parsed.pathOnly && parsed.kind !== 'internal-absolute') return;

      const normalizedPath = normalizePathname((parsed.pathOnly || '').split(/[?#]/)[0]);
      const rulePath = normalizePathnameForRule((parsed.pathOnly || '').split(/[?#]/)[0]);
      const line = node.position && node.position.start ? node.position.start.line : 1;
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

      if (internalExceptions.has(target) || (normalizedPath && internalExceptions.has(normalizedPath))) {
        return;
      }

      if (parsed.kind === 'internal-absolute') {
        violations.push({
          rule: 'ABSOLUTE_INTERNAL_URL',
          file: relPath,
          line,
          link: target,
          message: 'pick-n-joy.com absolute internal URL is forbidden. Use relative path with trailing slash.',
        });
      }

      const noSlashMatch = rulePath.match(/^\/(festival|incheon|subsidy|blog)\/([^/?#]+)$/);
      if (noSlashMatch) {
        violations.push({
          rule: 'NO_TRAILING_SLASH',
          file: relPath,
          line,
          link: target,
          message: `Internal detail link must end with trailing slash: ${rulePath}/`,
        });
      }

      const detailMatch = rulePath.match(/^\/(festival|incheon|subsidy)\/([^/?#]+)\/?$/);
      if (detailMatch) {
        const category = detailMatch[1];
        const id = detailMatch[2];
        const key = `${category}/${id}`;

        const isTop = topIds[category] && topIds[category].has(id);
        const hasRedirectOverride = redirectOverrides.has(key);

        if (!isTop && !hasRedirectOverride) {
          violations.push({
            rule: 'NON_TOP_DETAIL_LINK',
            file: relPath,
            line,
            link: target,
            message: `Top set outside detail link is forbidden without per-ID 301 override: ${rulePath}`,
          });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error(`Found ${violations.length} content-link policy violations:`);
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.link}`);
      console.error(`  ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`Content link validation passed. Files scanned: ${files.length}, violations: 0`);
}

main().catch((error) => {
  console.error('validate-content-links failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
