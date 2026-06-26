const { runChecks } = require('./lib/run_checks');

const checks = [
  ['CSV parser self-test', 'scripts/test_csv_parser.js'],
  ['CSV schema self-test', 'scripts/test_csv_schema.js'],
  ['Date checks self-test', 'scripts/test_date_checks.js'],
  ['Path checks self-test', 'scripts/test_path_checks.js'],
  ['Status sets self-test', 'scripts/test_status_sets.js'],
  ['Autonomous improvement plan audit', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue audit', 'scripts/audit_user_decision_queue.js'],
  ['Manual tasks audit', 'scripts/audit_github_manual_tasks.js'],
  ['Run checks helper self-test', 'scripts/test_run_checks.js']
];

runChecks(checks, {
  verbose: true,
  successMessage: 'Project mode full audit OK'
});
