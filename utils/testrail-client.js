
class TestRailClient {
  constructor(env = process.env, fetchImpl = globalThis.fetch) {
    this.fetch = fetchImpl;

    for (const name of [
      'TESTRAIL_BASE_URL',
      'TESTRAIL_EMAIL',
      'TESTRAIL_API_KEY',
      'TESTRAIL_PROJECT_ID',
      'TESTRAIL_SUITE_ID',
    ]) {
      if (!env[name]?.trim()) {
        throw new Error(`${name} is required when TestRail is enabled`);
      }
    }

    const url = new URL(env.TESTRAIL_BASE_URL);

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw new Error('Invalid TESTRAIL_BASE_URL');
    }

    this.baseUrl = url.origin;
    this.projectId = Number(env.TESTRAIL_PROJECT_ID);
    this.suiteId = Number(env.TESTRAIL_SUITE_ID);

    if (
      !Number.isSafeInteger(this.projectId) ||
      this.projectId <= 0 ||
      !Number.isSafeInteger(this.suiteId) ||
      this.suiteId <= 0
    ) {
      throw new Error('Invalid TestRail project or suite ID');
    }

    this.authorization = `Basic ${Buffer.from(
      `${env.TESTRAIL_EMAIL}:${env.TESTRAIL_API_KEY}`
    ).toString('base64')}`;
  }

  async request(method, endpoint, payload) {
    const url = `${this.baseUrl}/index.php?/api/v2/${endpoint}`;

    const options = {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: this.authorization,
        Accept: 'application/json',
      },
    };

    if (payload !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(payload);
    }

    const response = await this.fetch(url, options);
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `TestRail API failed: HTTP ${response.status} (${method} ${endpoint})`
      );
    }

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error('TestRail returned an invalid JSON response');
    }
  }

  async getSuite() {
    return this.request('GET', `get_suite/${this.suiteId}`);
  }

  async getCasesPage(offset = 0) {
    return this.request(
      'GET',
      `get_cases/${this.projectId}&suite_id=${this.suiteId}&limit=250&offset=${offset}`
    );
  }

  async preflight(requiredCaseIds) {
    const suite = await this.getSuite();

    if (Number(suite.project_id) !== this.projectId) {
      throw new Error(
        `Suite ${this.suiteId} does not belong to project ${this.projectId}`
      );
    }

    const cases = [];
    let offset = 0;

    while (true) {
      const page = await this.getCasesPage(offset);
      const pageCases = page.cases || [];

      cases.push(...pageCases);

      if (!page._links?.next || pageCases.length === 0) {
        break;
      }

      offset += 250;
    }

    const caseMap = new Map(
      cases.map(testCase => [Number(testCase.id), testCase])
    );

    const missing = requiredCaseIds.filter(
      id => !caseMap.has(Number(id))
    );

    if (missing.length > 0) {
      throw new Error(
        `These TestRail cases were not found in Suite ${this.suiteId}: ` +
        missing.map(id => `C${id}`).join(', ')
      );
    }

    return {
      suite,
      cases: requiredCaseIds.map(id => caseMap.get(Number(id))),
    };
  }

  async createRun(caseIds, name) {
    const run = await this.request(
      'POST',
      `add_run/${this.projectId}`,
      {
        suite_id: this.suiteId,
        name,
        description: 'Automated execution using Playwright.',
        include_all: false,
        case_ids: caseIds,
      }
    );

    if (!Number.isSafeInteger(Number(run.id))) {
      throw new Error('TestRail did not return a valid test run ID');
    }

    // await this.request(
    //   'POST',
    //   `add_cases_to_run/${run.id}`,
    //   { case_ids: caseIds }
    // );

    return run;
  }

  async addResults(runId, results) {
    return this.request(
      'POST',
      `add_results_for_cases/${runId}`,
      { results }
    );
  }
}

module.exports = TestRailClient;
