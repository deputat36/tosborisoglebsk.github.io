const { spawnSync } = require('child_process');

function runChecks(checks, options = {}) {
  const verbose = Boolean(options.verbose);
  const successMessage = options.successMessage || 'Checks OK';
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 30000;
  let failed = false;

  checks.forEach(([label, script]) => {
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      timeout: timeoutMs,
      killSignal: 'SIGTERM'
    });
    const durationMs = Date.now() - startedAt;

    if (result.error) {
      const timeoutNote = result.error.code === 'ETIMEDOUT'
        ? `timed out after ${timeoutMs} ms`
        : `failed to start: ${result.error.message}`;
      console.error(`FAIL ${label}: ${timeoutNote}`);
      if (result.stdout) console.error(result.stdout.trim());
      if (result.stderr) console.error(result.stderr.trim());
      failed = true;
      return;
    }

    if (result.status !== 0) {
      console.error(`FAIL ${label}: status ${result.status}${result.signal ? `, signal ${result.signal}` : ''}`);
      if (result.stdout) console.error(result.stdout.trim());
      if (result.stderr) console.error(result.stderr.trim());
      failed = true;
      return;
    }

    if (verbose) console.log(`OK ${label} completed in ${durationMs} ms`);
  });

  if (failed) {
    process.exit(1);
  }

  console.log(successMessage);
}

module.exports = { runChecks };
