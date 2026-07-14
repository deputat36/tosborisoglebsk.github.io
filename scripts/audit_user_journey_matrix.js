const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'user_journey_matrix.csv');
const DOC_PATH = path.join(ROOT, 'docs', 'USER-JOURNEY-TESTING.md');
const VISUAL_MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const SITE_JS_PATH = path.join(ROOT, 'assets', 'js', 'site.js');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

const expectedHeaders = [
  'journey_id',
  'audience',
  'goal',
  'start_route',
  'destination_route',
  'start_token',
  'destination_tokens',
  'interaction',
  'viewport',
  'status',
  'evidence_ref',
  'notes'
];

const expectedJourneys = new Map([
  ['journey-001', { interaction: 'search-and-open', viewport: 'both' }],
  ['journey-002', { interaction: 'open-card', viewport: 'both' }],
  ['journey-003', { interaction: 'build-correction-message', viewport: 'both' }],
  ['journey-004', { interaction: 'choose-project-route', viewport: 'desktop' }],
  ['journey-005', { interaction: 'open-mobile-menu', viewport: 'mobile' }]
]);
const allowedViewports = new Set(['desktop', 'mobile', 'both']);
const allowedStatuses = new Set(['structural_guarded', 'manual_visual_required', 'blocked']);
const errors = [];

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function read(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function routeToIndexPath(route) {
  const pathname = normalize(route).split('#')[0].split('?')[0] || '/';
  if (pathname === '/') return path.join(ROOT, 'index.html');
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const direct = path.join(ROOT, clean);
  if (path.extname(direct)) return direct;
  return path.join(direct, 'index.html');
}

function readRoute(route, context) {
  if (!repoPathExists(route)) {
    errors.push(`${context}: route does not exist ${route}`);
    return '';
  }

  const filePath = routeToIndexPath(route);
  if (!fs.existsSync(filePath)) {
    errors.push(`${context}: route has no readable index file ${path.relative(ROOT, filePath)}`);
    return '';
  }

  const html = fs.readFileSync(filePath, 'utf8');
  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) {
    errors.push(`${context}: public user journey route must not be noindex ${route}`);
  }
  return html;
}

function requireTokens(text, tokens, context) {
  tokens.filter(Boolean).forEach((token) => {
    if (!text.includes(token)) errors.push(`${context}: missing token ${token}`);
  });
}

function auditMobileMenu(siteJs) {
  requireTokens(siteJs, [
    "const menuButton = $('[data-action=menu]')",
    "setAttribute('aria-expanded'",
    "event.key === 'Escape'",
    "classList.toggle('menu-open'",
    "document.body.style.overflow = isOpen ? 'hidden' : ''",
    "if (!nav.contains(event.target) && !menuButton?.contains(event.target)) closeMenu()",
    "nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))"
  ], 'mobile menu');
}

function auditIntegration(packageText, projectMode, projectModeFull, documentation) {
  let packageJson = null;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    errors.push(`package.json is invalid JSON: ${error.message}`);
  }

  if (packageJson) {
    const scripts = packageJson.scripts || {};
    if (scripts['audit:user-journeys'] !== 'node scripts/audit_user_journey_matrix.js') {
      errors.push('package.json must define audit:user-journeys');
    }
    if (!String(scripts['audit:all'] || '').includes('npm run audit:user-journeys')) {
      errors.push('audit:all must include audit:user-journeys');
    }
  }

  requireTokens(projectMode, [
    "['User journey matrix', 'scripts/audit_user_journey_matrix.js']"
  ], 'project-mode audit');
  requireTokens(projectModeFull, [
    "['User journey matrix audit', 'scripts/audit_user_journey_matrix.js']"
  ], 'full project-mode audit');

  requireTokens(documentation, [
    'data/user_journey_matrix.csv',
    'scripts/audit_user_journey_matrix.js',
    'data/css_regression_matrix.csv',
    'Структурный аудит',
    'не подтверждает опубликованные в ней сведения',
    'не считать структурный smoke доказательством актуальности данных'
  ], 'user journey documentation');
}

const matrixText = read(MATRIX_PATH, 'user journey matrix');
const documentation = read(DOC_PATH, 'user journey documentation');
read(VISUAL_MATRIX_PATH, 'visual regression matrix');
const siteJs = read(SITE_JS_PATH, 'site JavaScript');
const packageText = read(PACKAGE_PATH, 'package.json');
const projectMode = read(PROJECT_MODE_PATH, 'project-mode audit');
const projectModeFull = read(PROJECT_MODE_FULL_PATH, 'full project-mode audit');

if (!matrixText) {
  throw new Error(`User journey audit failed:\n${errors.join('\n')}`);
}

const rows = parseCsv(matrixText);
const headers = (rows[0] || []).map(normalize);
if (headers.join('|') !== expectedHeaders.join('|')) {
  errors.push(`unexpected headers: ${headers.join(', ')}`);
}

