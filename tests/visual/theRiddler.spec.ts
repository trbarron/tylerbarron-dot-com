import { test, expect } from '@playwright/test';

test.describe('theRiddler Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/theRiddler');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('theRiddler.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
