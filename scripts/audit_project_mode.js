const { runChecks } = require('./lib/run_checks');

const checks = [
  ['CSV parser', 'scripts/test_csv_parser.js'],
  ['CSV schema', 'scripts/test_csv_schema.js'],
  ['Date checks', 'scripts/test_date_checks.js'],
  ['ID checks', 'scripts/test_id_checks.js'],
  ['Path checks', 'scripts/test_path_checks.js'],
  ['Status sets', 'scripts/test_status_sets.js'],
  ['Autonomous improvement plan', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue', 'scripts/audit_user_decision_queue.js'],
  ['Manual tasks', 'scripts/audit_github_manual_tasks.js'],
  ['Outreach register', 'scripts/audit_outreach_register.js']
];

runChecks(checks, {
  successMessage: 'Project mode audits OK'
});
