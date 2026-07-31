const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { coverageFor } = require('./lib/content_coverage');
const { patchTosContentActions } = require('./patch_tos_content_actions');

const ROOT = process.cwd();
const BASE_URL = String(process.env.PUBLIC_BROWSER_BASE_URL || process.env.TOS_ACTIVITY_BASE_URL || process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const activityReport = process.env.TOS_ACTIVITY_REPORT ? path.resolve(process.env.TOS_ACTIVITY_REPORT) : '';
const defaultReport = activityReport
  ? path.join(path.dirname(activityReport), 'tos-content-actions.json')
  : path.resolve('.artifacts/tos-content-actions.json');
const REPORT_PATH = path.resolve(process.env.TOS_CONTENT_ACTIONS_REPORT || defaultReport);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8'));
}

const DATA = {
  toses: readJson('toses.json').filter((item) => item && item.slug && item.status !== 'draft'),
  news: readJson('news.json'),
  done: readJson('done.json'),
  needs: readJson('needs.json')
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectedState(tos) {
  const states = {
    news: coverageFor(DATA.news, tos.slug, 'news'),
    done: coverageFor(DATA.done, tos.slug, 'done'),
    needs: coverageFor(DATA.needs, tos.slug, 'needs')
  };
  const needed = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.substantive === 0]));
  return {
    states,
    needed,
    actionCount: Object.values(needed).filter(Boolean).length,
    requestCount: Object.values(states).reduce((sum, value) => sum + value.requests, 0)
  };
}

const CASES = DATA.toses.map((tos) => ({ tos, ...expectedState(tos) }));
const MULTI_GAP = CASES.reduce((best, item) => !best || item.actionCount > best.actionCount ? item : best, null);
const FOCUSED = CASES.reduce((best, item) => !best || item.actionCount < best.actionCount ? item : best, null);

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${route}: HTTP ${response ? response.status() : 'no response'}`);
}

async function inspectPlan(page, sample) {
  await openRoute(page, `/tos/${sample.tos.slug}/`);
  const plan = page.locator('[data-tos-content-action-plan]');
  await plan.waitFor({ state: 'visible' });
  assert(await plan.getAttribute('data-tos-slug') === sample.tos.slug, `${sample.tos.slug}: wrong plan slug`);
  assert(Number(await plan.getAttribute('data-action-count')) === sample.actionCount, `${sample.tos.slug}: wrong action count`);
  assert(Number(await plan.getAttribute('data-request-count')) === sample.requestCount, `${sample.tos.slug}: wrong request count`);

  const rendered = {};
  for (const key of ['news', 'done', 'needs']) {
    const count = await plan.locator(`[data-content-action="${key}"]`).count();
    rendered[key] = count;
    assert(count === (sample.needed[key] ? 1 : 0), `${sample.tos.slug}: ${key} action mismatch`);
  }

  const boundary = sample.actionCount > 0
    ? (await plan.locator('[data-content-action-boundary]').textContent() || '').trim()
    : '';
  if (sample.actionCount > 0) {
    assert(boundary.includes('не означает, что ТОС не ведёт такую работу'), `${sample.tos.slug}: trust boundary is missing`);
  }

  return {
    slug: sample.tos.slug,
    name: sample.tos.name,
    action_count: sample.actionCount,
    request_count: sample.requestCount,
    needed: sample.needed,
    rendered,
    boundary
  };
}

async function testMultiGapPlan(page) {
  assert(MULTI_GAP && MULTI_GAP.actionCount >= 2, 'multi-gap-plan: no suitable TOS found');
  return inspectPlan(page, MULTI_GAP);
}

async function testFocusedPlan(page) {
  assert(FOCUSED && FOCUSED.actionCount <= 1, 'focused-plan: no focused TOS found');
  const details = await inspectPlan(page, FOCUSED);
  assert(details.rendered.needs === 1, `${FOCUSED.tos.slug}: current focused plan must preserve the real needs gap`);
  assert(details.rendered.news === 0 && details.rendered.done === 0, `${FOCUSED.tos.slug}: covered content categories must not be requested again`);
  return details;
}

async function testAddressedContentAction(page) {
  const sample = MULTI_GAP;
  const priority = [
    ['news', 'news'],
    ['done', 'photo'],
    ['needs', 'need']
  ].find(([key]) => sample.needed[key]);
  assert(priority, 'addressed-content-action: no missing action found');
  const [actionKey, scenario] = priority;

  await openRoute(page, `/tos/${sample.tos.slug}/`);
  const link = page.locator(`[data-content-action="${actionKey}"] a.btn.primary`).first();
  await link.waitFor({ state: 'visible' });

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/update-tos/' && url.searchParams.get('tos') === sample.tos.slug && url.searchParams.get('type') === scenario && url.hash === '#message-builder'),
    link.click()
  ]);

  await page.waitForFunction(({ slug, scenarioKey }) => {
    const select = document.querySelector('#tos-select');
    const active = document.querySelector(`[data-scenario="${scenarioKey}"]`);
    return select && select.value === slug && active && active.getAttribute('aria-pressed') === 'true';
  }, { slug: sample.tos.slug, scenarioKey: scenario });

  const selectedTos = await page.locator('#tos-select').inputValue();
  const activeScenario = await page.locator(`[data-scenario="${scenario}"]`).getAttribute('aria-pressed');
  assert(selectedTos === sample.tos.slug, 'addressed-content-action: TOS was not preselected');
  assert(activeScenario === 'true', 'addressed-content-action: scenario was not preselected');

  return {
    slug: sample.tos.slug,
    action: actionKey,
    scenario,
    url: page.url(),
    selected_tos: selectedTos
  };
}

async function testTosContentActions() {
  patchTosContentActions();
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    ['multi-gap-plan', testMultiGapPlan],
    ['focused-plan', testFocusedPlan],
    ['addressed-content-action', testAddressedContentAction]
  ];
  const results = [];

  try {
    for (const [name, run] of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const technicalErrors = [];
      page.on('pageerror', (error) => technicalErrors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') technicalErrors.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) => technicalErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

      const startedAt = Date.now();
      try {
        const details = await run(page);
        assert(technicalErrors.length === 0, `${name}: technical errors: ${technicalErrors.join(' | ')}`);
        results.push({ name, status: 'passed', duration_ms: Date.now() - startedAt, url: page.url(), details, technical_errors: [] });
        console.log(`PASS ${name}`);
      } catch (error) {
        results.push({ name, status: 'failed', duration_ms: Date.now() - startedAt, url: page.url(), error: error.message, technical_errors: technicalErrors });
        console.error(`FAIL ${name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    total_tos: DATA.toses.length,
    multi_gap_slug: MULTI_GAP?.tos.slug || '',
    focused_slug: FOCUSED?.tos.slug || '',
    total: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (report.failed) throw new Error(`TOS content actions browser failed: ${report.failed} of ${report.total}. See ${REPORT_PATH}`);
  console.log(`TOS content actions browser OK: ${report.passed}/${report.total}; multi ${report.multi_gap_slug}, focused ${report.focused_slug}`);
  return report;
}

if (require.main === module) {
  testTosContentActions().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { testTosContentActions };
