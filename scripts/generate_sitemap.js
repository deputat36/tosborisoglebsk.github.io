const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch (error) {
    return [];
  }
}

function isPublished(item) {
  return item && item.status !== 'draft';
}

function safeDate(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function addUrl(map, loc, lastmod = '') {
  if (!loc) return;
  const normalized = loc.startsWith('http') ? loc : `${SITE_URL}${loc}`;
  map.set(normalized, lastmod || map.get(normalized) || '');
}

function main() {
  const urls = new Map();
  const today = new Date().toISOString().slice(0, 10);

  [
    '/',
    '/tos/',
    '/residents/',
    '/partners/',
    '/projects/',
    '/done/',
    '/needs/',
    '/documents/',
    '/documents/templates/meeting-agenda/',
    '/documents/templates/meeting-registration/',
    '/documents/templates/meeting-protocol/',
    '/contacts/',
    '/sections/',
    '/faq/',
    '/news/',
    '/grants/',
    '/calendar/',
    '/materials/',
    '/legal/',
    '/create-tos/',
    '/chairperson/',
    '/chairperson/first-30-days/',
    '/chairperson/meeting/',
    '/chairperson/project/',
    '/chairperson/news/',
    '/chairperson/documents/',
    '/chairperson/conflicts/',
    '/update-tos/',
    '/map/',
    '/editorial-policy/',
    '/audit/',
    '/search/'
  ].forEach((url) => addUrl(urls, url, today));

  readJson('data/toses.json')
    .filter((item) => item.slug && isPublished(item))
    .forEach((item) => addUrl(urls, `/tos/${item.slug}/`, safeDate(item.updated_at) || today));

  readJson('data/news.json')
    .filter((item) => item.id && isPublished(item))
    .forEach((item) => addUrl(urls, `/news/${item.id}/`, safeDate(item.date) || today));

  readJson('data/done.json')
    .filter((item) => item.id && isPublished(item))
    .forEach((item) => addUrl(urls, `/done/${item.id}/`, safeDate(item.date) || today));

  readJson('data/needs.json')
    .filter((item) => item.id && isPublished(item))
    .forEach((item) => addUrl(urls, `/needs/${item.id}/`, safeDate(item.date) || today));

  readJson('data/articles.json')
    .filter((item) => item.id && isPublished(item))
    .forEach((item) => addUrl(urls, `/materials/${item.id}/`, safeDate(item.date) || today));

  readJson('data/projects.json')
    .filter((item) => item.id && isPublished(item))
    .forEach((item) => addUrl(urls, `/projects/${item.id}/`, today));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.entries()].map(([loc, lastmod]) => `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log(`Generated sitemap URLs: ${urls.size}`);
}

main();
