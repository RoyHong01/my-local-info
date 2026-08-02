const { chromium } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getCount(page) {
  return page.locator('[data-testid^="life-card-"]').count();
}

async function waitForAtLeast(page, expected, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await getCount(page);
    if (current >= expected) return current;
    await page.waitForTimeout(100);
  }
  return getCount(page);
}

async function waitForAtMost(page, expected, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await getCount(page);
    if (current <= expected) return current;
    await page.waitForTimeout(100);
  }
  return getCount(page);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/life/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid^="life-card-"]', { timeout: 10000 });

    const initial = await getCount(page);
    assert(initial <= 30, `initial cards should be <=30, got ${initial}`);

    await page.getByTestId('life-filter-restaurant').click();
    const restaurantInitial = await waitForAtMost(page, 30);
    assert(restaurantInitial <= 30, `restaurant tab should reset to <=30, got ${restaurantInitial}`);

    const loadMore = page.getByTestId('life-load-more');
    let expanded = restaurantInitial;
    if (await loadMore.isVisible()) {
      await loadMore.click();
      expanded = await waitForAtLeast(page, Math.min(60, restaurantInitial + 30));
      assert(expanded > restaurantInitial, `restaurant load-more should increase count (before=${restaurantInitial}, after=${expanded})`);
    }

    await page.getByTestId('life-filter-choice').click();
    const choiceCount = await waitForAtMost(page, 30);
    assert(choiceCount <= 30, `choice tab should reset to <=30, got ${choiceCount}`);

    await page.getByTestId('life-filter-restaurant').click();
    const restaurantReset = await waitForAtMost(page, 30);
    assert(restaurantReset <= 30, `switching back to restaurant tab should reset to <=30, got ${restaurantReset}`);

    // 복원 검증: 내부 블로그 링크가 있을 때만 수행
    const internalLinks = page.locator('a[data-testid^="life-card-"][href*="/blog/"]');
    const hasInternal = await internalLinks.first().isVisible().catch(() => false);

    if (hasInternal) {
      if (await loadMore.isVisible()) {
        await loadMore.click();
      }
      const currentExpanded = await waitForAtLeast(page, restaurantReset);

      await page.evaluate(() => window.scrollTo(0, Math.max(900, document.body.scrollHeight * 0.6)));
      await internalLinks.last().click();
      await page.waitForURL((url) => url.pathname.startsWith('/blog/'), { timeout: 10000 });

      const savedScroll = Number(await page.evaluate(() => sessionStorage.getItem('lifeScrollY') || '0'));

      await page.goBack();
      await page.waitForURL((url) => url.pathname === '/life/' || url.pathname === '/life', { timeout: 10000 });

      const restored = await waitForAtLeast(page, currentExpanded, 5000);
      assert(restored >= currentExpanded, `after back expected restored count >=${currentExpanded}, got ${restored}`);

      await page.waitForTimeout(450);
      const afterScroll = await page.evaluate(() => window.scrollY);
      assert(afterScroll >= Math.max(0, savedScroll - 250), `scroll should restore near persisted position (saved=${savedScroll}, after=${afterScroll})`);
    }

    console.log('[PASS] Life static pagination checks passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] Life static pagination checks failed');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
