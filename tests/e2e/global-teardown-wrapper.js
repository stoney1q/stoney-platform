/* eslint-disable */
const { execSync } = require('child_process');

module.exports = async function () {
  execSync(
    'npx tsx --eval "import teardown from \'./tests/e2e/global-teardown.ts\'; teardown()"',
    { stdio: 'inherit' }
  );
};
