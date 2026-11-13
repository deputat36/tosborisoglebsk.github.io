// One publication transaction: all derived visitor surfaces use the same news archive.
// GitHub Actions commits the result only after every required check succeeds.
const {execFileSync} = require('node:child_process');
const commands = [
  ['migrate_content_origins.js'], ['generate_content_origin_report.js'],
  ['generate_news_pages.js'], ['generate_material_pages.js'], ['generate_tos_pages.js'],
  ['cleanup_generated_collection_pages.js'], ['generate_collection_fallbacks.js'],
  ['generate_resident_area.js'], ['generate_public_experience.js'], ['generate_rss.js'],
  ['audit_runtime_cache_coherence.js','--write'], ['generate_page_index.js'], ['generate_sitemap.js'],
  ['audit_content_origins.js'], ['audit_news_data.js'], ['audit_news_page_content.js'], ['audit_news_detail_pages_content.js'], ['audit_generated_page_cleanup.js'], ['audit_site_links.js'], ['audit_seo.js'],
  ['audit_runtime_cache_coherence.js'], ['test_resident_area.js']
];
for (const command of commands) execFileSync(process.execPath,['scripts/'+command[0],...command.slice(1)],{stdio:'inherit'});
