import { test, expect } from '@playwright/test';

test.describe('CollaborativeCheckmate Route', () => {
  test('renders correctly with test game', async ({ page }) => {
    // Note: This test uses a test game ID and player ID
    // In production, we may need to create a test game first
    const testGameId = 'test-game-123';
    const testPlayerId = 'test-player-1';

    await page.goto(`/collaborativeCheckmate/${testGameId}/${testPlayerId}`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('collaborativeCheckmate.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });
});
