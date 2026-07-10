const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const SITE = 'https://tosborisoglebsk.ru';
const urls = new Map();
const today = new Date().toISOString().slice(0, 10);
const skipDirectories = new Set(['.git', '.github', 'node_modules', 'scripts', 'admin', 'audit', '_private', 'tools']);
const legacyAliases = new Set([
  'tos/chkalovets',
  'tos/s-mahrovka',
  'tos/tantsyrey'
]);

function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function repoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function lastmodFor(filePath) {
  const relativeFile = repoPath(filePath);
  const workingTreeStatus = runGit(['status', '--porcelain', '--', relativeFile]);

  // Generated or edited files that are not committed yet changed today.
  if (workingTreeStatus) return today;

  // For unchanged files use the date of the last commit that touched the page.
  const committedDate = runGit(['log', '-1', '--format=%cs', '--', relativeFile]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(committedDate)) return committedDate;

  // If Git metadata is unavailable, omit lastmod rather than publishing a false date.
  return '';
}

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

    const html = fs.readFileSync(fullPath, 'utf8');
    if (isNoindex(html)) continue;

    const loc = relativeDirectory ? `${SITE}/${relativeDirectory}/` : `${SITE}/`;
    urls.set(loc, lastmodFor(fullPath));
  }
}

walk(ROOT);

const rows = [...urls.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([loc, lastmod]) => lastmod
    ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
    : `  <url><loc>${loc}</loc></url>`)
  .join('\n');

fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`,
  'utf8'
);

console.log(`Generated sitemap URLs: ${urls.size}`);
console.log(`Excluded legacy aliases: ${[...legacyAliases].join(', ')}`);
