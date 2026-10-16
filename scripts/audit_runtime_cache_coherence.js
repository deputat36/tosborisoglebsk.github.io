const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

// Avoid combining new HTML with an older cached module after deployment.
const pages = ['grants/index.html', 'update-tos/index.html', ...['kit','problem','support','passport','budget','schedule','partner-letter','checklist','photo-report','final-report'].map(form => `documents/templates/project-${form}/index.html`)];
const write = process.argv.includes('--write');
const errors = [];
let assets = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const updated = html.replace(/(<script\b[^>]*\bsrc=")(\/assets\/js\/[^"?]+\.js)(?:\?[^"\s]*)?("[^>]*>)/g, (match, open, asset, close) => {
    const file = path.join(process.cwd(), asset);
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    const expected = `${open}${asset}?v=${hash}${close}`;
    assets++;
    if (match !== expected) errors.push(`${page}: refresh ${asset}`);
    return expected;
  });
  if (write && updated !== html) fs.writeFileSync(page, updated);
}
if (errors.length && !write) {
  console.error(errors.join('\n') + '\nRun: node scripts/audit_runtime_cache_coherence.js --write');
  process.exitCode = 1;
} else {
  console.log(`Runtime cache coherence ${write ? 'updated' : 'OK'}: ${pages.length} pages, ${assets} script references`);
}
