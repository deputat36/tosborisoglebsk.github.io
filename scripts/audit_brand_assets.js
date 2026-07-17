const fs = require('fs');
const path = require('path');

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
  const ogCover = read('assets/img/og-cover.svg');
  const manifest = read('site.webmanifest');
  const home = read('index.html');
  const guide = read('docs/BRAND-LOGO.md');

  for (const [label, content] of [['logo.svg', logo], ['logo-dark.svg', darkLogo]]) {
    requireToken(errors, content, 'viewBox="0 0 244 64"', label);
    requireToken(errors, content, 'data-brand-mark="tos-bgo-community"', label);
    requireToken(errors, content, 'data-brand-wordmark="tos-bgo"', label);
    requireToken(errors, content, '>ТОС БГО</text>', label);
    requireToken(errors, content, '>Борисоглебский округ</text>', label);
    requireToken(errors, content, '#F2C14E', label);
  }

  requireToken(errors, logo, 'width="242" height="56"', 'logo.svg universal surface');
  requireToken(errors, logo, 'fill-opacity=".96"', 'logo.svg universal surface');
  requireToken(errors, favicon, 'viewBox="0 0 64 64"', 'favicon.svg');
  requireToken(errors, favicon, 'data-brand-mark="tos-bgo-community"', 'favicon.svg');
  if (favicon.includes('<text')) errors.push('favicon.svg must not contain text');

  requireToken(errors, ogCover, 'width="1200" height="630"', 'og-cover.svg');
  requireToken(errors, ogCover, 'data-brand-mark="tos-bgo-community"', 'og-cover.svg');
  requireToken(errors, ogCover, 'Портал территориального общественного', 'og-cover.svg');
  requireToken(errors, ogCover, 'tosborisoglebsk.ru', 'og-cover.svg');

  requireToken(errors, manifest, '"src": "/favicon.svg"', 'site.webmanifest');
  requireToken(errors, home, 'src="/assets/img/logo.svg"', 'index.html');
  requireToken(errors, home, 'content="https://tosborisoglebsk.ru/assets/img/og-cover.svg"', 'index.html');

  for (const token of ['Идея знака', 'Основная версия', 'Иконка', 'Социальная обложка', '#2F9A6B', '#4D6FDB', '#F2C14E']) {
    requireToken(errors, guide, token, 'BRAND-LOGO.md');
  }

  if (errors.length) throw new Error(`Brand assets audit failed:\n${errors.join('\n')}`);
  console.log('Brand assets OK: universal logo, dark variant, favicon and OG cover');
}

main();
