const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const errors = [];
const warnings = [];
const pageSnapshots = [];

const SKIP_FILES = new Set([
  '404.html',
  'news/view.html',
  'tos/view.html',
  'tools/import.html',
  'admin/index.html',
  'admin/admin-index-ready.html',
  'audit/index.html',
  'tos/chkalovets/index.html',
  'documents/demo/charter.html',
  'documents/demo/report.html',
  'materials/activity.html',
  'materials/competitions.html',
  'materials/engage.html',
  'materials/how-to-create-tos.html',
  'materials/partners.html',
  'materials/projects.html',
  'materials/social-media.html'
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function shouldSkipFile(file) {
  return SKIP_FILES.has(rel(file));
}

function urlForFile(file) {
  const r = rel(file);
  if (r === 'index.html') return `${SITE_URL}/`;
  if (r.endsWith('/index.html')) return `${SITE_URL}/${r.replace(/index\.html$/, '')}`;
  return `${SITE_URL}/${r}`;
}

function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reName = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  const reProp = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
  return (html.match(reName) || html.match(reProp) || [])[1] || '';
}

function getTitle(html) {
  return (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
}

function getCanonical(html) {
  return (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] || '';
}

function isNoindexPage(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function isInstantRedirectPage(html) {
  return /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']0\s*;/i.test(html);
}

function normalizeForDuplicateCheck(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function auditPage(file, sitemapUrls) {
  const html = fs.readFileSync(file, 'utf8');

  // Noindex and technical redirect pages are deliberately excluded from strict SEO checks.
  // They should not be present in sitemap and may not contain full Open Graph markup.
  if (isNoindexPage(html) || isInstantRedirectPage(html)) return;

  const title = getTitle(html).trim();
  const description = getMeta(html, 'description').trim();
  const canonical = getCanonical(html).trim();
  const ogTitle = getMeta(html, 'og:title').trim();
  const ogDescription = getMeta(html, 'og:description').trim();
  const ogImage = getMeta(html, 'og:image').trim();
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const relative = rel(file);

  pageSnapshots.push({
    file: relative,
    title,
    description,
    canonical: canonical || urlForFile(file)
  });

  if (!title) errors.push(`${relative}: нет title`);
  else if (title.length < 18) warnings.push(`${relative}: title слишком короткий (${title.length})`);
  else if (title.length > 90) warnings.push(`${relative}: title слишком длинный (${title.length})`);

  if (!description) errors.push(`${relative}: нет meta description`);
  else if (description.length < 70) warnings.push(`${relative}: description короткий (${description.length})`);
  else if (description.length > 220) warnings.push(`${relative}: description длинный (${description.length})`);

  if (!canonical) errors.push(`${relative}: нет canonical`);
  else if (!canonical.startsWith(SITE_URL)) errors.push(`${relative}: canonical не на основном домене — ${canonical}`);

  if (!ogTitle) warnings.push(`${relative}: нет og:title`);
  if (!ogDescription) warnings.push(`${relative}: нет og:description`);
  if (!ogImage) warnings.push(`${relative}: нет og:image`);
  if (h1Count !== 1) warnings.push(`${relative}: количество h1 = ${h1Count}`);

  if (sitemapUrls.size && canonical && canonical.startsWith(SITE_URL) && !sitemapUrls.has(canonical)) {
    warnings.push(`${relative}: canonical не найден в sitemap — ${canonical}`);
  }
}

function recordDuplicates(field, label, target) {
  const map = new Map();
  for (const page of pageSnapshots) {
    const value = normalizeForDuplicateCheck(page[field]);
    if (!value) continue;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(page.file);
  }

  for (const [value, files] of map.entries()) {
    if (files.length < 2) continue;
    const sample = files.slice(0, 5).join(', ');
    target.push(`дублируется ${label} (${files.length} стр.): ${sample}${files.length > 5 ? '...' : ''} — «${value}»`);
  }
}

function readSitemapUrls() {
  const file = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(file)) return new Set();
  const xml = fs.readFileSync(file, 'utf8');
  return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
}

function main() {
  const sitemapUrls = readSitemapUrls();
  const files = walk(ROOT)
    .filter((file) => file.endsWith('.html'))
    .filter((file) => !shouldSkipFile(file));

  files.forEach((file) => auditPage(file, sitemapUrls));
  recordDuplicates('title', 'title', errors);
  recordDuplicates('description', 'description', errors);

  if (warnings.length) {
    console.warn('Предупреждения SEO-аудита:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('Ошибки SEO-аудита:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`SEO-аудит пройден. Проверено страниц: ${pageSnapshots.length}`);
}

main();
