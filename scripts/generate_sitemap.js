const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const contentLastmod = require('./lib/content_lastmod');

const ROOT = process.cwd();
const SITE = 'https://tosborisoglebsk.ru';
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const urls = new Map();
const statePath = path.join(ROOT, 'data', 'sitemap_content_state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, pages: {} };
if (state.version !== 1 || !state.pages || Array.isArray(state.pages)) throw new Error('Invalid sitemap content state');
const nextState = { version: 1, pages: {} };
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

function readPreviousLastmods() {
  const result = new Map();
  if (!fs.existsSync(SITEMAP_PATH)) return result;

  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const pattern = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g;
  for (const match of xml.matchAll(pattern)) result.set(match[1], match[2]);
  return result;
}

const previousLastmods = readPreviousLastmods();

function lastmodFor(filePath, loc) {
  const relativeFile = repoPath(filePath);
  const workingTreeStatus = runGit(['status', '--porcelain', '--', relativeFile]);

  // Generated or edited files that are not committed yet changed today.
  if (workingTreeStatus) return today;

  // For unchanged files use the date of the last commit that touched the page.
  const committedDate = runGit(['log', '-1', '--format=%cs', '--', relativeFile]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(committedDate)) return committedDate;

  // Archives without .git preserve the previous known date instead of rewriting history.
  return previousLastmods.get(loc) || today;
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
    const prior = state.pages[loc];
    const content = contentLastmod.entry(html, prior, prior?.lastmod || lastmodFor(fullPath, loc), today);
    nextState.pages[loc] = content;
    urls.set(loc, content.lastmod);
  }
}

walk(ROOT);
fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2) + '\n', 'utf8');

const rows = [...urls.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([loc, lastmod]) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
  .join('\n');

fs.writeFileSync(
  SITEMAP_PATH,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`,
  'utf8'
);

console.log(`Generated sitemap URLs: ${urls.size}`);
console.log(`Excluded legacy aliases: ${[...legacyAliases].join(', ')}`);
