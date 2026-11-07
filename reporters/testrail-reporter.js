
const TestRailClient = require('../utils/testrail-client');

function formatElapsed(milliseconds = 0) {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  return `${seconds}s`;
}

class TestRailReporter {
  constructor() {
    this.enabled = process.env.TESTRAIL_ENABLED === 'true';

    if (this.enabled) {
      this.client = new TestRailClient();
    }
  }

  onBegin(config, suite) {
    this.suite = suite;
  }

  async onEnd() {
    if (!this.enabled) return;

    const mappedResults = new Map();

    for (const test of this.suite.allTests()) {
      const match = test.title.match(/\bC(\d+)\b/i);

      // Ignore tests without a TestRail case ID.
      if (!match) continue;

      const caseId = Number(match[1]);
      const result = test.results.at(-1);

      let statusId;

      if (result?.status === 'passed') {
        statusId = 1;
      } else if (
        result?.status === 'failed' ||
        result?.status === 'timedOut'
      ) {
        statusId = 5;
      } else {
        // Skipped or interrupted.
        statusId = 2;
      }

      if (mappedResults.has(caseId)) {
        throw new Error(
          `Duplicate TestRail case mapping detected: C${caseId}`
        );
      }

      const comment = [
        `Playwright test: ${test.title}`,
        `Execution status: ${result?.status || 'unknown'}`,
        result?.error?.message
          ? `Error: ${result.error.message}`
          : '',
      ].filter(Boolean).join('\n');

      mappedResults.set(caseId, {
        case_id: caseId,
        status_id: statusId,
        elapsed: formatElapsed(result?.duration),
        comment,
      });
    }

    if (mappedResults.size === 0) {
      console.log('No TestRail-mapped tests found. Nothing to upload.');
      return;
    }

    const caseIds = [...mappedResults.keys()];
    const results = [...mappedResults.values()];


try {
  // Validate the TestRail cases.
  await this.client.preflight(caseIds);

  const runName = `Playwright Automation - ${new Date().toISOString()}`;

  console.log('Creating TestRail run...');

  const run = await this.client.createRun(caseIds, runName);

  console.log(`TestRail run created: ${run.id}`);
  console.log(`Uploading ${results.length} results...`);

  await this.client.addResults(run.id, results);

  console.log('TestRail results uploaded successfully.');
  console.log(
    `Run URL: ${this.client.baseUrl}/index.php?/runs/view/${run.id}`
  );

} catch (error) {
  console.error('TestRail reporting failed:', error.message);
  throw error;
}

  }
}

module.exports = TestRailReporter;
