const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const MATRIX_PATH = path.resolve(ROOT, process.env.VISUAL_BASELINE_MATRIX || 'data/css_regression_matrix.csv');
const OUTPUT_DIR = path.resolve(ROOT, process.env.VISUAL_BASELINE_OUTPUT || '.artifacts/visual-baseline');
const BASE_URL = String(process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

const HEADERS = [
  'case_id',
  'area',
  'route',
  'viewport_width',
  'viewport_height',
  'theme',
  'interaction',
  'mode',
  'expected_check',
  'status',
  'evidence_ref',
  'notes'
];

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function prepareOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.readdirSync(OUTPUT_DIR, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isFile()) return;
    if (/^css-reg-\d{3}\.png$/.test(entry.name) || ['manifest.json', 'README.md'].includes(entry.name)) {
      fs.rmSync(path.join(OUTPUT_DIR, entry.name), { force: true });
    }
  });
}

function readCases() {
  if (!fs.existsSync(MATRIX_PATH)) throw new Error(`Matrix not found: ${MATRIX_PATH}`);

  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map(normalize);
  if (headers.join('|') !== HEADERS.join('|')) {
    throw new Error(`Unexpected matrix headers: ${headers.join(', ')}`);
  }

  return rows.slice(1).map((row, index) => {
    const values = HEADERS.map((_, columnIndex) => normalize(row[columnIndex]));
    const item = Object.fromEntries(HEADERS.map((header, columnIndex) => [header, values[columnIndex]]));
    item.viewport_width = Number(item.viewport_width);
    item.viewport_height = Number(item.viewport_height);
    item.matrix_line = index + 2;
    return item;
  });
}

async function settlePage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function applyThemeAndInteraction(page, item) {
  if (item.interaction === 'toggle-theme') {
    const currentTheme = await page.evaluate(() => document.documentElement.dataset.theme || 'light');
    if (currentTheme !== item.theme) {
      await page.locator('[data-action=theme]').click();
      await page.waitForTimeout(150);
    }
  }

  if (item.interaction === 'open-menu') {
    await page.locator('[data-action=menu]').click();
    await page.locator('#site-nav.open').waitFor({ state: 'visible', timeout: 3000 });
  }

  if (item.mode === 'print' || item.interaction === 'print-preview') {
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(150);
  }
}

function buildTechnicalViolations(item, diagnostics, consoleErrors, pageErrors) {
  const violations = [];

  if (diagnostics.horizontalOverflow) {
    const directOffenders = diagnostics.overflowElements
      .slice(0, 5)
      .map((entry) => `${entry.selector} [${entry.left}, ${entry.right}]`);
    const internalOffenders = diagnostics.internalOverflowElements
      .slice(0, 5)
      .map((entry) => `${entry.selector} (${entry.scrollWidth}>${entry.clientWidth})`);
    const isolationOffenders = diagnostics.overflowIsolationCandidates
      .slice(0, 5)
      .map((entry) => `${entry.selector} (-${entry.reduction}px)`);
    const offenders = [...directOffenders, ...internalOffenders, ...isolationOffenders].join('; ');
    violations.push(`horizontal overflow ${diagnostics.documentScrollWidth}px > ${diagnostics.documentClientWidth}px${offenders ? `; ${offenders}` : ''}`);
  }

  if (diagnostics.htmlTheme !== item.theme) {
    violations.push(`theme mismatch: expected ${item.theme}, received ${diagnostics.htmlTheme}`);
  }

  if (item.interaction === 'open-menu' && (!diagnostics.menuOpen || diagnostics.menuExpanded !== 'true')) {
    violations.push(`mobile menu state mismatch: open=${diagnostics.menuOpen}, aria-expanded=${diagnostics.menuExpanded}`);
  }

  if (consoleErrors.length) violations.push(`console errors: ${consoleErrors.length}`);
  if (pageErrors.length) violations.push(`page errors: ${pageErrors.length}`);

  return violations;
}

