const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REDIRECTS_PATH = path.join(ROOT, 'public', '_redirects');
const DEFAULT_LIMIT = 100;
const DEFAULT_GSC_CSV_PATH = path.join('C:', 'Users', 'Roy Hong', 'AppData', 'Local', 'Temp', '테이블.csv');

const CATEGORY_CONFIG = {
  incheon: {
    dataFile: path.join(ROOT, 'public', 'data', 'incheon.json'),
    getId: (item) => item && (item.서비스ID || item.id),
    listPath: '/incheon/',
  },
  subsidy: {
    dataFile: path.join(ROOT, 'public', 'data', 'subsidy.json'),
    getId: (item) => item && (item.서비스ID || item.id),
    listPath: '/subsidy/',
  },
  festival: {
    dataFile: path.join(ROOT, 'public', 'data', 'festival.json'),
    getId: (item) => item && (item.contentid || item.id),
    listPath: '/festival/',
  },
};

const SOURCE_MARKDOWN_DIRS = [
  path.join(ROOT, 'src', 'content', 'posts'),
  path.join(ROOT, 'src', 'content', 'life'),
];

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let apply = false;
  const gscCsvPaths = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--apply') {
      apply = true;
      continue;
    }
    if (token === '--limit' && args[i + 1]) {
      limit = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (token === '--gsc-csv' && args[i + 1]) {
      gscCsvPaths.push(args[i + 1]);
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    limit = DEFAULT_LIMIT;
  }

  return {
    apply,
    limit: Math.floor(limit),
    gscCsvPaths,
  };
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuote && next === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }

    if (ch === ',' && !inQuote) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  cells.push(cur.trim());
  return cells;
}

function walkFilesRecursively(dir, ext = '.md') {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && fullPath.endsWith(ext)) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

function loadValidIds() {
  const result = {
    incheon: new Set(),
    subsidy: new Set(),
    festival: new Set(),
  };

  for (const [category, cfg] of Object.entries(CATEGORY_CONFIG)) {
    let items = [];
    try {
      const raw = fs.readFileSync(cfg.dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }

    for (const item of items) {
      const id = cfg.getId(item);
      if (!id && id !== 0) continue;
      result[category].add(String(id));
    }
  }

  return result;
}

function loadExistingRedirectIds(redirectsText) {
  const existing = {
    incheon: new Set(),
    subsidy: new Set(),
    festival: new Set(),
  };

  const lineRegex = /^\/(incheon|subsidy|festival)\/([^\s\/]+)\/?\s+\/(?:incheon|subsidy|festival)\/\s+301\s*$/;
  for (const line of redirectsText.split(/\r?\n/)) {
    const trimmed = line.trim();
    const m = trimmed.match(lineRegex);
    if (!m) continue;
    const category = m[1];
    const id = m[2];
    existing[category].add(id);
  }

  return existing;
}

function collectReferencedIdsFromMarkdown() {
  const refs = {
    incheon: new Set(),
    subsidy: new Set(),
    festival: new Set(),
  };

  const files = SOURCE_MARKDOWN_DIRS.flatMap((dir) => walkFilesRecursively(dir, '.md'));
  const hrefRegex = /(?:https?:\/\/pick-n-joy\.com)?\/(incheon|subsidy|festival)\/([^\s\/)#?]+)\/?/g;

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    let match;
    while ((match = hrefRegex.exec(text)) !== null) {
      const category = match[1];
      const id = match[2];
      refs[category].add(id);
    }
  }

  return refs;
}

function collectReferencedIdsFromGscCsv(csvPaths = []) {
  const refs = {
    incheon: new Set(),
    subsidy: new Set(),
    festival: new Set(),
  };

  let processedFiles = 0;
  let extractedRows = 0;
  const hrefRegex = /(?:https?:\/\/(?:www\.)?pick-n-joy\.com)?\/(incheon|subsidy|festival)\/([^\s\/)#?,]+)\/?/i;

  for (const rawPath of csvPaths) {
    if (!rawPath) continue;
    const filePath = path.resolve(process.cwd(), rawPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) continue;

    processedFiles += 1;
    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i]);
      if (cells.length === 0) continue;

      const url = String(cells[0] || '').trim();
      if (!url) continue;

      const m = url.match(hrefRegex);
      if (!m) continue;

      const category = m[1].toLowerCase();
      const id = m[2];
      if (!refs[category]) continue;

      refs[category].add(id);
      extractedRows += 1;
    }
  }

  return {
    refs,
    processedFiles,
    extractedRows,
  };
}

