const fs = require('fs');
const path = require('path');
const { ICON_LINKS, normalizeSiteIcons } = require('./lib/site_icons');
const { publicHtml } = require('./sync_site_icons');

const ROOT = process.cwd();

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing brand asset: ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireToken(errors, content, token, label) {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
}

function main() {
  const errors = [];
  const logo = read('assets/img/logo.svg');
  const darkLogo = read('assets/img/logo-dark.svg');
  const favicon = read('favicon.svg');
  const mark = read('assets/img/brand-mark.svg');
  const ogCover = read('assets/img/og-cover.svg');
  const manifest = read('site.webmanifest');
  const home = read('index.html');
  const guide = read('docs/BRAND-LOGO.md');

  for (const [label, content] of [['logo.svg', logo], ['logo-dark.svg', darkLogo]]) {
    requireToken(errors, content, 'viewBox="0 0 460 142"', label);
    requireToken(errors, content, 'data-brand-mark="tos-bgo-people-oak-v3"', label);
    requireToken(errors, content, '<title>ТОС БГО', label);
    requireToken(errors, content, '<path', label);
    if (content.includes('<text')) errors.push(`${label}: wordmark must use outlined paths`);
  }

  requireToken(errors, logo, '#B62D36', 'logo.svg red');
  requireToken(errors, logo, '#D3A33D', 'logo.svg gold');
  requireToken(errors, darkLogo, '#FFFFFF', 'logo-dark.svg white');
  requireToken(errors, favicon, 'viewBox="0 0 200 200"', 'favicon.svg');
  requireToken(errors, favicon, 'data-brand-mark="tos-bgo-people-oak-v3"', 'favicon.svg');
  requireToken(errors, favicon, '<path', 'favicon.svg');
  if (favicon.includes('<text')) errors.push('favicon.svg must not contain text');
  const geometry = svg => svg.slice(svg.indexOf('<g '), svg.lastIndexOf('</svg>')).replace(/\s+/g, '');
  if (geometry(favicon) !== geometry(mark)) errors.push('favicon.svg must retain the complete approved brand mark');
  for (const [file, size] of [['favicon.png', 192], ['apple-touch-icon.png', 180], ['assets/img/site-icon-512.png', 512]]) {
    const png = fs.readFileSync(path.join(ROOT, file));
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
      errors.push(`${file}: expected a ${size}x${size} PNG`);
    }
  }
  const ico = fs.readFileSync(path.join(ROOT, 'favicon.ico'));
  const sizes = [];
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) errors.push('favicon.ico: invalid ICO header');
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const offset = 6 + i * 16;
    const size = ico[offset] || 256;
    if (size !== (ico[offset + 1] || 256)) errors.push('favicon.ico: image must be square');
    if (ico.readUInt32LE(offset + 12) + ico.readUInt32LE(offset + 8) > ico.length) errors.push('favicon.ico: truncated image');
    sizes.push(size);
  }
  if (JSON.stringify(sizes) !== JSON.stringify([16, 32, 48, 64])) errors.push('favicon.ico: missing browser fallback sizes');
  for (const file of publicHtml(ROOT)) {
    const html = read(file);
    if (!/<head\b/i.test(html)) continue;
    if (!html.includes(ICON_LINKS) || normalizeSiteIcons(html) !== html) errors.push(`${file}: inconsistent site icons`);
  }

  requireToken(errors, ogCover, 'width="1200" height="630"', 'og-cover.svg');
  requireToken(errors, ogCover, 'data-brand-mark="tos-bgo-community"', 'og-cover.svg');
  requireToken(errors, ogCover, 'Портал территориального общественного', 'og-cover.svg');
  requireToken(errors, ogCover, 'tosborisoglebsk.ru', 'og-cover.svg');

  requireToken(errors, manifest, '"src": "/favicon.svg"', 'site.webmanifest');
  const icons = JSON.parse(manifest).icons || [];
  for (const [src, size] of [['/favicon.png', '192x192'], ['/assets/img/site-icon-512.png', '512x512']]) {
    if (!icons.some(icon => icon.src === src && icon.sizes === size && icon.type === 'image/png')) errors.push(`site.webmanifest: missing ${size} icon`);
  }
  requireToken(errors, home, 'src="/assets/img/logo.svg"', 'index.html');
  requireToken(errors, home, 'content="https://tosborisoglebsk.ru/assets/img/og-cover.svg"', 'index.html');

  for (const token of ['Идея знака', 'Основная версия', 'Иконка', 'Социальная обложка', '#B62D36', '#D3A33D', '#242322']) {
    requireToken(errors, guide, token, 'BRAND-LOGO.md');
  }

  if (errors.length) throw new Error(`Brand assets audit failed:\n${errors.join('\n')}`);
  console.log('Brand assets OK: universal logo, dark variant, favicon and OG cover');
}

main();
