import { test, expect } from '@playwright/test';

/**
 * Baseline visual regression test setup
 * Creates initial screenshots for all major routes before refactoring
 */

test.describe('Baseline Visual Tests', () => {
  test('homepage renders correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('about page renders correctly', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveScreenshot('about.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('blog index renders correctly', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveScreenshot('blog-index.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
