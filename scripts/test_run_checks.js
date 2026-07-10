const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-run-checks-'));
const successScript = path.join(tempDir, 'success.js');
const runnerScript = path.join(tempDir, 'runner.js');
const helperPath = path.resolve('scripts/lib/run_checks.js');

try {
  fs.writeFileSync(successScript, "console.log('fixture success');\n", 'utf8');
  fs.writeFileSync(
    runnerScript,
    `const { runChecks } = require(${JSON.stringify(helperPath)});\n`
      + `runChecks([['Fixture check', ${JSON.stringify(successScript)}]], {\n`
      + `  verbose: true,\n`
      + `  timeoutMs: 5000,\n`
      + `  successMessage: 'Fixture checks OK'\n`
      + `});\n`,
    'utf8'
  );

  const success = spawnSync(process.execPath, [runnerScript], {
    encoding: 'utf8',
    shell: false,
    timeout: 10000
  });

  assert(!success.error, `fixture runner must start: ${success.error?.message || ''}`);
  assert(success.status === 0, `fixture runner must pass: ${success.stderr || success.stdout}`);
  assert(success.stdout.includes('Fixture check completed'), 'verbose output must include completed check label');
  assert(success.stdout.includes('Fixture checks OK'), 'success output must include configured message');

  const importCheck = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(helperPath)});`], {
    encoding: 'utf8',
    shell: false,
    timeout: 5000
  });

  assert(!importCheck.error, `run_checks import must start: ${importCheck.error?.message || ''}`);
  assert(importCheck.status === 0, 'run_checks module must be import-safe');

  console.log('Run checks tests OK');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
