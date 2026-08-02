const { chromium } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getCount(page) {
  return page.locator('[data-testid^="subsidy-card-"]').count();
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

async function clickLoadMoreTo(page, targetCount) {
  for (let i = 0; i < 6; i += 1) {
    const current = await getCount(page);
    if (current >= targetCount) return current;
    const button = page.getByTestId('subsidy-load-more');
    if (!(await button.isVisible())) break;
    await button.click();
    await page.waitForTimeout(120);
  }
  return getCount(page);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/subsidy/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid^="subsidy-card-"]', { timeout: 10000 });

    const initial = await getCount(page);
    assert(initial === 30, `initial cards should be 30, got ${initial}`);

    const after60 = await clickLoadMoreTo(page, 60);
    assert(after60 >= 60, `after first load more expected >=60, got ${after60}`);

    const after90 = await clickLoadMoreTo(page, 90);
    assert(after90 >= 90, `after second load more expected >=90, got ${after90}`);

    await page.evaluate(() => window.scrollTo(0, Math.max(1200, document.body.scrollHeight * 0.65)));
    const beforeScroll = await page.evaluate(() => window.scrollY);

    await page.locator('[data-testid^="subsidy-card-"]').nth(89).click();
    await page.waitForURL((url) => url.pathname.startsWith('/subsidy/') && url.pathname !== '/subsidy/', { timeout: 10000 });

    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/subsidy/', { timeout: 10000 });

    const restored = await waitForAtLeast(page, 90, 5000);
    assert(restored >= 90, `after back expected restored >=90, got ${restored}`);

    const afterScroll = await page.evaluate(() => window.scrollY);
    assert(afterScroll >= Math.max(0, beforeScroll - 250), `scroll should restore near previous position (before=${beforeScroll}, after=${afterScroll})`);

    console.log('[PASS] Subsidy static pagination checks passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] Subsidy static pagination checks failed');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
