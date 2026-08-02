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

module.exports = {
  clampVisibleCount,
  resolveInitialVisibleCount,
  createPaginationController,
};
