const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_public_browser_interactions.js');
const SEARCH_SCRIPT_PATH = path.join(ROOT, 'assets', 'js', 'search-create-tos.js');

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label} missing ${fragment}`);
  });
}

function main() {
  const errors = [];
  [WORKFLOW_PATH, TEST_PATH, SEARCH_SCRIPT_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Public browser interaction tooling audit failed:\n${errors.join('\n')}`);

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const test = fs.readFileSync(TEST_PATH, 'utf8');
  const searchScript = fs.readFileSync(SEARCH_SCRIPT_PATH, 'utf8');

  requireFragments(errors, 'visual workflow', workflow, [
    "scripts/test_public_browser_interactions.js",
    'Check public browser interaction syntax',
    'Test public browser interactions',
    'PUBLIC_BROWSER_REPORT: .artifacts/visual-baseline/browser-interactions.json',
    'node scripts/test_public_browser_interactions.js',
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
    "'/search/?q=",
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

  const populatePosition = searchScript.indexOf('populateTypes();');
  const restorePosition = searchScript.indexOf('applyInitialState();');
  if (populatePosition < 0 || restorePosition < 0 || populatePosition > restorePosition) {
    errors.push('global search must populate type options before restoring URL state');
  }

  const scenarioMatches = [...test.matchAll(/\['(?:global-search|tos-catalog|places-browser|news-browser|projects-browser|done-browser|needs-browser)'/g)];
  if (scenarioMatches.length !== 7) errors.push(`browser interaction test must declare 7 scenarios, received ${scenarioMatches.length}`);
  if (!test.includes("origin: 'verified'")) errors.push('search scenario must verify a confirmed result');
  if (!test.includes("origin: 'starter'")) errors.push('collection scenarios must verify starter material filtering');
  if ((test.match(/origin: 'request'/g) || []).length < 3) errors.push('collection scenarios must verify request filtering across public sections');

  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('browser interaction workflow must remain read-only');
  }
  if (/page\.goto\(['"]https?:\/\//.test(test)) errors.push('browser tests must use the configured local base URL');

  try {
    execFileSync(process.execPath, ['--check', TEST_PATH], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', SEARCH_SCRIPT_PATH], { cwd: ROOT, stdio: 'pipe' });
  } catch (error) {
    errors.push(`browser interaction syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Public browser interaction tooling audit failed:\n${errors.join('\n')}`);
  console.log('Public browser interaction tooling OK: 7 scenarios, URL state, filters, reset, Escape and search option restoration');
}

main();
