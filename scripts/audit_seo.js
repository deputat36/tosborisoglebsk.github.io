const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const errors = [];
const warnings = [];

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

function auditPage(file, sitemapUrls) {
  const html = fs.readFileSync(file, 'utf8');
  const fileUrl = urlForFile(file);
  const title = getTitle(html).trim();
  const description = getMeta(html, 'description').trim();
  const canonical = getCanonical(html).trim();
  const ogTitle = getMeta(html, 'og:title').trim();
  const ogDescription = getMeta(html, 'og:description').trim();
  const ogImage = getMeta(html, 'og:image').trim();
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  if (!title) errors.push(`${rel(file)}: нет title`);
  else if (title.length < 18) warnings.push(`${rel(file)}: title слишком короткий (${title.length})`);
  else if (title.length > 90) warnings.push(`${rel(file)}: title слишком длинный (${title.length})`);

  if (!description) errors.push(`${rel(file)}: нет meta description`);
  else if (description.length < 70) warnings.push(`${rel(file)}: description короткий (${description.length})`);
  else if (description.length > 220) warnings.push(`${rel(file)}: description длинный (${description.length})`);

  if (!canonical) errors.push(`${rel(file)}: нет canonical`);
  else if (!canonical.startsWith(SITE_URL)) errors.push(`${rel(file)}: canonical не на основном домене — ${canonical}`);

  if (!ogTitle) warnings.push(`${rel(file)}: нет og:title`);
  if (!ogDescription) warnings.push(`${rel(file)}: нет og:description`);
  if (!ogImage) warnings.push(`${rel(file)}: нет og:image`);
  if (h1Count !== 1) warnings.push(`${rel(file)}: количество h1 = ${h1Count}`);

  if (sitemapUrls.size && canonical && canonical.startsWith(SITE_URL) && !sitemapUrls.has(canonical)) {
    warnings.push(`${rel(file)}: canonical не найден в sitemap — ${canonical}`);
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
  const files = walk(ROOT).filter((file) => file.endsWith('.html'));
  files.forEach((file) => auditPage(file, sitemapUrls));

  if (warnings.length) {
    console.warn('Предупреждения SEO-аудита:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('Ошибки SEO-аудита:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`SEO-аудит пройден. Проверено страниц: ${files.length}`);
}

main();
