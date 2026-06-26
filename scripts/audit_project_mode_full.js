const { runChecks } = require('./lib/run_checks');

const checks = [
  ['CSV parser self-test', 'scripts/test_csv_parser.js'],
  ['CSV schema self-test', 'scripts/test_csv_schema.js'],
  ['Date checks self-test', 'scripts/test_date_checks.js'],
  ['ID checks self-test', 'scripts/test_id_checks.js'],
  ['Path checks self-test', 'scripts/test_path_checks.js'],
  ['Status sets self-test', 'scripts/test_status_sets.js'],
  ['TOS integrity audit', 'scripts/audit_tos_integrity.js'],
  ['Projects integrity audit', 'scripts/audit_projects_integrity.js'],
  ['Needs integrity audit', 'scripts/audit_needs_integrity.js'],
  ['Done integrity audit', 'scripts/audit_done_integrity.js'],
  ['Publication queue audit', 'scripts/audit_publication_queue.js'],
  ['Media intake register audit', 'scripts/audit_media_intake_register.js'],
  ['Autonomous improvement plan audit', 'scripts/audit_autonomous_improvement_plan.js'],
  ['User decision queue audit', 'scripts/audit_user_decision_queue.js'],
  ['Manual tasks audit', 'scripts/audit_github_manual_tasks.js'],
  ['Request source tables audit', 'scripts/audit_request_sources.js'],
  ['Request source imports self-test', 'scripts/test_request_sources_import.js'],
  ['Request source status values self-test', 'scripts/test_request_source_status_values.js'],
  ['Verification source tables audit', 'scripts/audit_verification_sources.js'],
  ['Outreach register audit', 'scripts/audit_outreach_register.js'],
  ['Outreach source index self-test', 'scripts/test_outreach_source_index.js'],
  ['Site health audit', 'scripts/audit_site_health.js'],
  ['Page index audit', 'scripts/audit_page_index.js'],
  ['Sitemap audit', 'scripts/audit_sitemap.js'],
  ['News data audit', 'scripts/audit_news_data.js'],
  ['RSS feed audit', 'scripts/audit_rss.js'],
  ['Run checks helper self-test', 'scripts/test_run_checks.js']
];

runChecks(checks, {
  verbose: true,
  successMessage: 'Project mode full audit OK'
});