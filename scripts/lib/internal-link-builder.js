const { getAllTopIds } = require('./priority-calculator');

const INTERNAL_PATH_PATTERN = /\/(?:blog|festival|incheon|subsidy)\/[^)\s?#]+\/?/;

function normalizeCategory(category) {
  const value = String(category || '').trim().toLowerCase();
  if (value === 'festival' || value === 'incheon' || value === 'subsidy') return value;
  return '';
}

function getIdFromItem(category, item) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory || item === undefined || item === null) return '';

  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }

  if (normalizedCategory === 'festival') {
    return String(item.contentid || item.id || '').trim();
  }

  return String(item.서비스ID || item.id || '').trim();
}

function getOfficialUrl(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.상세조회URL || item.homepage || item.link || '').trim();
}

function normalizeTopSet(setLike) {
  const source = setLike || [];
  return new Set(Array.from(source).map((id) => String(id).trim()).filter(Boolean));
}

function loadTopIdSets() {
  const top = getAllTopIds();
  return {
    festival: normalizeTopSet(top.festival),
    incheon: normalizeTopSet(top.incheon),
    subsidy: normalizeTopSet(top.subsidy),
  };
}

function buildDetailPath(category, item) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) return '';

  const id = getIdFromItem(normalizedCategory, item);
  if (!id) return '';

  return `/${normalizedCategory}/${encodeURIComponent(id)}/`;
}

function buildBlogPath(slug) {
  const value = String(slug || '').trim();
  if (!value) return '';
  return `/blog/${encodeURIComponent(value)}/`;
}

function buildPolicySafeDetailUrl(category, item, topIdSets) {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) return '';

  const id = getIdFromItem(normalizedCategory, item);
  const detailPath = buildDetailPath(normalizedCategory, item);
  const topSet = topIdSets && topIdSets[normalizedCategory] ? topIdSets[normalizedCategory] : null;

  if (id && detailPath && topSet && topSet.has(id)) {
    return detailPath;
  }

  return getOfficialUrl(item);
}

function normalizeInternalLinksInMarkdown(markdown) {
  let text = String(markdown || '');

  text = text.replace(new RegExp(`https://pick-n-joy\\.com(${INTERNAL_PATH_PATTERN.source})`, 'g'), '$1');
  text = text.replace(new RegExp(`https://www\\.pick-n-joy\\.com(${INTERNAL_PATH_PATTERN.source})`, 'g'), '$1');
  text = text.replace(/\]\((\/(?:blog|festival|incheon|subsidy)\/[^)\s?#]+)(?<!\/)\)/g, ']($1/)');

  return text;
}

module.exports = {
  loadTopIdSets,
  buildDetailPath,
  buildBlogPath,
  buildPolicySafeDetailUrl,
  normalizeInternalLinksInMarkdown,
};