async function captureCase(browser, item) {
  const context = await browser.newContext({
    viewport: { width: item.viewport_width, height: item.viewport_height },
    deviceScaleFactor: 1,
    colorScheme: item.theme === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce'
  });

  await context.addInitScript(({ theme, interaction }) => {
    if (interaction === 'toggle-theme') localStorage.setItem('theme', theme === 'dark' ? 'light' : 'dark');
    else localStorage.setItem('theme', theme);
  }, { theme: item.theme, interaction: item.interaction });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });

  const targetUrl = new URL(item.route, `${BASE_URL}/`).href;
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  if (!response || !response.ok()) {
    throw new Error(`HTTP ${response ? response.status() : 'no response'} for ${targetUrl}`);
  }

  await settlePage(page);
  await applyThemeAndInteraction(page, item);

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const fileName = `${item.case_id}.png`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: item.mode === 'print' });

  const diagnostics = await page.evaluate(() => {
    const measureDocumentWidth = () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const documentClientWidth = document.documentElement.clientWidth;
    const documentScrollWidth = measureDocumentWidth();

    const selectorFor = (element) => {
      if (element.id) return `${element.tagName.toLowerCase()}#${element.id}`;
      const classNames = [...element.classList].slice(0, 3);
      return `${element.tagName.toLowerCase()}${classNames.map((name) => `.${name}`).join('')}`;
    };

    const elements = [...document.querySelectorAll('body *')];
    const describeElement = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector: selectorFor(element),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        position: style.position,
        overflowX: style.overflowX,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      };
    };

    const describedElements = elements.map((element) => ({ element, details: describeElement(element) }));

    const overflowElements = describedElements
      .map(({ details }) => details)
      .filter((entry) => entry.visible && (entry.left < -1 || entry.right > documentClientWidth + 1))
      .sort((a, b) => Math.max(Math.abs(b.left), b.right - documentClientWidth) - Math.max(Math.abs(a.left), a.right - documentClientWidth))
      .slice(0, 20)
      .map(({ visible, ...entry }) => entry);

    const internalOverflowElements = describedElements
      .map(({ details }) => details)
      .filter((entry) => entry.visible && entry.clientWidth > 0 && entry.scrollWidth > entry.clientWidth + 1)
      .sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth))
      .slice(0, 20)
      .map(({ visible, ...entry }) => entry);

    const overflowIsolationCandidates = [];
    if (documentScrollWidth > documentClientWidth + 1) {
      describedElements.forEach(({ element, details }) => {
        if (!details.visible) return;
        const previousValue = element.style.getPropertyValue('overflow-x');
        const previousPriority = element.style.getPropertyPriority('overflow-x');
        element.style.setProperty('overflow-x', 'hidden', 'important');
        const isolatedWidth = measureDocumentWidth();
        if (previousValue) element.style.setProperty('overflow-x', previousValue, previousPriority);
        else element.style.removeProperty('overflow-x');

        if (isolatedWidth < documentScrollWidth) {
          overflowIsolationCandidates.push({
            selector: details.selector,
            originalWidth: documentScrollWidth,
            isolatedWidth,
            reduction: documentScrollWidth - isolatedWidth,
            elementScrollWidth: details.scrollWidth,
            elementClientWidth: details.clientWidth
          });
        }
      });
      overflowIsolationCandidates.sort((a, b) => b.reduction - a.reduction);
    }

    return {
      title: document.title,
      htmlTheme: document.documentElement.dataset.theme || 'light',
      documentScrollWidth,
      documentClientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      horizontalOverflow: documentScrollWidth > documentClientWidth + 1,
      overflowElements,
      internalOverflowElements,
      overflowIsolationCandidates: overflowIsolationCandidates.slice(0, 20),
      menuExpanded: document.querySelector('[data-action=menu]')?.getAttribute('aria-expanded') || null,
      menuOpen: document.querySelector('#site-nav')?.classList.contains('open') || false
    };
  });

  await context.close();

  const technicalViolations = buildTechnicalViolations(item, diagnostics, consoleErrors, pageErrors);

  return {
    case_id: item.case_id,
    area: item.area,
    route: item.route,
    target_url: targetUrl,
    viewport: { width: item.viewport_width, height: item.viewport_height },
    theme: item.theme,
    interaction: item.interaction,
    mode: item.mode,
    expected_check: item.expected_check,
    screenshot: fileName,
    sha256: sha256(filePath),
    bytes: fs.statSync(filePath).size,
    diagnostics,
    technical_violations: technicalViolations,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failed_requests: failedRequests
  };
}

async function main() {
  const cases = readCases();
  if (!cases.length) throw new Error('CSS regression matrix has no cases');

  prepareOutputDir();

  const browser = await chromium.launch({ headless: true });
  const results = [];
  const failures = [];

  try {
    for (const item of cases) {
      try {
        const result = await captureCase(browser, item);
        results.push(result);
        const qualitySuffix = result.technical_violations.length ? `; violations=${result.technical_violations.length}` : '';
        console.log(`Captured ${item.case_id}: ${item.route} ${item.viewport_width}x${item.viewport_height} ${item.theme}${qualitySuffix}`);
      } catch (error) {
        failures.push({ case_id: item.case_id, route: item.route, error: error.message });
        console.error(`Failed ${item.case_id}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const qualityFailures = results
    .filter((result) => result.technical_violations.length)
    .map((result) => ({
      case_id: result.case_id,
      route: result.route,
      violations: result.technical_violations
    }));

  const manifest = {
    schema_version: 3,
    captured_at: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || null,
    commit_sha: process.env.GITHUB_SHA || null,
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    base_url: BASE_URL,
    matrix_path: path.relative(ROOT, MATRIX_PATH),
    output_path: path.relative(ROOT, OUTPUT_DIR),
    browser: 'chromium',
    cases_total: cases.length,
    cases_captured: results.length,
    failures,
    quality_failures: qualityFailures,
    results
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const summary = [
    '# Visual baseline capture',
    '',
    `- Matrix cases: ${cases.length}`,
    `- Captured: ${results.length}`,
    `- Runtime failures: ${failures.length}`,
    `- Quality failures: ${qualityFailures.length}`,
    `- Commit: ${manifest.commit_sha || 'local'}`,
    '',
    'The artifact is capture evidence only. Review screenshots before promoting them to baseline_captured.'
  ].join('\n');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), `${summary}\n`);

  if (failures.length || qualityFailures.length) {
    throw new Error(`Visual baseline capture failed: runtime=${failures.length}, quality=${qualityFailures.length}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
