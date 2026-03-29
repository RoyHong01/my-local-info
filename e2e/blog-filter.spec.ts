import { test, expect } from '@playwright/test';

test('블로그 카테고리 필터 유지 확인', async ({ page }) => {
  await page.goto('/blog');

  await page.getByTestId('blog-filter-전국 축제·여행').click();
  await expect(page).toHaveURL(/\/blog\/?\?category=%EC%B6%95%EC%A0%9C$/);

  const firstCard = page.locator('[data-testid^="blog-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  await expect(page).toHaveURL(/\/blog\/[^/?#]+\/?$/);
  await page.getByTestId('blog-back-button').click();

  await expect(page).toHaveURL(/\/blog\/?\?category=%EC%B6%95%EC%A0%9C$/);
});
