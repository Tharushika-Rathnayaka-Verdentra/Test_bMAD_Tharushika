const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/login-page');

test.describe('OrangeHRM authentication', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('AUTH-001 valid credentials open the dashboard', async ({ page }) => {
    await loginPage.login(
      process.env.ORANGEHRM_USERNAME || 'Admin',
      process.env.ORANGEHRM_PASSWORD || 'admin123',
    );
    await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('AUTH-002 invalid credentials are rejected', async ({ page }) => {
    await loginPage.login('automation-invalid-user', 'invalid-password');
    await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('AUTH-003 empty credentials show required validation', async ({ page }) => {
    await loginPage.submit.click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(2);
    await expect(loginPage.submit).toBeVisible();
  });

  test('AUTH-004 logout prevents access to the dashboard', async ({ page }) => {
    await loginPage.login(
      process.env.ORANGEHRM_USERNAME || 'Admin',
      process.env.ORANGEHRM_PASSWORD || 'admin123',
    );
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.locator('.oxd-userdropdown-tab').click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(loginPage.submit).toBeVisible();
    await page.goto('/web/index.php/dashboard/index');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(loginPage.submit).toBeVisible();
  });
});
