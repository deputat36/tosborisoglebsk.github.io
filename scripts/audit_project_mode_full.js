const { spawnSync } = require('child_process');

const checks = [
  ['CSV parser self-test', 'scripts/test_csv_parser.js'],
  ['CSV schema self-test', 'scripts/test_csv_schema.js'],
  ['Path checks self-test', 'scripts/test_path_checks.js'],
  ['Status sets self-test', 'scripts/test_status_sets.js'],
  ['Autonomous improvement plan audit', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue audit', 'scripts/audit_user_decision_queue.js'],
  ['Manual tasks audit', 'scripts/audit_github_manual_tasks.js']
];

let failed = false;

checks.forEach(([label, script]) => {
  console.log(`\n--- ${label} ---`);

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

console.log('\nProject mode full audit OK');
