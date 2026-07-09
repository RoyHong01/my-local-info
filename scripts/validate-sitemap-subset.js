const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'out');
const SITEMAP_PATH = path.join(OUT_DIR, 'sitemap.xml');
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

function normalizePathname(value) {
  if (!value) return '';
  let pathname = String(value).trim();
  if (!pathname) return '';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  return pathname;
}

function collectOutPagePaths() {
  const pages = new Set();

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== 'index.html') continue;

      const relativeDir = path.relative(OUT_DIR, path.dirname(fullPath)).replace(/\\/g, '/');
      const pathname = relativeDir && relativeDir !== '.' ? `/${relativeDir}/` : '/';
      pages.add(normalizePathname(pathname));
    }
  }

  walk(OUT_DIR);
  return pages;
}

function collectSitemapPaths() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    throw new Error(`sitemap file not found: ${SITEMAP_PATH}`);
  }

  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const matches = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g));
  const paths = new Set();

  for (const match of matches) {
    const urlValue = String(match[1] || '').replace(/&amp;/g, '&');
    try {
      const parsed = new URL(urlValue);
      paths.add(normalizePathname(decodeURIComponent(parsed.pathname)));
    } catch {
      // Ignore malformed URL rows; build should not fail in observation mode for malformed loc entries.
    }
  }

  return paths;
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn(`Sitemap subset check skipped (observation mode): out directory not found: ${OUT_DIR}`);
    return;
  }

  if (!fs.existsSync(SITEMAP_PATH)) {
    console.warn(`Sitemap subset check skipped (observation mode): sitemap not found: ${SITEMAP_PATH}`);
    return;
  }

  const whitelist = loadWhitelist();
  const exceptions = new Set((whitelist.sitemap_path_exceptions || []).map((value) => normalizePathname(value)).filter(Boolean));

  const outPages = collectOutPagePaths();
  const sitemapPaths = collectSitemapPaths();

  const violations = [];
  for (const sitemapPath of sitemapPaths) {
    if (exceptions.has(sitemapPath)) continue;
    if (!outPages.has(sitemapPath)) {
      violations.push(sitemapPath);
    }
  }

  if (violations.length > 0) {
    console.warn(`Sitemap subset check (observation mode): ${violations.length} path(s) missing in out pages.`);
    for (const item of violations.slice(0, 200)) {
      console.warn(`- ${item}`);
    }
    if (violations.length > 200) {
      console.warn(`... and ${violations.length - 200} more`);
    }
    console.warn('Observation mode is active: exiting with code 0.');
    return;
  }

  console.log(`Sitemap subset check passed (observation mode). sitemap=${sitemapPaths.size}, outPages=${outPages.size}, violations=0`);
}

try {
  main();
} catch (error) {
  console.error('validate-sitemap-subset failed:', error && error.stack ? error.stack : error);
  process.exit(1);
}
