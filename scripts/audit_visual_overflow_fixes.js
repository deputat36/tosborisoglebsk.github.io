const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HOME_STATS_PATH = path.join(ROOT, 'assets', 'js', 'home-stats.js');
const RESPONSIVE_CSS_PATH = path.join(ROOT, 'assets', 'css', 'tos-detail-responsive.css');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const PATCH_PATH = path.join(ROOT, 'scripts', 'patch_tos_detail_responsive_styles.js');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const TOS_ROOT = path.join(ROOT, 'tos');
const RESPONSIVE_LINK = '<link rel="stylesheet" href="/assets/css/tos-detail-responsive.css"/>';

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label} missing ${fragment}`);
  });
}

function detailPages() {
  const toses = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'));
  return (Array.isArray(toses) ? toses : [])
    .filter((tos) => tos && tos.slug && tos.status !== 'draft')
    .map((tos) => path.join(TOS_ROOT, tos.slug, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  const errors = [];
  [HOME_STATS_PATH, RESPONSIVE_CSS_PATH, GENERATOR_PATH, PATCH_PATH, TOSES_PATH, TOS_ROOT].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Visual overflow fixes audit failed:\n${errors.join('\n')}`);

  const homeStats = fs.readFileSync(HOME_STATS_PATH, 'utf8');
  const css = fs.readFileSync(RESPONSIVE_CSS_PATH, 'utf8');
  const generator = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const patch = fs.readFileSync(PATCH_PATH, 'utf8');

  requireFragments(errors, 'home stats renderer', homeStats, [
    'stats.map(([label,value,hint])',
    '<b>${esc(value)}</b>',
    '<span>${esc(label)}</span>'
  ]);
  if (homeStats.includes('stats.map(([value,label,hint])')) {
    errors.push('home stats renderer still swaps the label and value');
  }

  requireFragments(errors, 'TOS responsive stylesheet', css, [
    '@media (max-width: 620px)',
    '.header-inner',
    'min-width: 0',
    'max-width: 112px',
    '.actions [data-action="theme"]',
    'width: 36px',
    'font-size: 0',
    '.actions [data-action="theme"]::after',
    'content: "◐"'
  ]);
  if (/\[data-action="theme"\][^{]*\{[^}]*display:\s*none/s.test(css)) {
    errors.push('mobile theme control must remain visible and interactive');
  }

  requireFragments(errors, 'TOS responsive patch', patch, [
    'tos-detail-responsive.css',
    'generate_tos_pages.js',
    'TOSES_PATH',
    "path.join(ROOT, 'data', 'toses.json')",
    'TOS responsive stylesheet patch OK'
  ]);

  if (!generator.includes(RESPONSIVE_LINK)) {
    errors.push('TOS page generator is missing the responsive stylesheet link');
  }

  const pages = detailPages();
  if (pages.length !== 24) errors.push(`expected 24 TOS detail pages, received ${pages.length}`);
  pages.forEach((filePath) => {
    const html = fs.readFileSync(filePath, 'utf8');
    if (!html.includes(RESPONSIVE_LINK)) errors.push(`${path.relative(ROOT, filePath)} is missing the responsive stylesheet link`);
  });

  if (errors.length) throw new Error(`Visual overflow fixes audit failed:\n${errors.join('\n')}`);

  console.log(`Visual overflow fixes OK: home stats order corrected, ${pages.length} TOS detail pages use responsive header CSS with an interactive theme control`);
}

main();
