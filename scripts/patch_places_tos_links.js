const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const PLACES_GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const TOS_GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const INDEX_PATH = path.join(ROOT, 'places', 'index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const INDEX_OLD = '${esc(place.toses.map((tos) => `«${tos.name}»`).join(\', \'))}';
const INDEX_NEW = '${place.toses.map((tos) => `<a data-place-tos-link href="/tos/${esc(tos.slug)}/">«${esc(tos.name)}»</a>`).join(\', \')}';
const DETAIL_OLD = '<h3>ТОС «${esc(tos.name)}»</h3>';
const DETAIL_NEW = '<h3><a data-place-tos-link href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a></h3>';
const TOS_ROUTE_IMPORT = "const { placeRoute } = require('./lib/place_routes');";
const TOS_SCOPE_MARKER = "  const publicScope = scopeInfo(tos, ['social_links', 'logo']);";
const TOS_SCOPE_REPLACEMENT = `${TOS_SCOPE_MARKER}\n  const territoryUrl = placeRoute(tos.location);`;
const TOS_TERRITORY_OLD = '<p><b>Населённый пункт:</b> ${esc(tos.location || \'уточняется\')}</p><p><b>Границы:</b> ${esc(tos.boundaries || \'уточняются\')}</p>';
const TOS_TERRITORY_NEW = '<p><b>Населённый пункт:</b> <a data-tos-place-link href="${esc(territoryUrl)}">${esc(tos.location || \'уточняется\')}</a></p><p><b>Границы:</b> ${esc(tos.boundaries || \'уточняются\')}</p><div class="card-actions"><a class="btn" data-tos-place-action href="${esc(territoryUrl)}">Открыть страницу территории</a></div>';

function replaceMarker(content, oldMarker, newMarker, label) {
  if (content.includes(newMarker)) return { content, changed: false };
  if (!content.includes(oldMarker)) throw new Error(`${label}: source marker not found`);
  return { content: content.replace(oldMarker, newMarker), changed: true };
}

function patchPlacesGenerator(content) {
  let next = content;
  let changed = false;

  const indexResult = replaceMarker(next, INDEX_OLD, INDEX_NEW, 'places index links');
  next = indexResult.content;
  changed = changed || indexResult.changed;

  const detailResult = replaceMarker(next, DETAIL_OLD, DETAIL_NEW, 'place detail title links');
  next = detailResult.content;
  changed = changed || detailResult.changed;

  return { content: next, changed };
}

function patchTosGenerator(content) {
  let next = content;
  let changed = false;

  if (!next.includes(TOS_ROUTE_IMPORT)) {
    const importMarker = "const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');";
    if (!next.includes(importMarker)) throw new Error('TOS place route import: source marker not found');
    next = next.replace(importMarker, `${importMarker}\n${TOS_ROUTE_IMPORT}`);
    changed = true;
  }

  const scopeResult = replaceMarker(next, TOS_SCOPE_MARKER, TOS_SCOPE_REPLACEMENT, 'TOS territory route value');
  next = scopeResult.content;
  changed = changed || scopeResult.changed;

  const territoryResult = replaceMarker(next, TOS_TERRITORY_OLD, TOS_TERRITORY_NEW, 'TOS territory links');
  next = territoryResult.content;
  changed = changed || territoryResult.changed;

  return { content: next, changed };
}

function regeneratePagesWithoutChangingSitemap() {
  const hadSitemap = fs.existsSync(SITEMAP_PATH);
  const sitemapBefore = hadSitemap ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';

  try {
    execFileSync(process.execPath, [PLACES_GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });
    execFileSync(process.execPath, [TOS_GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });
  } finally {
    if (hadSitemap) fs.writeFileSync(SITEMAP_PATH, sitemapBefore, 'utf8');
    else fs.rmSync(SITEMAP_PATH, { force: true });
  }
}

function patchPlacesTosLinks() {
  [PLACES_GENERATOR_PATH, TOS_GENERATOR_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) throw new Error(`Missing generator: ${filePath}`);
  });

  const placesResult = patchPlacesGenerator(fs.readFileSync(PLACES_GENERATOR_PATH, 'utf8'));
  const tosResult = patchTosGenerator(fs.readFileSync(TOS_GENERATOR_PATH, 'utf8'));

  if (placesResult.changed) fs.writeFileSync(PLACES_GENERATOR_PATH, placesResult.content, 'utf8');
  if (tosResult.changed) fs.writeFileSync(TOS_GENERATOR_PATH, tosResult.content, 'utf8');

  regeneratePagesWithoutChangingSitemap();

  const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  if (!indexHtml.includes('data-place-tos-link')) {
    throw new Error('Generated places index is missing direct TOS links');
  }
  if (!tosResult.content.includes('data-tos-place-link') || !tosResult.content.includes('data-tos-place-action')) {
    throw new Error('Generated TOS source is missing reverse territory links');
  }

  const changed = placesResult.changed || tosResult.changed;
  console.log(`Bidirectional place/TOS links patch OK: generators ${changed ? 'updated' : 'already current'}, pages regenerated`);
  return { changed, placesChanged: placesResult.changed, tosChanged: tosResult.changed };
}

if (require.main === module) patchPlacesTosLinks();

module.exports = {
  patchPlacesTosLinks,
  patchPlacesGenerator,
  patchTosGenerator
};
