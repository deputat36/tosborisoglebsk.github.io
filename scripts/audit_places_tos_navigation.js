const fs = require('fs');
const path = require('path');
const { patchPlacesTosLinks } = require('./patch_places_tos_links');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const INDEX_PATH = path.join(ROOT, 'places', 'index.html');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const PATCHER_PATH = path.join(ROOT, 'scripts', 'patch_places_tos_links.js');
const BROWSER_TEST_PATH = path.join(ROOT, 'scripts', 'test_places_tos_navigation.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value) {
  return String(value || 'place')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => CYR[letter] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'place';
}

function placeSlug(location) {
  const title = String(location || 'Территория уточняется')
    .trim()
    .replace(/^г\.\s*/i, '')
    .replace(/^с\.\s*/i, '')
    .replace(/^п\.\s*/i, '')
    .trim();
  return slugify(title);
}

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

function main() {
  patchPlacesTosLinks();

  const errors = [];
  const toses = JSON.parse(read(TOSES_PATH)).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const index = read(INDEX_PATH);
  const generator = read(GENERATOR_PATH);
  const patcher = read(PATCHER_PATH);
  const browserTest = read(BROWSER_TEST_PATH);
  const workflow = read(WORKFLOW_PATH);

  const indexLinkCount = (index.match(/data-place-tos-link href="\/tos\/[^"]+\/"/g) || []).length;
  if (indexLinkCount !== toses.length) {
    errors.push(`places/index.html: expected ${toses.length} direct TOS links, found ${indexLinkCount}`);
  }

  toses.forEach((tos) => {
    const indexLink = `<a data-place-tos-link href="/tos/${esc(tos.slug)}/">«${esc(tos.name)}»</a>`;
    requireIncludes(errors, index, indexLink, `places index link ${tos.slug}`);

    const detailPath = path.join(ROOT, 'places', placeSlug(tos.location), 'index.html');
    const detail = read(detailPath);
    const titleLink = `<h3><a data-place-tos-link href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a></h3>`;
    requireIncludes(errors, detail, titleLink, `place detail title link ${tos.slug}`);
  });

  [
    'data-place-tos-link href="/tos/${esc(tos.slug)}/"',
    '«${esc(tos.name)}»</a>',
    '>ТОС «${esc(tos.name)}»</a></h3>'
  ].forEach((needle) => requireIncludes(errors, generator, needle, 'places generator'));

  requireIncludes(errors, patcher, 'function patchPlacesTosLinks()', 'places link patcher');
  requireIncludes(errors, patcher, 'execFileSync(process.execPath, [GENERATOR_PATH]', 'places link materialization');

  [
    "require('playwright')",
    'data-place-tos-link',
    'expectedTosPaths',
    'waitForURL',
    'Place-to-TOS browser navigation OK'
  ].forEach((needle) => requireIncludes(errors, browserTest, needle, 'places navigation browser test'));

  [
    'Patch place-to-TOS direct links',
    'node scripts/patch_places_tos_links.js',
    'Check place-to-TOS navigation syntax',
    'node --check scripts/test_places_tos_navigation.js',
    'Test place-to-TOS navigation',
    'node scripts/test_places_tos_navigation.js'
  ].forEach((needle) => requireIncludes(errors, workflow, needle, 'visual workflow'));

  if (/contents:\s*write|pull-requests:\s*write/.test(workflow)) {
    errors.push('visual workflow must remain read-only');
  }

  if (errors.length) throw new Error(`Places to TOS navigation audit failed:\n${errors.join('\n')}`);
  console.log(`Places to TOS navigation OK: ${toses.length} index links and ${toses.length} detail title links`);
}

main();
