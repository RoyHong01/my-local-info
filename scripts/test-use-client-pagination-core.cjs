const {
  createPaginationController,
} = require('../src/components/pagination/pagination-core.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testLoadMoreAndReset() {
  const items = Array.from({ length: 95 }, (_, index) => `item-${index + 1}`);
  const controller = createPaginationController(items, 30);

  let state = controller.getState();
  assert(state.visibleCount === 30, 'initial visibleCount should be 30');

  state = controller.loadMore();
  assert(state.visibleCount === 60, 'visibleCount should increase to 60 after first loadMore');

  state = controller.loadMore();
  assert(state.visibleCount === 90, 'visibleCount should increase to 90 after second loadMore');

  state = controller.loadMore();
  assert(state.visibleCount === 95, 'visibleCount should clamp at total length on overflow');
  assert(state.hasMore === false, 'hasMore should be false at the end of list');

  state = controller.reset();
  assert(state.visibleCount === 30, 'reset should restore visibleCount to page size');
}

function testEnsureVisible() {
  const items = Array.from({ length: 120 }, (_, index) => `item-${index + 1}`);
  const controller = createPaginationController(items, 30);

  let state = controller.ensureVisible(90);
  assert(state.visibleCount === 90, 'ensureVisible should expand to requested count');

  state = controller.ensureVisible(300);
  assert(state.visibleCount === 120, 'ensureVisible should clamp to total length when requested count is too large');

  state = controller.reset();
  assert(state.visibleCount === 30, 'reset should still work after ensureVisible');
}

try {
  testLoadMoreAndReset();
  testEnsureVisible();
  console.log('[PASS] useClientPagination core mock-array checks passed');
} catch (error) {
  console.error('[FAIL] useClientPagination core mock-array checks failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
