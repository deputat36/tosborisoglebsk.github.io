const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const REPORT_PATH = path.resolve(process.env.PLACES_TOS_REPORT || '.artifacts/places-tos-navigation.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function slugify(value) {
  return String(value || 'place')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => CYR[letter] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'place';
}

function placeSlug(location) {
  return slugify(String(location || 'Территория уточняется')
    .trim()
    .replace(/^г\.\s*/i, '')
    .replace(/^с\.\s*/i, '')
    .replace(/^п\.\s*/i, '')
    .trim());
}

function sameSet(actual, expected) {
  return actual.size === expected.size && [...expected].every((value) => actual.has(value));
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const toses = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'))
    .filter((tos) => tos && tos.slug && tos.status !== 'draft');
  assert(toses.length > 0, 'No published TOS records available for navigation test');

  const expectedTosPaths = new Set(toses.map((tos) => `/tos/${tos.slug}/`));
  const firstTos = toses.slice().sort((a, b) => String(a.slug).localeCompare(String(b.slug)))[0];
  const firstPlaceToses = toses.filter((tos) => String(tos.location || '').trim() === String(firstTos.location || '').trim());
  const expectedDetailPaths = new Set(firstPlaceToses.map((tos) => `/tos/${tos.slug}/`));
  const detailRoute = `/places/${placeSlug(firstTos.location)}/`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const technicalErrors = [];
  page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

  const result = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    published_tos: toses.length,
    detail_route: detailRoute,
    status: 'failed',
    technical_errors: technicalErrors
  };

  try {
    await openRoute(page, '/places/');
    await page.waitForSelector('#places-grid [data-place-tos-link]');

    const indexPaths = new Set(await page.locator('#places-grid [data-place-tos-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean)));
    assert(sameSet(indexPaths, expectedTosPaths), `places index: expected ${expectedTosPaths.size} unique TOS paths, received ${indexPaths.size}`);

    const firstIndexLink = page.locator(`#places-grid [data-place-tos-link][href="/tos/${firstTos.slug}/"]`).first();
    assert(await firstIndexLink.count() === 1, `places index: direct link for ${firstTos.slug} is missing`);
    await Promise.all([
      page.waitForURL((url) => url.pathname === `/tos/${firstTos.slug}/`),
      firstIndexLink.click()
    ]);
    assert((await page.locator('main h1').first().textContent() || '').includes(firstTos.name), 'places index: direct link opened the wrong TOS card');

    await openRoute(page, detailRoute);
    await page.waitForSelector('[data-tos-slug] h3 [data-place-tos-link]');
    const detailPaths = new Set(await page.locator('[data-tos-slug] h3 [data-place-tos-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean)));
    assert(sameSet(detailPaths, expectedDetailPaths), `place detail: expected ${expectedDetailPaths.size} title links, received ${detailPaths.size}`);

    const firstDetailLink = page.locator(`[data-tos-slug="${firstTos.slug}"] h3 [data-place-tos-link]`).first();
    assert(await firstDetailLink.count() === 1, `place detail: title link for ${firstTos.slug} is missing`);
    await Promise.all([
      page.waitForURL((url) => url.pathname === `/tos/${firstTos.slug}/`),
      firstDetailLink.click()
    ]);
    assert((await page.locator('main h1').first().textContent() || '').includes(firstTos.name), 'place detail: title link opened the wrong TOS card');
    assert(technicalErrors.length === 0, `technical errors: ${technicalErrors.join(' | ')}`);

    result.status = 'passed';
    result.index_links = indexPaths.size;
    result.detail_links = detailPaths.size;
    console.log(`Place-to-TOS browser navigation OK: ${indexPaths.size} index links, ${detailPaths.size} links on ${detailRoute}`);
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
