// One publication transaction: all derived visitor surfaces use the same news archive.
// GitHub Actions commits the result only after every required check succeeds.
const {execFileSync} = require('node:child_process');
const commands = [
  ['generate_tos_practices.js'], ['generate_done_pages.js'], ['generate_project_pages.js'],
  ['generate_need_pages.js'], ['generate_support_pages.js'],
  ['generate_publication_basis_inventory.js'], ['generate_publication_basis_review_queue.js'],
  ['generate_admin_surface_inventory.js'],
  ['migrate_content_origins.js'], ['generate_content_origin_report.js'],
  ['generate_news_pages.js'], ['generate_material_pages.js'], ['generate_tos_pages.js'],
  ['cleanup_generated_collection_pages.js'], ['generate_collection_fallbacks.js'],
  ['generate_resident_area.js'], ['generate_public_experience.js'], ['generate_rss.js'],
  ['audit_runtime_cache_coherence.js','--write'], ['generate_page_index.js'], ['generate_sitemap.js'],
  ['generate_accessibility_performance_report.js'], ['generate_site_health_report.js'], ['enrich_site_health_readiness.js'],
  ['generate_actions_check_page.js'], ['update_status_document_metrics.js'],
  ['validate_data.js'], ['audit_status_document.js'],
  ['audit_content_origins.js'], ['audit_news_data.js'], ['audit_news_page_content.js'], ['audit_news_detail_pages_content.js'], ['audit_generated_page_cleanup.js'], ['audit_site_links.js'], ['audit_seo.js'],
  ['audit_runtime_cache_coherence.js'], ['test_resident_area.js']
];
async function main() {
  for (const command of commands) execFileSync(process.execPath,['scripts/'+command[0],...command.slice(1)],{stdio:'inherit'});
  await require('./lib/current_build_http_audit').auditCurrentBuild();
  for (const file of ['enrich_site_health_technical_integrity.js','audit_site_health_technical_integrity.js','audit_publication_basis_inventory.js']) {
    execFileSync(process.execPath,['scripts/'+file],{stdio:'inherit'});
  }
}
main().catch(error => {console.error(error.message);process.exitCode = 1;});
