const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules']);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (path.extname(entry.name).toLowerCase() === '.html') files.push(fullPath);
  }
  return files;
}

function ensureMainId(html) {
  return html.replace(/<main\b([^>]*)>/i, (tag, attributes) => {
    if (/\bid\s*=/.test(attributes)) return tag;
    return `<main id="main"${attributes}>`;
  });
}

function firstMainId(html) {
  const mainTag = html.match(/<main\b[^>]*>/i)?.[0] || '';
  const idMatch = mainTag.match(/\bid\s*=\s*(["'])(.*?)\1/i);
  return idMatch?.[2] || '';
}

function ensureSkipLink(html) {
  if (!/<main\b/i.test(html)) return html;
  if (/<a\b[^>]*class\s*=\s*(["'])[^"']*\bskip-link\b[^"']*\1/i.test(html)) return html;

  let patched = ensureMainId(html);
  const mainId = firstMainId(patched) || 'main';
  const link = `<a class="skip-link" href="#${mainId}">Перейти к содержимому</a>`;
  patched = patched.replace(/<body\b([^>]*)>/i, `<body$1>${link}`);
  return patched;
}

function main() {
  let changedFiles = 0;
  let skipLinksAdded = 0;
  let mainIdsAdded = 0;

  for (const filePath of walk(ROOT)) {
    const before = fs.readFileSync(filePath, 'utf8');
    if (!/<main\b/i.test(before)) continue;

    const hadSkipLink = /<a\b[^>]*class\s*=\s*(["'])[^"']*\bskip-link\b[^"']*\1/i.test(before);
    const hadMainId = /<main\b[^>]*\bid\s*=/i.test(before);
    const after = ensureSkipLink(before);

    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      changedFiles += 1;
      if (!hadSkipLink) skipLinksAdded += 1;
      if (!hadMainId && /<main\b[^>]*\bid\s*=/i.test(after)) mainIdsAdded += 1;
    }
  }

  console.log(`Accessibility landmarks patched: ${changedFiles} files, skip links added ${skipLinksAdded}, main ids added ${mainIdsAdded}`);
}

main();
