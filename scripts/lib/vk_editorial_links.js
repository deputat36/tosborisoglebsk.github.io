'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {tosSlugs} = require('../../assets/js/collection-browser-core');

function safeEditorialLinks(links) {
  return (Array.isArray(links) ? links : []).filter(link =>
    link && typeof link.label === 'string' && link.label.trim() &&
    /^\/(?:tos|news|done|projects|materials|grants)\/[a-z0-9-]+\/(?:#[a-z0-9-]+)?$/.test(link.href || '')
  ).map(link => ({href: link.href, label: link.label}));
}

function applyEditorialLinks(records, dataset) {
  const data = dataset || JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/vk_editorial_links.json'), 'utf8'));
  const links = new Map(data.entries.map(entry => [entry.id, entry]));
  return records.map(item => {
    const entry = links.get(item.id);
    if (!entry || item.imported_from !== 'vk') return item;
    const slugs = tosSlugs({tos_slug: item.tos_slug, tos_slugs: entry.tos_slugs});
    return {...item, tos_slug: item.tos_slug || slugs[0] || '', tos_slugs: slugs,
      editorial_links: safeEditorialLinks(entry.links), editorial_checked_at: data.checked_at,
      relation_note: entry.relation_note || ''};
  });
}

module.exports = {applyEditorialLinks, safeEditorialLinks};