const journeys = rows.slice(1).filter((row) => row.some((value) => normalize(value)));
if (journeys.length !== expectedJourneys.size) {
  errors.push(`matrix must contain exactly ${expectedJourneys.size} journeys, found ${journeys.length}`);
}

const seenIds = new Set();
const seenRoutePairs = new Set();
const seenInteractions = new Set();
const seenAudiences = new Set();
const seenViewports = new Set();

journeys.forEach((row, index) => {
  const line = `user journey row ${index + 2}`;
  const values = expectedHeaders.map((_, columnIndex) => normalize(row[columnIndex]));
  const [
    journeyId,
    audience,
    goal,
    startRoute,
    destinationRoute,
    startToken,
    destinationTokensRaw,
    interaction,
    viewport,
    status,
    evidenceRef,
    notes
  ] = values;

  if (!/^journey-\d{3}$/.test(journeyId)) errors.push(`${line}: invalid journey_id ${journeyId}`);
  if (seenIds.has(journeyId)) errors.push(`${line}: duplicate journey_id ${journeyId}`);
  if (journeyId) seenIds.add(journeyId);

  const expected = expectedJourneys.get(journeyId);
  if (!expected) errors.push(`${line}: unexpected journey ${journeyId}`);
  if (expected && interaction !== expected.interaction) {
    errors.push(`${line}: ${journeyId} interaction must be ${expected.interaction}`);
  }
  if (expected && viewport !== expected.viewport) {
    errors.push(`${line}: ${journeyId} viewport must be ${expected.viewport}`);
  }

  if (!audience) errors.push(`${line}: missing audience`);
  else seenAudiences.add(audience);
  if (!goal) errors.push(`${line}: missing goal`);
  if (!startRoute || !startRoute.startsWith('/')) errors.push(`${line}: invalid start_route ${startRoute}`);
  if (!destinationRoute || !destinationRoute.startsWith('/')) errors.push(`${line}: invalid destination_route ${destinationRoute}`);
  if (!startToken) errors.push(`${line}: missing start_token`);
  if (!destinationTokensRaw) errors.push(`${line}: missing destination_tokens`);
  if (!interaction) errors.push(`${line}: missing interaction`);
  else seenInteractions.add(interaction);
  if (!allowedViewports.has(viewport)) errors.push(`${line}: unsupported viewport ${viewport}`);
  else seenViewports.add(viewport);
  if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
  if (status !== 'structural_guarded') errors.push(`${line}: current required journeys must be structural_guarded`);
  if (evidenceRef !== 'scripts/audit_user_journey_matrix.js') {
    errors.push(`${line}: structural_guarded requires scripts/audit_user_journey_matrix.js as evidence_ref`);
  }
  if (!notes || notes.length < 30) errors.push(`${line}: notes must explain limits of the evidence`);

  const routePair = `${startRoute}|${destinationRoute}|${interaction}`;
  if (seenRoutePairs.has(routePair)) errors.push(`${line}: duplicate route and interaction combination ${routePair}`);
  seenRoutePairs.add(routePair);

  const destinationTokens = destinationTokensRaw.split('||').map(normalize).filter(Boolean);
  if (destinationTokens.length < 2) errors.push(`${line}: destination_tokens must contain at least two observable tokens`);

  const startHtml = readRoute(startRoute, `${line} start`);
  const destinationHtml = readRoute(destinationRoute, `${line} destination`);
  if (startHtml && startToken && !startHtml.includes(startToken)) {
    errors.push(`${line}: start route ${startRoute} is missing token ${startToken}`);
  }
  if (destinationHtml) requireTokens(destinationHtml, destinationTokens, `${line} destination ${destinationRoute}`);
});

expectedJourneys.forEach((_, journeyId) => {
  if (!seenIds.has(journeyId)) errors.push(`missing required journey ${journeyId}`);
});
if (![...seenAudiences].some((audience) => audience.includes('Житель'))) {
  errors.push('matrix must contain a resident journey');
}
if (![...seenAudiences].some((audience) => audience.includes('Председатель'))) {
  errors.push('matrix must contain a chairperson journey');
}
if (!seenViewports.has('mobile') || !seenViewports.has('desktop') || !seenViewports.has('both')) {
  errors.push('matrix must cover mobile, desktop and both viewports');
}
['search-and-open', 'open-card', 'build-correction-message', 'choose-project-route', 'open-mobile-menu'].forEach((interaction) => {
  if (!seenInteractions.has(interaction)) errors.push(`matrix must contain interaction ${interaction}`);
});

auditMobileMenu(siteJs);
auditIntegration(packageText, projectMode, projectModeFull, documentation);

if (errors.length) {
  throw new Error(`User journey audit failed:\n${errors.join('\n')}`);
}

console.log(`User journey matrix OK: ${journeys.length} journeys, ${seenInteractions.size} interactions, public routes and mobile menu guarded`);
