const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', '_private', 'admin']);
const TECHNICAL_PREFIXES = ['audit/'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function getTitle(html) {
  return (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
}

function getDescription(html) {
  const direct = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const reversed = html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  return (direct || reversed || [])[1] || '';
}

function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function duplicateGroups(pages, field) {
  const groups = new Map();
  for (const page of pages) {
    const value = normalize(page[field]);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(page.path);
  }
  return [...groups.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([value, files]) => ({ value, files }));
}

function main() {
  const pages = walk(ROOT)
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const html = fs.readFileSync(file, 'utf8');
      const relative = rel(file);
      const technical = TECHNICAL_PREFIXES.some((prefix) => relative.startsWith(prefix));
      return {
        path: relative,
        public: !technical && !isNoindex(html),
        title: getTitle(html),
        description: getDescription(html)
      };
    })
    .filter((page) => page.public);

  const errors = [];
  for (const [field, label] of [['title', 'title'], ['description', 'description']]) {
    for (const group of duplicateGroups(pages, field)) {
      errors.push(`дублируется ${label} на ${group.files.length} публичных страницах: ${group.files.join(', ')} — «${group.value}»`);
    }
  }

  if (errors.length) {
    throw new Error(`Public metadata uniqueness audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Public metadata uniqueness OK: ${pages.length} public HTML pages`);
}

main();
