function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampVisibleCount(totalCount, requestedCount) {
  const total = Math.max(0, Math.floor(toNumber(totalCount, 0)));
  const requested = Math.max(0, Math.floor(toNumber(requestedCount, 0)));
  return Math.min(total, requested);
}

function resolveInitialVisibleCount(totalCount, pageSize) {
  const total = Math.max(0, Math.floor(toNumber(totalCount, 0)));
  const size = Math.max(1, Math.floor(toNumber(pageSize, 1)));
  return Math.min(total, size);
}

function resolveEnsureTarget(indexOrCount) {
  const raw = Math.floor(toNumber(indexOrCount, 0));
  if (raw <= 0) return 0;
  return raw;
}

function createPaginationController(items, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.floor(toNumber(pageSize, 1)));
  let visibleCount = resolveInitialVisibleCount(list.length, size);

  function getVisibleItems() {
    return list.slice(0, visibleCount);
  }

  function getState() {
    return {
      visibleItems: getVisibleItems(),
      visibleCount,
      hasMore: visibleCount < list.length,
      totalCount: list.length,
    };
  }

  function reset() {
    visibleCount = resolveInitialVisibleCount(list.length, size);
    return getState();
  }

  function loadMore() {
    visibleCount = clampVisibleCount(list.length, visibleCount + size);
    return getState();
  }

  function ensureVisible(indexOrCount) {
    const target = resolveEnsureTarget(indexOrCount);
    if (target <= 0) return getState();
    visibleCount = clampVisibleCount(list.length, Math.max(visibleCount, target));
    return getState();
  }

  return {
    getState,
    loadMore,
    reset,
    ensureVisible,
  };
}

function resolveTotalPages(totalCount, pageSize) {
  const total = Math.max(0, Math.floor(toNumber(totalCount, 0)));
  const size = Math.max(1, Math.floor(toNumber(pageSize, 1)));
  return Math.max(1, Math.ceil(total / size));
}

function clampPage(page, totalCount, pageSize) {
  const totalPages = resolveTotalPages(totalCount, pageSize);
  const raw = Math.floor(toNumber(page, 1));
  if (raw < 1) return 1;
  if (raw > totalPages) return totalPages;
  return raw;
}

// 페이지 번호 목록. 현재 페이지 주변만 노출하고 나머지는 생략 기호로 대체한다.
// 예: 1 … 4 5 [6] 7 8 … 21
function buildPageNumbers(currentPage, totalPages, windowSize = 2) {
  const total = Math.max(1, Math.floor(toNumber(totalPages, 1)));
  const cur = Math.min(Math.max(1, Math.floor(toNumber(currentPage, 1))), total);
  const win = Math.max(0, Math.floor(toNumber(windowSize, 2)));
  const pages = new Set([1, total]);
  for (let i = cur - win; i <= cur + win; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('...');
    result.push(p);
    prev = p;
  }
  return result;
}

function createPageController(items, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.floor(toNumber(pageSize, 1)));
  let page = 1;
  const getState = () => {
    const totalPages = resolveTotalPages(list.length, size);
    const start = (page - 1) * size;
    return {
      pageItems: list.slice(start, start + size),
      currentPage: page,
      totalPages,
      totalCount: list.length,
      pageNumbers: buildPageNumbers(page, totalPages),
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  };
  const goTo = (value) => { page = clampPage(value, list.length, size); return getState(); };
  const next = () => goTo(page + 1);
  const prev = () => goTo(page - 1);
  const reset = () => goTo(1);
  return { getState, goTo, next, prev, reset };
}

module.exports = {
  clampVisibleCount,
  resolveInitialVisibleCount,
  createPaginationController,
  resolveTotalPages,
  clampPage,
  buildPageNumbers,
  createPageController,
};
