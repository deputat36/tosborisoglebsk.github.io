const { spawnSync } = require('child_process');

const checks = [
  ['CSV parser', 'scripts/test_csv_parser.js'],
  ['CSV schema', 'scripts/test_csv_schema.js'],
  ['Date checks', 'scripts/test_date_checks.js'],
  ['Path checks', 'scripts/test_path_checks.js'],
  ['Status sets', 'scripts/test_status_sets.js'],
  ['Autonomous improvement plan', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue', 'scripts/audit_user_decision_queue.js'],
  ['Manual tasks', 'scripts/audit_github_manual_tasks.js']
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
