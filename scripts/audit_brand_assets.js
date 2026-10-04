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
    requireToken(errors, content, 'viewBox="0 0 460 142"', label);
    requireToken(errors, content, 'data-brand-mark="tos-bgo-people-oak-v3"', label);
    requireToken(errors, content, '<title>ТОС БГО', label);
    requireToken(errors, content, '<path', label);
    if (content.includes('<text')) errors.push(`${label}: wordmark must use outlined paths`);
  }

  requireToken(errors, logo, '#B62D36', 'logo.svg red');
  requireToken(errors, logo, '#D3A33D', 'logo.svg gold');
  requireToken(errors, darkLogo, '#FFFFFF', 'logo-dark.svg white');
  requireToken(errors, favicon, 'viewBox="0 0 32 32"', 'favicon.svg');
  requireToken(errors, favicon, '<path', 'favicon.svg');
  if (favicon.includes('<text')) errors.push('favicon.svg must not contain text');

  requireToken(errors, ogCover, 'width="1200" height="630"', 'og-cover.svg');
  requireToken(errors, ogCover, 'data-brand-mark="tos-bgo-community"', 'og-cover.svg');
  requireToken(errors, ogCover, 'Портал территориального общественного', 'og-cover.svg');
  requireToken(errors, ogCover, 'tosborisoglebsk.ru', 'og-cover.svg');

  requireToken(errors, manifest, '"src": "/favicon.svg"', 'site.webmanifest');
  requireToken(errors, home, 'src="/assets/img/logo.svg"', 'index.html');
  requireToken(errors, home, 'content="https://tosborisoglebsk.ru/assets/img/og-cover.svg"', 'index.html');

  for (const token of ['Идея знака', 'Основная версия', 'Иконка', 'Социальная обложка', '#B62D36', '#D3A33D', '#242322']) {
    requireToken(errors, guide, token, 'BRAND-LOGO.md');
  }

  if (errors.length) throw new Error(`Brand assets audit failed:\n${errors.join('\n')}`);
  console.log('Brand assets OK: universal logo, dark variant, favicon and OG cover');
}

main();
