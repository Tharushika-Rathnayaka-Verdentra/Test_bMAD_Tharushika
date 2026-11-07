const path = require('node:path');

class JiraReporter {
  constructor(options = {}) {
    const env = options.env || process.env;

    this.enabled = env.JIRA_ENABLED === 'true';
    this.request = options.fetch || globalThis.fetch;

    if (!this.enabled) return;

    for (const name of [
      'JIRA_BASE_URL',
      'JIRA_EMAIL',
      'JIRA_API_TOKEN',
      'JIRA_PROJECT_KEY',
    ]) {
      if (!env[name]?.trim()) {
        throw new Error(`${name} is required when JIRA_ENABLED=true`);
      }
    }

    const url = new URL(env.JIRA_BASE_URL);

    if (url.protocol !== 'https:' || url.username ||
        url.password || url.search || url.hash) {
      throw new Error('Invalid JIRA_BASE_URL');
    }

    this.endpoint = `${url.origin}/rest/api/3/issue`;

    this.authorization =
      `Basic ${Buffer.from(
        `${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`
      ).toString('base64')}`;

    this.project = env.JIRA_PROJECT_KEY;
    this.issueType = env.JIRA_ISSUE_TYPE || 'Bug';
  }

  onBegin(config, suite) {
    this.rootDir = config.rootDir;
    this.suite = suite;
  }

  async onEnd() {
    if (!this.enabled) return;

    for (const test of this.suite.allTests()) {
      const result = test.results.at(-1);

      if (
        test.outcome() !== 'unexpected' ||
        !['failed', 'timedOut'].includes(result?.status)
      ) {
        continue;
      }

      const summary =
        `[Playwright] ${test.titlePath().filter(Boolean).join(' > ')}`
          .slice(0, 255);

      const location =
        `${path.relative(this.rootDir, test.location.file)}:${test.location.line}`;

      const description =
        `Test: ${summary}\nLocation: ${location}\n` +
        `Status: ${result.status}\n` +
        'Review the Playwright report for diagnostics.';

      try {
        const response = await this.request(this.endpoint, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),

          headers: {
            Authorization: this.authorization,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            fields: {
              project: { key: this.project },
              issuetype: { name: this.issueType },
              summary,

              description: {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{
                    type: 'text',
                    text: description,
                  }],
                }],
              },

              labels: ['playwright', 'orangehrm'],
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Jira request failed');
        }

        const issue = await response.json();

        if (
          typeof issue.key !== 'string' ||
          !/^[A-Z][A-Z0-9_]*-\d+$/.test(issue.key)
        ) {
          throw new Error('Invalid Jira response');
        }

        console.log(`Jira defect created: ${issue.key}`);

      } catch {
        console.error(
          'Jira reporting failed. Check credentials and project configuration.'
        );
      }
    }
  }
}

module.exports = JiraReporter;