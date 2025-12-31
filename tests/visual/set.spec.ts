import { test, expect } from '@playwright/test';

test.describe('Set Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/set');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('set.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
