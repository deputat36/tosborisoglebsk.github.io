'use strict';
const fs = require('node:fs');
const { publicHtml } = require('./sync_site_icons');
const { normalize, allowed } = require('./sync_metrica');
const errors = [];
let count = 0;
for (const file of publicHtml()) {
  const html = fs.readFileSync(file, 'utf8');
  if (normalize(html, file) !== html) errors.push(file + ': run scripts/sync_metrica.js');
  if (allowed(file, html)) count++;
  if (/<(?:script|img|link)\b[^>]*(?:src|href)=["']https?:\/\/(?:mc|mc\.webvisor)\.yandex\./i.test(html)) errors.push(file + ': direct tracker bypasses consent');
}
if (count < 1000) errors.push('Unexpected loss of public page coverage');
if (errors.length) throw Error(errors.join('\n'));
console.log(`Metrica page coverage OK: ${count} public pages; no direct tracker or noscript pixel`);
