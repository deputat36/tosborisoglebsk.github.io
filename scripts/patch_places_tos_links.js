const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const INDEX_PATH = path.join(ROOT, 'places', 'index.html');

const INDEX_OLD = '${esc(place.toses.map((tos) => `«${tos.name}»`).join(\', \'))}';
const INDEX_NEW = '${place.toses.map((tos) => `<a data-place-tos-link href="/tos/${esc(tos.slug)}/">«${esc(tos.name)}»</a>`).join(\', \')}';
const DETAIL_OLD = '<h3>ТОС «${esc(tos.name)}»</h3>';
const DETAIL_NEW = '<h3><a data-place-tos-link href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a></h3>';

function replaceMarker(content, oldMarker, newMarker, label) {
  if (content.includes(newMarker)) return { content, changed: false };
  if (!content.includes(oldMarker)) throw new Error(`${label}: source marker not found`);
  return { content: content.replace(oldMarker, newMarker), changed: true };
}

function patchPlacesTosLinks() {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);

  let content = fs.readFileSync(GENERATOR_PATH, 'utf8');
  let changed = false;

  const indexResult = replaceMarker(content, INDEX_OLD, INDEX_NEW, 'places index links');
  content = indexResult.content;
  changed = changed || indexResult.changed;

  const detailResult = replaceMarker(content, DETAIL_OLD, DETAIL_NEW, 'place detail title links');
  content = detailResult.content;
  changed = changed || detailResult.changed;

  if (changed) fs.writeFileSync(GENERATOR_PATH, content, 'utf8');

  execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });

  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  if (!indexHtml.includes('data-place-tos-link')) {
    throw new Error('Generated places index is missing direct TOS links');
  }

  console.log(`Place-to-TOS links patch OK: generator ${changed ? 'updated' : 'already current'}, pages regenerated`);
  return { changed };
}

if (require.main === module) patchPlacesTosLinks();

module.exports = { patchPlacesTosLinks };
