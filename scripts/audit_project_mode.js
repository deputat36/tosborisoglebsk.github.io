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
  ['Request source tables', 'scripts/audit_request_sources.js'],
  ['Request source imports', 'scripts/test_request_sources_import.js'],
  ['Request source status values', 'scripts/test_request_source_status_values.js'],
  ['Verification source tables', 'scripts/audit_verification_sources.js'],
  ['Outreach register', 'scripts/audit_outreach_register.js'],
  ['Outreach source index', 'scripts/test_outreach_source_index.js'],
  ['Site health', 'scripts/audit_site_health.js'],
  ['Page index', 'scripts/audit_page_index.js'],
  ['Sitemap', 'scripts/audit_sitemap.js'],
  ['News data', 'scripts/audit_news_data.js'],
  ['RSS', 'scripts/audit_rss.js'],
  ['Run checks helper', 'scripts/test_run_checks.js']
];

runChecks(checks, {
  successMessage: 'Project mode audits OK'
});
