#!/usr/bin/env node
const path = require('path');
const { runSmoke } = require('./lib/public_deployment_smoke');

(async () => {
  const root = path.resolve(__dirname, '..');
  const report = await runSmoke({ root });

  console.log(`Public deployment smoke: ${report.success ? 'PASS' : 'FAIL'}`);
  for (const item of report.final_results) {
    const status = item.ok ? 'PASS' : item.required ? 'FAIL' : 'WARN';
    const match = item.content_matches_repository === null
      ? ''
      : `, repository_match=${item.content_matches_repository}`;
    console.log(`${status} ${item.id}: HTTP ${item.status ?? '-'}${match}, final=${item.final_url || '-'}`);
    for (const error of item.errors) console.log(`  - ${error}`);
  }

  if (!report.success) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
