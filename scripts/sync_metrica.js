'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { publicHtml } = require('./sync_site_icons');
const C = require('../assets/js/analytics-core');
const begin = '<!-- analytics:consent:start -->';
const end = '<!-- analytics:consent:end -->';
function allowed(file, html) {
  const route = '/' + file.replace(/\\/g, '/').replace(/index\.html$/, '');
  return C.publicPath(route) && !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}
function normalize(html, file, root = process.cwd()) {
  const clean = html.replace(/<!-- analytics:consent:start -->[\s\S]*?<!-- analytics:consent:end -->/g, '');
  if (!allowed(file, clean) || !/<\/head\s*>/i.test(clean)) return clean;
  const assets = ['assets/css/analytics.css', 'assets/js/analytics-core.js', 'assets/js/analytics.js'];
  const tags = assets.map(asset => {
    const hash = createHash('sha256').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0, 12);
    return asset.endsWith('.css') ? `<link rel="stylesheet" href="/${asset}?v=${hash}"/>` : `<script defer src="/${asset}?v=${hash}"></script>`;
  }).join('');
  const block = begin + tags + end;
  if (html.includes(begin)) {
    let retained = false;
    return html.replace(/<!-- analytics:consent:start -->[\s\S]*?<!-- analytics:consent:end -->/g, () => { if (retained) return ''; retained = true; return block; });
  }
  return clean.replace(/<\/head\s*>/i, block + '</head>');
}
function sync(root = process.cwd()) {
  let changed = 0, enabled = 0;
  for (const file of publicHtml(root)) {
    const full = path.join(root, file), html = fs.readFileSync(full, 'utf8');
    const updated = normalize(html, file, root);
    if (updated.includes(begin)) enabled++;
    if (updated !== html) { fs.writeFileSync(full, updated); changed++; }
  }
  console.log(`Consent-gated Metrica synchronized: ${enabled} public pages, ${changed} changed`);
}
if (require.main === module) sync();
module.exports = { normalize, allowed, sync };
