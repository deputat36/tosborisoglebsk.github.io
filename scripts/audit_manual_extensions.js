const { runChecks } = require('./lib/run_checks');

runChecks([
  ['data quality page', 'scripts/audit_data_quality_content.js'],
  ['media guide page', 'scripts/audit_media_guide_content.js'],
  ['places page', 'scripts/audit_places_content.js'],
  ['map page', 'scripts/audit_map_content.js'],
  ['rss feed content', 'scripts/audit_rss_feed_content.js'],
  ['required project ids', 'scripts/audit_projects_required_ids.js'],
  ['required done ids', 'scripts/audit_done_required_ids.js'],
  ['required catalog slugs', 'scripts/audit_required_slugs.js']
], {
  verbose: true,
  successMessage: 'Manual audit extensions OK'
});
