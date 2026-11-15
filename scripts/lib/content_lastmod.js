'use strict';
const { createHash } = require('node:crypto');
const { decodeHtmlText } = require('./html_text');
function signature(html) {
  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || '';
  const clean = main.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const text = decodeHtmlText(clean.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const references = [...clean.matchAll(/<(?:a|img)\b[^>]*>/gi)].map(match => {
    return [...match[0].matchAll(/\b(href|src|alt)=["']([^"']*)["']/gi)].map(x => [x[1].toLowerCase(), decodeHtmlText(x[2])]);
  });
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const metadata = (html.match(/<meta\b[^>]*(?:name=["']description["']|property=["']og:(?:title|description|image)["'])[^>]*>/gi) || []).map(x => x.replace(/\s+/g, ' '));
  const schema = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1].trim());
  return createHash('sha256').update(JSON.stringify({ title, metadata, text, references, schema })).digest('hex');
}
function entry(html, previous, fallbackDate, today) {
  const digest = signature(html);
  if (previous && previous.digest === digest && /^\d{4}-\d{2}-\d{2}$/.test(previous.lastmod)) return { digest, lastmod: previous.lastmod };
  return { digest, lastmod: previous ? today : fallbackDate };
}
module.exports = { signature, entry };
