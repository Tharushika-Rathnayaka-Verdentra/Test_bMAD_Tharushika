# OrangeHRM automation — BMAD, Playwright, and Jira

Read-only authentication checks for the [OrangeHRM demo](https://opensource-demo.orangehrmlive.com/web/index.php/auth/login).
BMAD guides requirements and test design, Playwright executes the tests, and an optional reporter creates Jira Cloud defects.

## Quick start

Requires Node.js 22+ (Node.js 24 LTS recommended) and npm.

```bash
npm ci
npx playwright install chromium
cp .env.example .env
npm run test:unit
npm test
```

On Linux CI, use `npx playwright install --with-deps chromium` to install browser system dependencies as well.
The configuration loads `.env` using Node's built-in loader; existing environment variables take precedence.
The default credentials are the **public demo credentials** displayed on OrangeHRM's login page, not private account secrets.
Override `ORANGEHRM_BASE_URL`, `ORANGEHRM_USERNAME`, and `ORANGEHRM_PASSWORD` for another authorized test instance.

### Coverage

| Requirement | Check |
| --- | --- |
| AUTH-001 | Valid login displays the dashboard |
| AUTH-002 | Invalid credentials are rejected |
| AUTH-003 | Both empty fields display required validation |
| AUTH-004 | Logout blocks subsequent dashboard access |

Each test has a fresh browser context. Tests run sequentially to limit load on the shared demo, with two retries in CI.
No employee records or shared settings are modified. Demo availability or changed demo credentials can cause failures.

```bash
npm test -- --grep AUTH-003  # One acceptance criterion
npm run test:headed          # Visible browser
npm run test:ui              # Interactive runner
npm run report              # Local HTML results
```

Failure screenshots and traces are kept locally in ignored Playwright output directories.
They can contain account/session data: restrict access and do not upload them to public issues.

## BMAD workflow

```bash
npm run bmad:init
```

This invokes the pinned official `bmad-method@6.12.4` installer. Select this project directory,
the **BMad Method (`bmm`)** module, and your supported AI assistant in the interactive prompts.
Review generated assistant files before committing; the local `_bmad/` installation and `_bmad-output/` are ignored.
Then invoke **`bmad-help` in your AI assistant**, not in a shell, to discover the installed workflows.
BMAD is a design/workflow tool; it does not replace the Playwright runner.

Use the checked-in `bmad/orangehrm.yaml` as project context for the analyst, PM, architect, and developer workflows:

1. Review the scope and acceptance criteria; expand them into BMAD requirements/stories as needed.
2. Plan or refine tests while preserving the `AUTH-*` IDs in test titles for traceability.
3. Implement and review the scenarios, then run `npm run test:unit` and `npm test`.
4. Triage Jira defects against the corresponding acceptance ID and update stories in your Jira project.

The YAML is a project-specific planning artifact, **not** a BMAD installer schema.
BMAD's optional TEA test-architecture extension is not required for this suite.
See the [official BMAD installation guide](https://docs.bmad-method.org/how-to/install-bmad/).

## Jira Cloud integration (opt-in)

Leave `JIRA_ENABLED=false` for local runs without Jira. To enable actual issue creation, set these in `.env`
or a CI secret store:

```dotenv
JIRA_ENABLED=true
JIRA_BASE_URL=https://your-team.atlassian.net
JIRA_EMAIL=automation@example.com
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=HRM
JIRA_ISSUE_TYPE=Bug
```

Supply a Jira Cloud API token with permission to create issues in that project. Never commit it.
Use an HTTPS site origin without a path. This reporter uses the Jira Cloud REST v3 API with Basic authentication;
Jira Server/Data Center and OAuth/scoped-token gateway URLs are not supported.
If your Jira project requires additional mandatory fields, adapt the payload before enabling reporting.

After Playwright finishes, the reporter creates **one new issue per final unexpected failed/timed-out test**,
including its acceptance ID, project/browser title, relative source location, and final status.
Passing retries, expected failures, skipped tests, and interrupted tests do not create issues.
Separate runs create separate issues: there is no cross-run deduplication or automatic issue closing.
The reporter does not create Jira stories or publish passing results as test executions.

Only test titles and source metadata are sent—never raw error messages, credentials, screenshots, or traces.
Keep secrets out of test names and filenames. Reporting has a 10-second timeout per request and disallows redirects.
Missing required configuration fails immediately; API/network failures print a sanitized message and fail the run.
There are no automatic POST retries that could create duplicate defects.

`npm run test:unit` exercises the reporter with mocked HTTP responses; it never creates real Jira issues.
To verify a real integration, use an authorized sandbox Jira project and a known failed test run,
then verify the issue's acceptance ID and clean up the sandbox defect manually.