const fs = require('fs');
const path = require('path');

const runnerPath = path.join(process.cwd(), 'scripts', 'audit_manual_extensions.js');
const expectedScripts = [
  'scripts/audit_data_quality_content.js',
  'scripts/audit_media_guide_content.js',
  'scripts/audit_places_content.js',
  'scripts/audit_map_content.js',
  'scripts/audit_rss_feed_content.js',
  'scripts/audit_projects_required_ids.js',
  'scripts/audit_done_required_ids.js',
  'scripts/audit_required_slugs.js'
];

function main() {
  const errors = [];

  if (!fs.existsSync(runnerPath)) {
    throw new Error(`Missing file: ${runnerPath}`);
  }

  const content = fs.readFileSync(runnerPath, 'utf8');

  expectedScripts.forEach((script) => {
    if (!content.includes(script)) errors.push(`missing manual runner target ${script}`);
    if (!fs.existsSync(path.join(process.cwd(), script))) errors.push(`missing script file ${script}`);
  });

  if (!content.includes("successMessage: 'Manual audit extensions OK'")) {
    errors.push('manual runner success message is missing');
  }

  if (errors.length) {
    throw new Error(`Manual extensions runner test failed:\n${errors.join('\n')}`);
  }

  console.log(`Manual extensions runner test OK: ${expectedScripts.length} scripts`);
}

main();
