const fs = require('fs');
const path = require('path');
const assert = require('assert');
const placesCore = require('../assets/js/places-core');

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'places', 'index.html');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const PATCHER_PATH = path.join(ROOT, 'scripts', 'patch_places_index_browser.js');
const CLIENT_PATH = path.join(ROOT, 'assets', 'js', 'places.js');

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
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

function placeTitle(place) {
  return String(place || '').replace(/^г\.\s*/i, '').replace(/^с\.\s*/i, '').replace(/^п\.\s*/i, '').trim();
}

function verificationStatus(tos) {
  const allowed = ['verified', 'partial', 'needs_review', 'stale'];
  let status = allowed.includes(tos?.verification_status) ? tos.verification_status : 'needs_review';
  const recheckAfter = tos?.trust?.recheck_after;
  if (recheckAfter && status !== 'needs_review') {
    const recheck = new Date(`${recheckAfter}T00:00:00`);
    if (!Number.isNaN(recheck.getTime()) && recheck.getTime() < Date.now()) status = 'stale';
  }
  return status;
}

function groupPlaces(toses) {
  const grouped = new Map();
  toses.forEach((tos) => {
    const name = String(tos.location || 'Территория уточняется').trim();
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push(tos);
  });

  return [...grouped.entries()].map(([name, items]) => {
    const sorted = items.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
    const statuses = sorted.map(verificationStatus);
    return {
      name,
      slug: slugify(placeTitle(name)),
      count: sorted.length,
      verifiedCount: statuses.filter((status) => status === 'verified').length,
      partialCount: statuses.filter((status) => status === 'partial').length,
      reviewCount: statuses.filter((status) => status === 'needs_review' || status === 'stale').length,
      summary: sorted.length === 1
        ? 'На этой территории сейчас связана 1 карточка ТОС.'
        : `На этой территории сейчас связано ${sorted.length} карточек ТОС.`,
      tosNames: sorted.map((tos) => tos.name),
      toses: sorted
    };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
}

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

function testCore(places) {
  assert.deepStrictEqual(placesCore.stateFromSearch(''), placesCore.DEFAULT_STATE);
  const state = { q: 'Чигорак', count: 'multiple', verification: 'review', sort: 'count-desc' };
  assert.deepStrictEqual(placesCore.stateFromSearch(placesCore.stateToSearch(state)), state);
  assert.deepStrictEqual(
    placesCore.stateFromSearch('?count=bad&verification=bad&sort=bad'),
    placesCore.DEFAULT_STATE
  );

  const summary = placesCore.summary(places);
  assert.strictEqual(summary.places, places.length);
  assert.strictEqual(summary.toses, places.reduce((sum, place) => sum + place.count, 0));
  assert.strictEqual(
    placesCore.filterAndSort(places, { count: 'single' }).length,
    places.filter((place) => place.count === 1).length
  );
  assert.strictEqual(
    placesCore.filterAndSort(places, { count: 'multiple' }).length,
    places.filter((place) => place.count > 1).length
  );

  places.forEach((place) => {
    place.tosNames.forEach((tosName) => {
      const found = placesCore.filterAndSort(places, { q: tosName });
      assert(found.some((item) => item.slug === place.slug), `Search must find ${place.slug} by TOS ${tosName}`);
    });
  });

  const descending = placesCore.filterAndSort(places, { sort: 'count-desc' });
  for (let index = 1; index < descending.length; index += 1) {
    assert(descending[index - 1].count >= descending[index].count, 'Count descending sort is unstable');
  }

  assert.strictEqual(placesCore.verificationGroup({ count: 2, verifiedCount: 2 }), 'verified');
  assert.strictEqual(placesCore.verificationGroup({ count: 2, verifiedCount: 1, reviewCount: 1 }), 'partial');
  assert.strictEqual(placesCore.verificationGroup({ count: 1, reviewCount: 1 }), 'review');
}

function auditPlacesBrowser() {
  const errors = [];
  const html = read(INDEX_PATH);
  const generator = read(GENERATOR_PATH);
  const patcher = read(PATCHER_PATH);
  const client = read(CLIENT_PATH);
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const places = groupPlaces(toses);

  testCore(places);

  [
    'data-places-browser-version="2026-07-22"',
    'id="places-summary"',
    'id="place-search"',
    'id="place-count-filter"',
    'id="place-verification-filter"',
    'id="place-sort"',
    'id="place-reset-filters"',
    'id="place-filter-status" role="status" aria-live="polite"',
    'id="places-grid"',
    'id="places-empty" hidden',
    'Поиск работает по названию населённого пункта и связанным названиям ТОС',
    '<script src="/assets/js/places-core.js"></script><script src="/assets/js/places.js"></script>'
  ].forEach((needle) => requireIncludes(errors, html, needle, 'places/index.html'));

  if (html.indexOf('/assets/js/places-core.js') > html.indexOf('/assets/js/places.js')) {
    errors.push('places/index.html: places-core.js must load before places.js');
  }

  const cardMarkers = html.match(/data-place-slug="[^"]+"/g) || [];
  if (cardMarkers.length !== places.length) {
    errors.push(`places/index.html: expected ${places.length} place cards, found ${cardMarkers.length}`);
  }

  places.forEach((place) => {
    const tosNames = place.tosNames.join('|');
    requireIncludes(
      errors,
      html,
      `data-place-slug="${esc(place.slug)}" data-place-name="${esc(place.name)}" data-place-count="${place.count}" data-place-verified="${place.verifiedCount}" data-place-partial="${place.partialCount}" data-place-review="${place.reviewCount}"`,
      `place card attributes ${place.slug}`
    );
    requireIncludes(errors, html, `data-place-tos-names="${esc(tosNames)}"`, `place search names ${place.slug}`);
    requireIncludes(errors, html, `href="/places/${esc(place.slug)}/"`, `place route ${place.slug}`);
    place.tosNames.forEach((tosName) => requireIncludes(errors, html, `«${esc(tosName)}»`, `TOS name ${tosName}`));
  });

  if (html.includes('href="tel:') || html.includes('href="mailto:') || html.includes('Телефон:')) {
    errors.push('places/index.html: aggregate territory index must not duplicate personal contacts');
  }

  requireIncludes(errors, generator, 'data-place-tos-names=', 'generator search metadata');
  requireIncludes(errors, generator, '/assets/js/places-core.js', 'generator core script');
  requireIncludes(errors, patcher, 'patchPlacesIndexBrowser', 'patcher API');
  requireIncludes(errors, patcher, 'data-places-browser-version="2026-07-22"', 'patcher version');
  requireIncludes(errors, client, 'placesCore.stateFromSearch(location.search)', 'client URL restore');
  requireIncludes(errors, client, 'placesCore.filterAndSort', 'client filtering');
  requireIncludes(errors, client, 'history.replaceState', 'client URL synchronization');
  requireIncludes(errors, client, "event.key === 'Escape'", 'client accessible search reset');

  if (errors.length) throw new Error(`Places browser audit failed:\n${errors.join('\n')}`);
  console.log(`Places browser OK: ${places.length} territories, ${toses.length} TOS links, search and filters verified`);
}

if (require.main === module) auditPlacesBrowser();

module.exports = { auditPlacesBrowser };
