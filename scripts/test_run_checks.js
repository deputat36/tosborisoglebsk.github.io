const { spawnSync } = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const success = spawnSync(process.execPath, ['scripts/audit_project_mode.js'], {
  encoding: 'utf8',
  shell: false
});

assert(success.status === 0, 'audit_project_mode.js must pass');
assert(success.stdout.includes('Project mode audits OK'), 'success output must mention project mode audits');

const failure = spawnSync(process.execPath, ['scripts/lib/run_checks.js'], {
  encoding: 'utf8',
  shell: false
});

assert(failure.status === 0, 'run_checks module must be import-safe');

console.log('Run checks tests OK');
