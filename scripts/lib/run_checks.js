const { spawnSync } = require('child_process');

function runChecks(checks, options = {}) {
  const verbose = Boolean(options.verbose);
  const successMessage = options.successMessage || 'Checks OK';
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 30000;
  let failed = false;

  checks.forEach(([label, script]) => {
    if (verbose) console.log(`\n--- ${label} ---`);

    const startedAt = Date.now();
    const result = spawnSync(process.execPath, [script], {
      stdio: 'inherit',
      shell: false,
      timeout: timeoutMs,
      killSignal: 'SIGTERM'
    });
    const durationMs = Date.now() - startedAt;

    if (result.error) {
      const timeoutNote = result.error.code === 'ETIMEDOUT'
        ? ` timed out after ${timeoutMs} ms`
        : ` failed to start: ${result.error.message}`;
      console.error(`${label}${timeoutNote}`);
      failed = true;
      return;
    }

    if (result.status !== 0) {
      console.error(`${label} failed with status ${result.status}${result.signal ? `, signal ${result.signal}` : ''}`);
      failed = true;
      return;
    }

    if (verbose) console.log(`${label} completed in ${durationMs} ms`);
  });

  if (failed) {
    process.exit(1);
  }

  console.log(verbose ? `\n${successMessage}` : successMessage);
}

module.exports = { runChecks };
