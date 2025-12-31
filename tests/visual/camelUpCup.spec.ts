import { test, expect } from '@playwright/test';

test.describe('Camel Up Cup Route', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto('/camelUpCup');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('camelUpCup.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
