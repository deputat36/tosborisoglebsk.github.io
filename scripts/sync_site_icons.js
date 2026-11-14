'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { normalizeSiteIcons } = require('./lib/site_icons');
const excluded = new Set(['.git', '.github', '.artifacts', '.openai', 'node_modules', 'scripts', 'docs', 'admin']);

function publicHtml(root = process.cwd(), dir = '') {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : publicHtml(root, relative);
    return entry.name.endsWith('.html') ? [relative] : [];
  });
}

function syncSiteIcons(root = process.cwd()) {
  let changed = 0;
  for (const file of publicHtml(root)) {
    const absolute = path.join(root, file);
    const original = fs.readFileSync(absolute, 'utf8');
    const updated = normalizeSiteIcons(original);
    if (updated !== original) { fs.writeFileSync(absolute, updated); changed++; }
  }
  console.log(`Site icons synchronized: ${changed} pages`);
  return changed;
}

if (require.main === module) syncSiteIcons();
module.exports = { publicHtml, syncSiteIcons };
