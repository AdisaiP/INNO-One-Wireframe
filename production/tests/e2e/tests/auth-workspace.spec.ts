import { expect, test } from '@playwright/test';

test('Keycloak sign-in opens workspace and an allowed module', async ({ page }) => {
  const profileResponse = page.waitForResponse(
    (response) => response.url().includes('/api/v1/platform/me') && response.status() === 200,
  );

  await page.goto('/');

  await page.locator('#username').fill('adisai');
  await page.locator('#password').fill('inno_dev_only');
  await page.locator('#kc-login').click();

  await profileResponse;
  await expect(page).toHaveURL(/127\.0\.0\.1:5180/);
  await expect(page.getByRole('link', { name: 'Workspace' })).toBeVisible();
  const workspaceNavigation = page.getByRole('complementary', { name: 'Open Workspace navigation' });

  const appsResponse = page.waitForResponse(
    (response) => response.url().includes('/api/v1/platform/apps') && response.status() === 200,
  );
  await workspaceNavigation.getByRole('link', { name: 'Apps' }).click();
  await appsResponse;
  await expect(page).toHaveURL(/\/apps$/);

  const devicesResponse = page.waitForResponse(
    (response) => response.url().includes('/api/v1/devices') && response.status() === 200,
  );
  const appNavigation = page.getByRole('complementary', { name: 'App navigation' });
  await appNavigation.getByRole('link', { name: 'Devices' }).click();
  await devicesResponse;
  await expect(page).toHaveURL(/\/devices$/);
});
