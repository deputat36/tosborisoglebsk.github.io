const fs = require('fs');
const path = require('path');
const { patchPlacesTosLinks } = require('./patch_places_tos_links');
const { placeRoute } = require('./lib/place_routes');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const INDEX_PATH = path.join(ROOT, 'places', 'index.html');
const PLACES_GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const TOS_GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const ROUTE_LIB_PATH = path.join(ROOT, 'scripts', 'lib', 'place_routes.js');
const PATCHER_PATH = path.join(ROOT, 'scripts', 'patch_places_tos_links.js');
const BROWSER_TEST_PATH = path.join(ROOT, 'scripts', 'test_places_tos_navigation.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');

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

function routeFile(route) {
  return path.join(ROOT, String(route).replace(/^\/+/, ''), 'index.html');
}

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

function countMatches(content, pattern) {
  return (content.match(pattern) || []).length;
}

function main() {
  patchPlacesTosLinks();

  const errors = [];
  const toses = JSON.parse(read(TOSES_PATH)).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const index = read(INDEX_PATH);
  const placesGenerator = read(PLACES_GENERATOR_PATH);
  const tosGenerator = read(TOS_GENERATOR_PATH);
  const routeLib = read(ROUTE_LIB_PATH);
  const patcher = read(PATCHER_PATH);
  const browserTest = read(BROWSER_TEST_PATH);
  const workflow = read(WORKFLOW_PATH);

  const indexLinkCount = countMatches(index, /data-place-tos-link href="\/tos\/[^"/]+\/"/g);
  if (indexLinkCount !== toses.length) {
    errors.push(`places/index.html: expected ${toses.length} direct TOS links, found ${indexLinkCount}`);
  }

  const uniquePlaceRoutes = new Set();
  let reverseTextLinks = 0;
  let reverseActionLinks = 0;

  toses.forEach((tos) => {
    const tosRoute = `/tos/${tos.slug}/`;
    const targetPlaceRoute = placeRoute(tos.location);
    uniquePlaceRoutes.add(targetPlaceRoute);

    const indexLink = `<a data-place-tos-link href="${tosRoute}">«${esc(tos.name)}»</a>`;
    requireIncludes(errors, index, indexLink, `places index link ${tos.slug}`);

    const detailPath = routeFile(targetPlaceRoute);
    const detail = read(detailPath);
    const titleLink = `<h3><a data-place-tos-link href="${tosRoute}">ТОС «${esc(tos.name)}»</a></h3>`;
    requireIncludes(errors, detail, titleLink, `place detail title link ${tos.slug}`);

    const tosPath = path.join(ROOT, 'tos', tos.slug, 'index.html');
    const tosHtml = read(tosPath);
    const reverseLink = `<a data-tos-place-link href="${targetPlaceRoute}">${esc(tos.location || 'уточняется')}</a>`;
    const reverseAction = `<a class="btn" data-tos-place-action href="${targetPlaceRoute}">Открыть страницу территории</a>`;
    requireIncludes(errors, tosHtml, reverseLink, `TOS territory text link ${tos.slug}`);
    requireIncludes(errors, tosHtml, reverseAction, `TOS territory action ${tos.slug}`);

    const textCount = countMatches(tosHtml, /data-tos-place-link href="\/places\/[^"/]+\/"/g);
    const actionCount = countMatches(tosHtml, /data-tos-place-action href="\/places\/[^"/]+\/"/g);
    if (textCount !== 1) errors.push(`${tos.slug}: expected 1 territory text link, found ${textCount}`);
    if (actionCount !== 1) errors.push(`${tos.slug}: expected 1 territory action link, found ${actionCount}`);
    reverseTextLinks += textCount;
    reverseActionLinks += actionCount;
  });

  if (reverseTextLinks !== toses.length) errors.push(`expected ${toses.length} reverse text links, found ${reverseTextLinks}`);
  if (reverseActionLinks !== toses.length) errors.push(`expected ${toses.length} reverse action links, found ${reverseActionLinks}`);

  [
    'data-place-tos-link href="/tos/${esc(tos.slug)}/"',
    '«${esc(tos.name)}»</a>',
    '>ТОС «${esc(tos.name)}»</a></h3>'
  ].forEach((needle) => requireIncludes(errors, placesGenerator, needle, 'places generator'));

  [
    "require('./lib/place_routes')",
    'const territoryUrl = placeRoute(tos.location);',
    'data-tos-place-link href="${esc(territoryUrl)}"',
    'data-tos-place-action href="${esc(territoryUrl)}"',
    'Открыть страницу территории'
  ].forEach((needle) => requireIncludes(errors, tosGenerator, needle, 'TOS generator'));

  [
    'function placeSlug(location)',
    'function placeRoute(location)',
    'Территория уточняется',
    'module.exports'
  ].forEach((needle) => requireIncludes(errors, routeLib, needle, 'place route library'));

  [
    'function patchPlacesTosLinks()',
    'patchPlacesGenerator',
    'patchTosGenerator',
    'PLACES_GENERATOR_PATH',
    'TOS_GENERATOR_PATH',
    'regeneratePagesWithoutChangingSitemap',
    'Bidirectional place/TOS links patch OK'
  ].forEach((needle) => requireIncludes(errors, patcher, needle, 'bidirectional navigation patcher'));

  [
    "require('playwright')",
    "require('./lib/place_routes')",
    'data-place-tos-link',
    'data-tos-place-link',
    'expectedTosPaths',
    'round_trips',
    'waitForURL',
    'Bidirectional place/TOS browser navigation OK'
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

  if (errors.length) throw new Error(`Bidirectional place/TOS navigation audit failed:\n${errors.join('\n')}`);
  console.log(`Bidirectional place/TOS navigation OK: ${toses.length} TOS cards, ${uniquePlaceRoutes.size} territories, ${indexLinkCount} index links, ${reverseTextLinks} reverse links and ${reverseActionLinks} actions`);
}

main();
