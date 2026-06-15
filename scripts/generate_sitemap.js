const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE = 'https://tosborisoglebsk.ru';
const urls = new Set();
const today = new Date().toISOString().slice(0, 10);
const skipDirectories = new Set(['.git', '.github', 'node_modules', 'scripts', 'admin', 'audit', '_private', 'tools']);
const legacyAliases = new Set([
  'tos/chkalovets',
  'tos/s-mahrovka',
  'tos/tantsyrey'
]);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.name !== 'index.html') continue;

    const relativeDirectory = path.relative(ROOT, path.dirname(fullPath)).split(path.sep).join('/');
    if (relativeDirectory.startsWith('documents/demo')) continue;
    if (legacyAliases.has(relativeDirectory)) continue;

    urls.add(relativeDirectory ? `${SITE}/${relativeDirectory}/` : `${SITE}/`);
  }
}

walk(ROOT);

const rows = [...urls]
  .sort()
  .map((loc) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`)
  .join('\n');

fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`,
  'utf8'
);

console.log(`Generated sitemap URLs: ${urls.size}`);
console.log(`Excluded legacy aliases: ${[...legacyAliases].join(', ')}`);
