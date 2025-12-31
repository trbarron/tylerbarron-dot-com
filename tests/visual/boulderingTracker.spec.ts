import { test, expect } from '@playwright/test';

test.describe('Bouldering Tracker Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/boulderingTracker');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('boulderingTracker.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
