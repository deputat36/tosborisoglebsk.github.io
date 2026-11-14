'use strict';

// Every supported format is rendered from the same approved people-and-oak mark.
// Keep these URLs stable so crawlers can refresh their cached icons in place.
const ICON_LINKS = '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48 64x64" type="image/x-icon"/>' +
  '<link rel="icon" href="/favicon.png" sizes="192x192" type="image/png"/>' +
  '<link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml"/>' +
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"/>';

function normalizeSiteIcons(html) {
  if (!/<head\b/i.test(html) || !/<\/head\s*>/i.test(html)) return html;
  return html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i, (_, open, head, close) => {
    const current = (head.match(/<link\b[^>]*>/gi) || []).filter(tag => {
      const rel = (tag.match(/\brel\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      return /^(?:icon|shortcut\s+icon|apple-touch-icon(?:-precomposed)?)$/i.test(rel.trim());
    }).join('');
    if (current === ICON_LINKS) return open + head + close;
    const cleaned = head.replace(/<link\b[^>]*>/gi, tag => {
      const rel = (tag.match(/\brel\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      return /^(?:icon|shortcut\s+icon|apple-touch-icon(?:-precomposed)?)$/i.test(rel.trim()) ? '' : tag;
    });
    return open + cleaned.replace(/^[ \t]+$/gm, '') + ICON_LINKS + close;
  });
}

module.exports = { ICON_LINKS, normalizeSiteIcons };
