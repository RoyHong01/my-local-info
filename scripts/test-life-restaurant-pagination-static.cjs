const { chromium } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getCount(page) {
  return page.locator('[data-testid^="life-restaurant-card-"]').count();
}

async function waitForCount(page, expected, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await getCount(page);
    if (current === expected) return current;
    await page.waitForTimeout(100);
  }
  return getCount(page);
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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/life/restaurant/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid^="life-restaurant-card-"]', { timeout: 10000 });

    const firstCount = await getCount(page);
    assert(firstCount === Math.min(30, firstCount), 'initial pagination render should be capped at 30');

    const loadMore = page.getByTestId('life-restaurant-load-more');
    if (await loadMore.isVisible()) {
      await loadMore.click();
      const after60 = await waitForAtLeast(page, 60);
      assert(after60 >= 60, `after load-more expected >=60, got ${after60}`);
    }

    // 탭 전환 리셋 검증
    await page.getByRole('button', { name: '서울' }).click();
    const seoulCount = await getCount(page);
    assert(seoulCount <= 30, `tab switch should reset to <=30, got ${seoulCount}`);

    await page.getByRole('button', { name: '인천' }).click();
    const targetReset = Math.min(30, firstCount);
    const resetCount = await waitForCount(page, targetReset).catch(async () => getCount(page));
    assert(resetCount <= 30, `switching back tab should keep initial page size, got ${resetCount}`);

    // 복원 검증은 내부 블로그 링크가 있을 때만 수행
    const blogLinks = page.locator('a[href^="/blog/"]:has-text("해당 블로그 내용 보기")');
    const hasBlogLink = await blogLinks.first().isVisible().catch(() => false);

    if (hasBlogLink) {
      if (await loadMore.isVisible()) {
        await loadMore.click();
      }
      const expanded = await waitForAtLeast(page, 30);
      await page.evaluate(() => window.scrollTo(0, Math.max(800, document.body.scrollHeight * 0.6)));

      await blogLinks.last().click();
      await page.waitForURL((url) => url.pathname.startsWith('/blog/'), { timeout: 10000 });

      const onBlogStorage = await page.evaluate(() => ({
        tab: sessionStorage.getItem('lifeRestaurantTab'),
        visible: sessionStorage.getItem('lifeRestaurantVisibleCount'),
        scroll: sessionStorage.getItem('lifeRestaurantScrollY'),
      }));
      const expectedScroll = Number(onBlogStorage.scroll || 0);

      await page.goBack();
      await page.waitForURL((url) => url.pathname === '/life/restaurant/', { timeout: 10000 });

      const restored = await waitForAtLeast(page, expanded, 5000);
      assert(restored >= expanded, `after back expected restored count >=${expanded}, got ${restored}`);

      await page.waitForTimeout(450);
      const afterScroll = await page.evaluate(() => window.scrollY);
      assert(afterScroll >= Math.max(0, expectedScroll - 250), `scroll should restore near persisted position (saved=${expectedScroll}, after=${afterScroll})`);
    }

    console.log('[PASS] Life/restaurant static pagination checks passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[FAIL] Life/restaurant static pagination checks failed');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
