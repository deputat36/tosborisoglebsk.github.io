const { runChecks } = require('./lib/run_checks');

runChecks([
  ['data quality page', 'scripts/audit_data_quality_content.js'],
  ['media guide page', 'scripts/audit_media_guide_content.js'],
  ['places page', 'scripts/audit_places_content.js'],
  ['map page', 'scripts/audit_map_content.js'],
  ['rss feed content', 'scripts/audit_rss_feed_content.js'],
  ['required project ids', 'scripts/audit_projects_required_ids.js'],
  ['required done ids', 'scripts/audit_done_required_ids.js'],
  ['required catalog slugs', 'scripts/audit_required_slugs.js'],
  ['submit materials page', 'scripts/audit_submit_materials_content.js'],
  ['verification levels page', 'scripts/audit_verification_levels_content.js'],
  ['actions check page', 'scripts/audit_actions_check_content.js'],
  ['publication basis execution self-test', 'scripts/test_publication_basis_execution.js'],
  ['publication basis confirmation register', 'scripts/audit_publication_basis_confirmation_register.js'],
  ['publication basis review page', 'scripts/audit_publication_basis_review_page.js'],
  ['personal data decision packet self-test', 'scripts/test_personal_data_decision_packet.js'],
  ['personal data decision packet', 'scripts/audit_personal_data_decision_packet.js'],
  ['personal data decision page', 'scripts/audit_personal_data_decision_page.js']
], {
  verbose: true,
  successMessage: 'Manual audit extensions OK'
});
