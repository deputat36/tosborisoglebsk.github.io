const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_public_browser_interactions.js');
const CARD_NAV_TEST_PATH = path.join(ROOT, 'scripts', 'test_public_card_navigation.js');
const SEARCH_SCRIPT_PATH = path.join(ROOT, 'assets', 'js', 'search-create-tos.js');

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label} missing ${fragment}`);
  });
}

function main() {
  const errors = [];
  [WORKFLOW_PATH, TEST_PATH, CARD_NAV_TEST_PATH, SEARCH_SCRIPT_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Public browser interaction tooling audit failed:\n${errors.join('\n')}`);

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const test = fs.readFileSync(TEST_PATH, 'utf8');
  const cardNavigationTest = fs.readFileSync(CARD_NAV_TEST_PATH, 'utf8');
  const searchScript = fs.readFileSync(SEARCH_SCRIPT_PATH, 'utf8');

  requireFragments(errors, 'visual workflow', workflow, [
    "scripts/test_public_browser_interactions.js",
    "scripts/test_public_card_navigation.js",
    'Check public browser test syntax',
    'Test public browser interactions',
    'Test public card navigation',
    'PUBLIC_BROWSER_REPORT: .artifacts/visual-baseline/browser-interactions.json',
    'PUBLIC_CARD_NAVIGATION_REPORT: .artifacts/visual-baseline/public-card-navigation.json',
    'node scripts/test_public_browser_interactions.js',
    'node scripts/test_public_card_navigation.js',
    "- 'search/index.html'",
    "- 'projects/index.html'",
    "- 'done/index.html'",
    "- 'needs/index.html'"
  ]);

  requireFragments(errors, 'browser interaction test', test, [
    "require('playwright')",
    "PUBLIC_BROWSER_BASE_URL",
    "browser-interactions.json",
    "['global-search', testSearch]",
    "['tos-catalog', testTosCatalog]",
    "['places-browser', testPlaces]",
    "['news-browser'",
    "['projects-browser'",
    "['done-browser'",
    "['needs-browser'",
    "readJson('data/page_index.json')",
    'function searchFixture()',
    "page.search_group === 'news'",
    'selected.content_origin',
    'fixture.path',
    'new URLSearchParams({',
    'q: fixture.query',
    'origin: fixture.origin',
    "'/tos/?q=",
    "'/places/?q=",
    "route: '/news/'",
    "route: '/projects/'",
    "route: '/done/'",
    "route: '/needs/'",
    "press('Escape')",
    "new URLSearchParams(location.search)",
    "data-content-origin",
    "requestfailed",
    "technical_errors",
    "schema_version: 1",
    "Public browser interactions OK"
  ]);

  requireFragments(errors, 'public card navigation test', cardNavigationTest, [
    "require('playwright')",
    'PUBLIC_CARD_NAVIGATION_REPORT',
    '.artifacts/public-card-navigation.json',
    "name: 'global-search-result'",
    "name: 'tos-catalog-card'",
    "name: 'news-card'",
    "name: 'project-card'",
    "name: 'done-card'",
    "name: 'need-card'",
    '#search-results .search-result',
    '#tos-list .improved-tos-card',
    '#news-feed',
    '#projects-list',
    '#done-list',
    '#needs-list',
    'page.waitForURL',
    "expectedPrefix: '/news/'",
    "expectedPrefix: '/tos/'",
    "expectedPrefix: '/projects/'",
    "expectedPrefix: '/done/'",
    "expectedPrefix: '/needs/'",
    'requestfailed',
    'technical_errors',
    'schema_version: 1',
    'Public card navigation OK'
  ]);

  const populatePosition = searchScript.indexOf('populateTypes();');
  const restorePosition = searchScript.indexOf('applyInitialState();');
  if (populatePosition < 0 || restorePosition < 0 || populatePosition > restorePosition) {
    errors.push('global search must populate type options before restoring URL state');
  }

  const scenarioMatches = [...test.matchAll(/\['(?:global-search|tos-catalog|places-browser|news-browser|projects-browser|done-browser|needs-browser)'/g)];
  if (scenarioMatches.length !== 7) errors.push(`browser interaction test must declare 7 scenarios, received ${scenarioMatches.length}`);
  const navigationScenarioMatches = [...cardNavigationTest.matchAll(/name: '(?:global-search-result|tos-catalog-card|news-card|project-card|done-card|need-card)'/g)];
  if (navigationScenarioMatches.length !== 6) errors.push(`public card navigation test must declare 6 scenarios, received ${navigationScenarioMatches.length}`);

  const dynamicSearchSignals = [
    "readJson('data/page_index.json')",
    "page.search_group === 'news'",
    'selected.content_origin',
    'fixture.query',
    'fixture.origin',
    'fixture.path',
    'item.origin === fixture.origin',
    'normalize(fixture.query)'
  ];
  dynamicSearchSignals.forEach((signal) => {
    if (!test.includes(signal)) errors.push(`search scenario must derive and assert a current indexed result: missing ${signal}`);
  });
  if (test.includes("origin=verified") || test.includes("item.origin === 'verified'")) {
    errors.push('search interaction test must not hard-code a content origin that can change with current index data');
  }
  if (test.includes("readJson('data/news.json')") || test.includes('inferContentOrigin(')) {
    errors.push('search interaction fixture must use the public page index, not a parallel collection calculation');
  }
  if (!test.includes("origin: 'starter'")) errors.push('collection scenarios must verify starter material filtering');
  if ((test.match(/origin: 'request'/g) || []).length < 3) errors.push('collection scenarios must verify request filtering across public sections');
  if (!cardNavigationTest.includes('origin=verified') || !cardNavigationTest.includes('origin=starter') || (cardNavigationTest.match(/origin=request/g) || []).length < 2) {
    errors.push('public card navigation must cover verified, starter and request material destinations');
  }

  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('browser interaction workflow must remain read-only');
  }
  if (/page\.goto\(['"]https?:\/\//.test(test) || /page\.goto\(['"]https?:\/\//.test(cardNavigationTest)) {
    errors.push('browser tests must use the configured local base URL');
  }

  try {
    execFileSync(process.execPath, ['--check', TEST_PATH], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', CARD_NAV_TEST_PATH], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', SEARCH_SCRIPT_PATH], { cwd: ROOT, stdio: 'pipe' });
  } catch (error) {
    errors.push(`browser interaction syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Public browser interaction tooling audit failed:\n${errors.join('\n')}`);
  console.log('Public browser interaction tooling OK: 7 state scenarios use the current public index and 6 real card-navigation scenarios; workflow read-only');
}

main();