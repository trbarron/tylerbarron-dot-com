import { test, expect } from '@playwright/test';

test.describe('SSBM Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/SSBM');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('SSBM.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
