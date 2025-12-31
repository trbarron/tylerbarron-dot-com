import { test, expect } from '@playwright/test';

test.describe('Generative Art Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/generativeArt');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('generativeArt.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
