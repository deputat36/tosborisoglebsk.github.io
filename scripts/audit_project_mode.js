const { spawnSync } = require('child_process');

const checks = [
  ['Autonomous improvement plan', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue', 'scripts/audit_user_decision_queue.js']
];

let failed = false;

checks.forEach(([label, script]) => {
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

console.log('Project mode audits OK');
