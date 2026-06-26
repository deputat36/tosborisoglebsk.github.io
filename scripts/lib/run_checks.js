const { spawnSync } = require('child_process');

function runChecks(checks, options = {}) {
  const verbose = Boolean(options.verbose);
  const successMessage = options.successMessage || 'Checks OK';
  let failed = false;

  checks.forEach(([label, script]) => {
    if (verbose) console.log(`\n--- ${label} ---`);

    const result = spawnSync(process.execPath, [script], {
      stdio: 'inherit',
      shell: false
    });

    if (result.status !== 0) {
      console.error(`${label} failed`);
      failed = true;
    }
  });

  if (failed) {
    process.exit(1);
  }

  console.log(verbose ? `\n${successMessage}` : successMessage);
}

module.exports = { runChecks };
