const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
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

function isExternal(url) {
  return /^(https?:|mailto:|tel:|tg:|whatsapp:|javascript:)/i.test(url);
}

function cleanHref(href) {
  return String(href || '').trim().replace(/&amp;/g, '&').split('#')[0].split('?')[0];
}

function parseHref(href) {
  const value = String(href || '').trim().replace(/&amp;/g, '&');
  const hashIndex = value.indexOf('#');
  return {
    value,
    url: cleanHref(value),
    anchor: hashIndex >= 0 ? value.slice(hashIndex + 1).split('?')[0] : ''
  };
}

function htmlFiles() {
  return walk(ROOT).filter((file) => file.endsWith('.html'));
}

function fileForUrl(url, currentFile = null) {
  if (!url) return currentFile;
  if (url === '/') return path.join(ROOT, 'index.html');
  let decoded;
  try { decoded = decodeURIComponent(url); }
  catch { return null; }
  const safe = decoded.replace(/^\/+/, '');
  if (!safe || safe.includes('..')) return null;
  const full = path.join(ROOT, safe);
  if (decoded.endsWith('/')) return fs.existsSync(path.join(full, 'index.html')) ? path.join(full, 'index.html') : null;
  if (fs.existsSync(full)) return full;
  return fs.existsSync(path.join(full, 'index.html')) ? path.join(full, 'index.html') : null;
}

function fileExistsForUrl(url, currentFile = null) {
  return Boolean(fileForUrl(url, currentFile));
}

function hasAnchor(file, anchor) {
  if (!anchor || !file || !file.endsWith('.html')) return true;
  const html = fs.readFileSync(file, 'utf8');
  const anchors = new Set([
    ...[...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/\sname=["']([^"']+)["']/gi)].map((match) => match[1])
  ]);
  return anchors.has(anchor);
}

function auditHtmlLinks() {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = [...html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)];
    for (const match of matches) {
      const raw = match[1];
      const parsed = parseHref(raw);
      const url = parsed.url;
      if (parsed.value.startsWith('#')) {
        if (!hasAnchor(file, parsed.anchor)) errors.push(`${rel(file)}: якорь не найден — ${raw}`);
        continue;
      }
      if (!url || isExternal(url) || url.startsWith('//') || url.startsWith('data:')) continue;
      if (!url.startsWith('/')) continue;
      const targetFile = fileForUrl(url, file);
      if (!targetFile) {
        errors.push(`${rel(file)}: внутренняя ссылка не найдена — ${raw}`);
        continue;
      }
      if (!hasAnchor(targetFile, parsed.anchor)) errors.push(`${rel(file)}: якорь целевой страницы не найден — ${raw}`);
    }
  }
}

function auditJsonLinks() {
  const jsonFiles = walk(path.join(ROOT, 'data')).filter((file) => file.endsWith('.json'));
  for (const file of jsonFiles) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { continue; }
    const text = JSON.stringify(data);
    const links = [...text.matchAll(/"(\/[^"]+)"/g)].map((match) => cleanHref(match[1]));
    for (const url of links) {
      if (!url || url === '/' || url.startsWith('/assets/') || url.startsWith('/documents_files/')) continue;
      if (!fileExistsForUrl(url)) warnings.push(`${rel(file)}: возможно, ссылка пока не создана — ${url}`);
    }
  }
}

function main() {
  auditHtmlLinks();
  if (fs.existsSync(path.join(ROOT, 'data'))) auditJsonLinks();

  if (warnings.length) {
    console.warn('Предупреждения аудита ссылок:');
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (errors.length) {
    console.error('Ошибки внутренних ссылок:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Аудит внутренних ссылок пройден.');
}

main();
