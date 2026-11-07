const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/login-page');

test.describe('OrangeHRM authentication', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('C84 - Verify interoperability with system file dialogs', async ({ page }) => {
    await loginPage.login(
      process.env.ORANGEHRM_USERNAME || 'Admin',
      process.env.ORANGEHRM_PASSWORD || 'admin123',
    );
    await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('C85 - Verify line spacing on multi-page document', async ({ page }) => {
    await loginPage.login('automation-invalid-user', 'invalid-password');
    await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('C86 - Add document footer with page numbers and author', async ({ page }) => {
    await loginPage.submit.click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(2);
    await expect(loginPage.submit).toBeVisible();
  });

  test('C87 - Add numbered list to inline table within an document', async ({ page }) => {
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

  test('C88 - Verify clipboard history with platform independent graphic file', async ({ page }) => {
    await loginPage.password.fill('admin123');
    await loginPage.submit.click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(1);
    await expect(loginPage.password).toHaveValue('admin123');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('C89 - Test menu keyboard bindings and shortcuts', async ({ page }) => {
    await loginPage.username.fill('Admin');
    await loginPage.submit.click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(1);
    await expect(loginPage.username).toHaveValue('Admin');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
