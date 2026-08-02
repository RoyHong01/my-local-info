const { chromium } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getCardCount(page) {
  return page.locator('[data-testid^="blog-card-"]').count();
}

async function waitForCardCount(page, expected, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await getCardCount(page);
    if (current === expected) return current;
    await page.waitForTimeout(80);
  }
  return getCardCount(page);
}

async function waitForAtLeastCardCount(page, expected, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await getCardCount(page);
    if (current >= expected) return current;
    await page.waitForTimeout(80);
  }
  return getCardCount(page);
}

async function loadToCount(page, targetCount) {
  for (let i = 0; i < 5; i += 1) {
    const current = await getCardCount(page);
    if (current >= targetCount) return current;

    const button = page.getByTestId('blog-load-more');
    if (!(await button.isVisible())) {
      throw new Error(`Load more button not visible before reaching ${targetCount} cards (current=${current})`);
    }

    await button.click();
    await page.waitForTimeout(120);
  }

  return getCardCount(page);
}

async function verifyFilterAndLoadMore(page, filterTestId, urlKeyword) {
  await page.getByTestId(filterTestId).click();
  await page.waitForURL((url) => url.pathname === '/blog/' && url.searchParams.get('category') === urlKeyword, { timeout: 5000 });

  const initial = await waitForCardCount(page, 30);
  assert(initial === 30, `${filterTestId}: initial visible card count should be 30, got ${initial}`);

  const after60 = await loadToCount(page, 60);
  assert(after60 >= 60, `${filterTestId}: expected at least 60 cards after first expansion, got ${after60}`);

  const after90 = await loadToCount(page, 90);
  assert(after90 >= 90, `${filterTestId}: expected at least 90 cards after second expansion, got ${after90}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/blog/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid^="blog-card-"]', { timeout: 10000 });

    const firstLoadCount = await getCardCount(page);
    assert(firstLoadCount === 30, `first load should render 30 cards, got ${firstLoadCount}`);

    await verifyFilterAndLoadMore(page, 'blog-filter-인천 지역 정보', '인천');
    await verifyFilterAndLoadMore(page, 'blog-filter-전국 보조금·복지 정책', '보조금');
    await verifyFilterAndLoadMore(page, 'blog-filter-전국 축제·여행', '축제');

    // 카테고리 전환 시 페이지네이션 리셋 검증
    await page.getByTestId('blog-filter-전국 보조금·복지 정책').click();
    await page.waitForURL((url) => url.pathname === '/blog/' && url.searchParams.get('category') === '보조금', { timeout: 5000 });
    await loadToCount(page, 90);

    await page.getByTestId('blog-filter-전국 축제·여행').click();
    await page.waitForURL((url) => url.pathname === '/blog/' && url.searchParams.get('category') === '축제', { timeout: 5000 });
    const resetCount = await waitForCardCount(page, 30);
    assert(resetCount === 30, `category switch should reset visible cards to 30, got ${resetCount}`);

    // 90편 로드 후 상세 진입/복귀 시 visibleCount + scroll 복원 검증
    await page.getByTestId('blog-filter-전국 보조금·복지 정책').click();
    await page.waitForURL((url) => url.pathname === '/blog/' && url.searchParams.get('category') === '보조금', { timeout: 5000 });
    await loadToCount(page, 90);

    await page.evaluate(() => window.scrollTo(0, Math.max(1200, document.body.scrollHeight * 0.6)));
    const scrollBefore = await page.evaluate(() => window.scrollY);

    const cards = page.locator('[data-testid^="blog-card-"]');
    const totalCards = await cards.count();
    assert(totalCards >= 90, `expected at least 90 cards before detail navigation, got ${totalCards}`);

    await cards.nth(89).click();
    await page.waitForURL((url) => /\/blog\/.+/.test(url.pathname) && !url.searchParams.has('category'), { timeout: 10000 });

    await page.getByTestId('blog-back-button').click();
    await page.waitForURL((url) => url.pathname === '/blog/' && url.searchParams.get('category') === '보조금', { timeout: 10000 });

    const restoredCount = await waitForAtLeastCardCount(page, 90, 4000);
    assert(restoredCount >= 90, `after back navigation, expected restored cards >= 90, got ${restoredCount}`);

    const scrollAfter = await page.evaluate(() => window.scrollY);
    assert(
      scrollAfter >= Math.max(0, scrollBefore - 250),
      `scroll should be restored near previous position (before=${scrollBefore}, after=${scrollAfter})`
    );

    console.log('[PASS] Static blog pagination checks passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] Static blog pagination checks failed');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