function mergeReferenceSets(baseRefs, extraRefs) {
  const merged = {
    incheon: new Set(baseRefs.incheon),
    subsidy: new Set(baseRefs.subsidy),
    festival: new Set(baseRefs.festival),
  };

  for (const category of Object.keys(merged)) {
    for (const id of extraRefs[category] || []) {
      merged[category].add(id);
    }
  }

  return merged;
}

function buildMissingIdCandidates(validIds, referencedIds, existingRedirectIds) {
  const candidates = [];

  for (const category of Object.keys(CATEGORY_CONFIG)) {
    const ids = Array.from(referencedIds[category]);
    ids.sort((a, b) => a.localeCompare(b, 'ko'));

    for (const id of ids) {
      if (validIds[category].has(id)) continue;
      if (existingRedirectIds[category].has(id)) continue;
      candidates.push({ category, id });
    }
  }

  return candidates;
}

function buildRedirectLines(entries) {
  const lines = [];
  for (const entry of entries) {
    const listPath = CATEGORY_CONFIG[entry.category].listPath;
    lines.push(`/${entry.category}/${entry.id} ${listPath} 301`);
    lines.push(`/${entry.category}/${entry.id}/ ${listPath} 301`);
  }
  return lines;
}

function injectRedirectLines(redirectsText, newLines) {
  if (newLines.length === 0) return redirectsText;

  const marker = '# Catch-all for non-existent item pages';
  const idx = redirectsText.indexOf(marker);

  const block = `${newLines.join('\n')}\n`;
  if (idx === -1) {
    return `${redirectsText.trimEnd()}\n${block}`;
  }

  const before = redirectsText.slice(0, idx).trimEnd();
  const after = redirectsText.slice(idx);
  return `${before}\n${block}${after}`;
}

function main() {
  const { apply, limit, gscCsvPaths } = parseArgs();

  const redirectsText = fs.readFileSync(REDIRECTS_PATH, 'utf8');
  const validIds = loadValidIds();
  const existingRedirectIds = loadExistingRedirectIds(redirectsText);
  const referencedFromMarkdown = collectReferencedIdsFromMarkdown();

  const csvSourcePaths = gscCsvPaths.length > 0 ? gscCsvPaths : [DEFAULT_GSC_CSV_PATH];
  const {
    refs: referencedFromCsv,
    processedFiles: csvProcessedFiles,
    extractedRows: csvExtractedRows,
  } = collectReferencedIdsFromGscCsv(csvSourcePaths);

  const referencedIds = mergeReferenceSets(referencedFromMarkdown, referencedFromCsv);

  const allCandidates = buildMissingIdCandidates(validIds, referencedIds, existingRedirectIds);
  const selected = allCandidates.slice(0, limit);
  const newLines = buildRedirectLines(selected);

  console.log(`[redirects] gsc csv files processed: ${csvProcessedFiles}`);
  console.log(`[redirects] gsc csv url rows extracted: ${csvExtractedRows}`);
  console.log(`[redirects] referenced missing IDs: ${allCandidates.length}`);
  console.log(`[redirects] selected IDs (limit=${limit}): ${selected.length}`);

  if (selected.length > 0) {
    const grouped = selected.reduce((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {});
    console.log(`[redirects] selected by category: incheon=${grouped.incheon || 0}, subsidy=${grouped.subsidy || 0}, festival=${grouped.festival || 0}`);
  }

  if (!apply) {
    console.log('[redirects] dry-run mode. use --apply to write public/_redirects');
    return;
  }

  if (newLines.length === 0) {
    console.log('[redirects] no new redirect lines to apply');
    return;
  }

  const updated = injectRedirectLines(redirectsText, newLines);
  fs.writeFileSync(REDIRECTS_PATH, updated, 'utf8');
  console.log(`[redirects] applied ${selected.length} IDs (${newLines.length} lines) to public/_redirects`);
}

main();
