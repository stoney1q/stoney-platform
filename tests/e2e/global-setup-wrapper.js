/* eslint-disable */
const { execSync } = require('child_process');

module.exports = async function () {
  execSync(
    'npx tsx --eval "import setup from \'./tests/e2e/global-setup.ts\'; setup({})"',
    { stdio: 'inherit' }
  );
};
