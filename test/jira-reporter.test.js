const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const JiraReporter = require('../reporters/jira-reporter');

const rootDir = path.resolve(__dirname, '..');
const env = {
  JIRA_ENABLED: 'true',
  JIRA_BASE_URL: 'https://example.atlassian.net',
  JIRA_EMAIL: 'automation@example.invalid',
  JIRA_API_TOKEN: 'unit-test-placeholder',
  JIRA_PROJECT_KEY: 'HRM',
};

function testCase(outcome = 'unexpected', status = 'failed') {
  return {
    titlePath: () => ['', 'chromium', 'AUTH-001 dashboard'],
    location: { file: path.join(rootDir, 'tests/login.spec.js'), line: 12 },
    results: [{ status: 'failed' }, { status }],
    outcome: () => outcome,
  };
}

function setup(tests, response = { ok: true, json: async () => ({ key: 'HRM-42' }) }, overrides = {}) {
  const calls = [];
  const reporter = new JiraReporter({
    env: { ...env, ...overrides },
    fetch: async (...args) => {
      calls.push(args);
      if (response instanceof Error) throw response;
      return response;
    },
  });
  reporter.onBegin({ rootDir }, { allTests: () => tests });
  return { reporter, calls };
}

test('Jira is disabled by default and needs no credentials', async () => {
  const reporter = new JiraReporter({
    env: {},
    fetch: () => assert.fail('must not contact Jira'),
  });
  assert.equal(await reporter.onEnd(), undefined);
});

test('only the exact opt-in value enables Jira', () => {
  assert.doesNotThrow(() => new JiraReporter({ env: { JIRA_ENABLED: 'false' } }));
  assert.doesNotThrow(() => new JiraReporter({ env: { JIRA_ENABLED: 'TRUE' } }));
});

test('enabled Jira requires each configuration value', () => {
  for (const key of ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY']) {
    assert.throws(() => new JiraReporter({ env: { ...env, [key]: '' } }), new RegExp(key));
  }
});

test('Jira rejects insecure or credential-bearing URLs', () => {
  for (const url of [
    'http://example.atlassian.net',
    '******example.atlassian.net',
    'https://example.atlassian.net/path',
    'https://example.atlassian.net?token=value',
    'https://example.atlassian.net#fragment',
    'not-a-url',
  ]) {
    assert.throws(() => new JiraReporter({ env: { ...env, JIRA_BASE_URL: url } }));
  }
});

test('a final failure creates one Jira Cloud issue, not one per retry', async () => {
  const { reporter, calls } = setup([testCase()]);
  assert.equal(await reporter.onEnd(), undefined);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://example.atlassian.net/rest/api/3/issue');
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.headers.Authorization,
    `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}`);
  const { fields } = JSON.parse(options.body);
  assert.deepEqual(fields.project, { key: 'HRM' });
  assert.deepEqual(fields.issuetype, { name: 'Bug' });
  assert.match(fields.summary, /AUTH-001/);
  assert.equal(fields.description.type, 'doc');
  assert.equal(fields.description.version, 1);
  assert.match(fields.description.content[0].content[0].text, /tests[/\\]login.spec.js:12/);
  assert.ok(!options.body.includes(env.JIRA_API_TOKEN));
  assert.ok(!options.body.includes(env.JIRA_EMAIL));
});

test('passed, flaky, skipped, expected failures and interrupted tests create no issues', async () => {
  const { reporter, calls } = setup([
    testCase('expected', 'passed'),
    testCase('flaky', 'passed'),
    testCase('skipped', 'skipped'),
    testCase('expected', 'failed'),
    testCase('unexpected', 'interrupted'),
    { ...testCase(), results: [] },
  ]);
  await reporter.onEnd();
  assert.equal(calls.length, 0);
});

test('timeouts are reported and issue type is configurable', async () => {
  const { reporter, calls } = setup([testCase('unexpected', 'timedOut')], undefined, {
    JIRA_ISSUE_TYPE: 'Task',
  });
  await reporter.onEnd();
  assert.equal(JSON.parse(calls[0][1].body).fields.issuetype.name, 'Task');
});

test('summaries respect the Jira length limit and raw errors are not sent', async () => {
  const failed = testCase();
  failed.titlePath = () => ['x'.repeat(500)];
  failed.results[1].error = { message: 'private-diagnostic-value' };
  const { reporter, calls } = setup([failed]);
  await reporter.onEnd();
  assert.equal(JSON.parse(calls[0][1].body).fields.summary.length, 255);
  assert.ok(!calls[0][1].body.includes('private-diagnostic-value'));
});

test('HTTP failures, network errors, and malformed responses fail the run', async () => {
  for (const response of [
    { ok: false },
    new Error('network error'),
    { ok: true, json: async () => ({}) },
    { ok: true, json: async () => { throw new Error('invalid JSON'); } },
  ]) {
    const { reporter } = setup([testCase()], response);
    assert.deepEqual(await reporter.onEnd(), { status: 'failed' });
  }
});

test('a reporting failure does not prevent attempts for other failed tests', async () => {
  const { reporter, calls } = setup([testCase(), testCase()], { ok: false });
  assert.deepEqual(await reporter.onEnd(), { status: 'failed' });
  assert.equal(calls.length, 2);
});
