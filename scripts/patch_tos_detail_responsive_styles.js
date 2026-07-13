const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const TOS_ROOT = path.join(ROOT, 'tos');
const BASE_LINK = '  <link rel="stylesheet" href="/assets/css/styles.css"/>';
const RESPONSIVE_LINK = '  <link rel="stylesheet" href="/assets/css/tos-detail-responsive.css"/>';

function patchHtml(content, label) {
  if (content.includes(RESPONSIVE_LINK)) return { content, changed: false };
  if (!content.includes(BASE_LINK)) {
    throw new Error(`${label} is missing the base stylesheet marker`);
  }
  return {
    content: content.replace(BASE_LINK, `${BASE_LINK}\n${RESPONSIVE_LINK}`),
    changed: true
  };
}

function patchFile(filePath, label) {
  const current = fs.readFileSync(filePath, 'utf8');
  const result = patchHtml(current, label);
  if (result.changed) fs.writeFileSync(filePath, result.content, 'utf8');
  return result.changed;
}

function detailPages() {
  if (!fs.existsSync(TOS_ROOT)) return [];
  return fs.readdirSync(TOS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(TOS_ROOT, entry.name, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);

  let changed = 0;
  if (patchFile(GENERATOR_PATH, 'TOS page generator')) changed += 1;

  const pages = detailPages();
  pages.forEach((filePath) => {
    if (patchFile(filePath, path.relative(ROOT, filePath))) changed += 1;
  });

  console.log(`TOS responsive stylesheet patch OK: ${pages.length} detail pages checked, ${changed} files updated`);
}

main();
