
const { loadEnvFile } = require('node:process');
const TestRailClient = require('../utils/testrail-client');

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function main() {
  const client = new TestRailClient();

  const requiredCaseIds = [84, 85, 86, 87, 88, 89];

  console.log('Checking TestRail connection...');
  console.log(`Project ID: ${client.projectId}`);
  console.log(`Suite ID: ${client.suiteId}`);

  const result = await client.preflight(requiredCaseIds);

  console.log('\nTestRail preflight validation PASSED');
  console.log(`Suite: ${result.suite.name}`);
  console.log(`Project: ${result.suite.project_id}`);

  console.log('\nValidated test cases:');

  for (const testCase of result.cases) {
    console.log(`C${testCase.id} - ${testCase.title}`);
  }

  console.log('\nAll required cases are available in the configured suite.');
}

main().catch(error => {
  console.error('\nTestRail preflight validation FAILED');
  console.error(error.message);
  process.exitCode = 1;
});
