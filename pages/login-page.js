class LoginPage {
  constructor(page) {
    this.page = page;
    this.username = page.getByRole('textbox', { name: 'Username', exact: true });
    this.password = page.getByRole('textbox', { name: 'Password', exact: true });
    this.submit = page.getByRole('button', { name: 'Login', exact: true });
  }

  async goto() {
    await this.page.goto('/web/index.php/auth/login');
    await this.submit.waitFor();
  }

  async login(username, password) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }
}

module.exports = { LoginPage };
