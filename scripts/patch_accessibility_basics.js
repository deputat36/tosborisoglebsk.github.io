const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (path.extname(entry.name).toLowerCase() === '.html') files.push(fullPath);
  }
  return files;
}

function addHtmlLang(html) {
  return html.replace(/<html\b(?![^>]*\blang\s*=)([^>]*)>/i, '<html lang="ru"$1>');
}

function attributeValue(tag, name) {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  if (quoted) return quoted[2];
  const unquoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i'));
  return unquoted ? unquoted[1] : '';
}

function secureExternalBlankLink(tag) {
  const href = attributeValue(tag, 'href');
  const target = attributeValue(tag, 'target').toLowerCase();
  if (!/^https?:\/\//i.test(href) || target !== '_blank') return tag;

  const relMatch = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i);
  if (!relMatch) return tag.replace(/\s*\/?>$/, (ending) => ` rel="noopener"${ending}`);

  const tokens = new Set(relMatch[2].split(/\s+/).filter(Boolean).map((token) => token.toLowerCase()));
  if (tokens.has('noopener') || tokens.has('noreferrer')) return tag;
  tokens.add('noopener');
  return tag.replace(relMatch[0], `rel=${relMatch[1]}${[...tokens].join(' ')}${relMatch[1]}`);
}

function patchHtml(html) {
  let patched = addHtmlLang(html);
  patched = patched.replace(/<a\b[^>]*>/gi, secureExternalBlankLink);
  return patched;
}

function main() {
  let changedFiles = 0;
  let langAdded = 0;
  let securedLinks = 0;

  for (const filePath of walk(ROOT)) {
    const before = fs.readFileSync(filePath, 'utf8');
    const beforeLang = /<html\b[^>]*\blang\s*=/i.test(before);
    const beforeUnsafe = (before.match(/<a\b(?=[^>]*\btarget\s*=\s*["']?_blank["']?)(?=[^>]*\bhref\s*=\s*["']?https?:\/\/)(?![^>]*\brel\s*=\s*["'][^"']*(?:noopener|noreferrer))[^>]*>/gi) || []).length;
    const after = patchHtml(before);

    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      changedFiles += 1;
      if (!beforeLang && /<html\b[^>]*\blang\s*=/i.test(after)) langAdded += 1;
      securedLinks += beforeUnsafe;
    }
  }

  console.log(`Accessibility basics patched: ${changedFiles} files, lang added ${langAdded}, external links secured ${securedLinks}`);
}

main();
