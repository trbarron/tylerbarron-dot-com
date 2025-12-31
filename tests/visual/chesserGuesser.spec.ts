import { test, expect } from '@playwright/test';

test.describe('ChesserGuesser Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/chesserGuesser');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('chesserGuesser.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
