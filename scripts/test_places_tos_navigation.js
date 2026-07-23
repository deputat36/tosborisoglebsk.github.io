const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { placeRoute, placeTitle } = require('./lib/place_routes');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.PLACES_TOS_REPORT || '.artifacts/places-tos-navigation.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameSet(actual, expected) {
  return actual.size === expected.size && [...expected].every((value) => actual.has(value));
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

function sampleToses(toses) {
  const groups = new Map();
  toses.forEach((tos) => {
    const key = String(tos.location || '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tos);
  });

  const sorted = toses.slice().sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  const single = sorted.find((tos) => (groups.get(String(tos.location || '').trim()) || []).length === 1);
  const multiple = sorted.find((tos) => (groups.get(String(tos.location || '').trim()) || []).length > 1);
  return [...new Map([single, multiple].filter(Boolean).map((tos) => [tos.slug, tos])).values()];
}

async function testRoundTrip(page, tos) {
  const tosRoute = `/tos/${tos.slug}/`;
  const expectedPlaceRoute = placeRoute(tos.location);

  await openRoute(page, tosRoute);
  const reverseLink = page.locator('a[data-tos-place-link]').first();
  const reverseAction = page.locator('a[data-tos-place-action]').first();
  assert(await reverseLink.count() === 1, `${tos.slug}: territory text link is missing`);
  assert(await reverseAction.count() === 1, `${tos.slug}: territory action link is missing`);
  assert(await reverseLink.getAttribute('href') === expectedPlaceRoute, `${tos.slug}: territory text link points to the wrong route`);
  assert(await reverseAction.getAttribute('href') === expectedPlaceRoute, `${tos.slug}: territory action points to the wrong route`);

  await Promise.all([
    page.waitForURL((url) => url.pathname === expectedPlaceRoute),
    reverseLink.click()
  ]);
  const placeHeading = (await page.locator('main h1').first().textContent() || '').trim();
  assert(placeHeading.includes(placeTitle(tos.location)), `${tos.slug}: territory link opened the wrong place page`);

  const backLink = page.locator(`[data-tos-slug="${tos.slug}"] h3 [data-place-tos-link]`).first();
  assert(await backLink.count() === 1, `${tos.slug}: place page does not contain a link back to the TOS card`);
  assert(await backLink.getAttribute('href') === tosRoute, `${tos.slug}: place page link points to the wrong TOS route`);

  await Promise.all([
    page.waitForURL((url) => url.pathname === tosRoute),
    backLink.click()
  ]);
  assert((await page.locator('main h1').first().textContent() || '').includes(tos.name), `${tos.slug}: round trip returned to the wrong TOS card`);

  return {
    tos_slug: tos.slug,
    location: tos.location,
    place_route: expectedPlaceRoute,
    status: 'passed'
  };
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const toses = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'))
    .filter((tos) => tos && tos.slug && tos.status !== 'draft');
  assert(toses.length > 0, 'No published TOS records available for navigation test');

  const expectedTosPaths = new Set(toses.map((tos) => `/tos/${tos.slug}/`));
  const samples = sampleToses(toses);
  assert(samples.length >= 2, 'Navigation test needs samples from single-card and multiple-card territories');

  const firstTos = samples[0];
  const firstPlaceToses = toses.filter((tos) => String(tos.location || '').trim() === String(firstTos.location || '').trim());
  const expectedDetailPaths = new Set(firstPlaceToses.map((tos) => `/tos/${tos.slug}/`));
  const detailRoute = placeRoute(firstTos.location);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const technicalErrors = [];
  page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

  const result = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    published_tos: toses.length,
    detail_route: detailRoute,
    status: 'failed',
    round_trips: [],
    technical_errors: technicalErrors
  };

  try {
    await openRoute(page, '/places/');
    await page.waitForSelector('#places-grid [data-place-tos-link]');

    const indexPaths = new Set(await page.locator('#places-grid [data-place-tos-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean)));
    assert(sameSet(indexPaths, expectedTosPaths), `places index: expected ${expectedTosPaths.size} unique TOS paths, received ${indexPaths.size}`);

    await openRoute(page, detailRoute);
    await page.waitForSelector('[data-tos-slug] h3 [data-place-tos-link]');
    const detailPaths = new Set(await page.locator('[data-tos-slug] h3 [data-place-tos-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean)));
    assert(sameSet(detailPaths, expectedDetailPaths), `place detail: expected ${expectedDetailPaths.size} title links, received ${detailPaths.size}`);

    for (const tos of samples) {
      result.round_trips.push(await testRoundTrip(page, tos));
    }

    assert(technicalErrors.length === 0, `technical errors: ${technicalErrors.join(' | ')}`);

    result.status = 'passed';
    result.index_links = indexPaths.size;
    result.detail_links = detailPaths.size;
    console.log(`Bidirectional place/TOS browser navigation OK: ${indexPaths.size} index links, ${detailPaths.size} links on ${detailRoute}, ${result.round_trips.length} round trips`);
  } catch (error) {
    result.error = error.message;
    throw error;
  } finally {
    await browser.close();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
