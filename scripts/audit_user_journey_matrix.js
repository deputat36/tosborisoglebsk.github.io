const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const MATRIX_PATH = path.join(ROOT, 'data', 'user_journey_matrix.csv');
const DOC_PATH = path.join(ROOT, 'docs', 'USER-JOURNEY-TESTING.md');
const SITE_JS_PATH = path.join(ROOT, 'assets', 'js', 'site.js');

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

const allowedViewports = new Set(['desktop', 'mobile', 'both']);
const allowedStatuses = new Set(['structural_guarded', 'manual_visual_required', 'blocked']);
const requiredJourneyIds = new Set([
  'journey-001',
  'journey-002',
  'journey-003',
  'journey-004',
  'journey-005'
]);

function normalize(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function routeToIndexPath(route) {
  const pathname = normalize(route).split('#')[0].split('?')[0] || '/';
  if (pathname === '/') return path.join(ROOT, 'index.html');
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const direct = path.join(ROOT, clean);
  if (path.extname(direct)) return direct;
  return path.join(direct, 'index.html');
}

function readRoute(route, errors, context) {
  if (!repoPathExists(route)) {
    errors.push(`${context}: route does not exist ${route}`);
    return '';
  }

  const filePath = routeToIndexPath(route);
  if (!fs.existsSync(filePath)) {
    errors.push(`${context}: route has no readable index file ${path.relative(ROOT, filePath)}`);
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(html, tokens, errors, context) {
  tokens.filter(Boolean).forEach((token) => {
    if (!html.includes(token)) errors.push(`${context}: missing token ${token}`);
  });
}

function auditMobileMenu(siteJs, errors) {
  const tokens = [
    "[data-action=menu]",
    "setAttribute('aria-expanded'",
    "event.key === 'Escape'",
    "classList.toggle('menu-open'",
    "document.body.style.overflow",
    "nav?.classList.toggle('open')"
  ];

  requireTokens(siteJs, tokens, errors, 'mobile menu');
}

function main() {
  const errors = [];

  [MATRIX_PATH, DOC_PATH, SITE_JS_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });

  if (errors.length) throw new Error(`User journey audit failed:\n${errors.join('\n')}`);

  const rows = parseCsv(fs.readFileSync(MATRIX_PATH, 'utf8'));
  const headers = (rows[0] || []).map(normalize);
  const docText = fs.readFileSync(DOC_PATH, 'utf8');
  const siteJs = fs.readFileSync(SITE_JS_PATH, 'utf8');

  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  if (rows.length < 6) errors.push('matrix must contain at least 5 user journeys');

  const seenIds = new Set();
  const seenAudiences = new Set();
  const seenViewports = new Set();
  const seenInteractions = new Set();

  rows.slice(1).forEach((row, index) => {
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
      evidenceRef
    ] = values;

    if (!/^journey-\d{3}$/.test(journeyId)) errors.push(`${line}: invalid journey_id ${journeyId}`);
    if (seenIds.has(journeyId)) errors.push(`${line}: duplicate journey_id ${journeyId}`);
    if (journeyId) seenIds.add(journeyId);

    if (!audience) errors.push(`${line}: missing audience`);
    if (audience) seenAudiences.add(audience);
    if (!goal) errors.push(`${line}: missing goal`);
    if (!startRoute || !startRoute.startsWith('/')) errors.push(`${line}: invalid start_route ${startRoute}`);
    if (!destinationRoute || !destinationRoute.startsWith('/')) errors.push(`${line}: invalid destination_route ${destinationRoute}`);
    if (!startToken) errors.push(`${line}: missing start_token`);
    if (!destinationTokensRaw) errors.push(`${line}: missing destination_tokens`);
    if (!interaction) errors.push(`${line}: missing interaction`);
    if (interaction) seenInteractions.add(interaction);
    if (!allowedViewports.has(viewport)) errors.push(`${line}: unsupported viewport ${viewport}`);
    if (viewport) seenViewports.add(viewport);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (status === 'structural_guarded' && evidenceRef !== 'scripts/audit_user_journey_matrix.js') {
      errors.push(`${line}: structural_guarded requires scripts/audit_user_journey_matrix.js as evidence_ref`);
    }

    const startHtml = readRoute(startRoute, errors, `${line} start`);
    const destinationHtml = readRoute(destinationRoute, errors, `${line} destination`);

    if (startHtml && startToken && !startHtml.includes(startToken)) {
      errors.push(`${line}: start route ${startRoute} is missing token ${startToken}`);
    }

    if (destinationHtml) {
      requireTokens(destinationHtml, destinationTokensRaw.split('||').map(normalize), errors, `${line} destination ${destinationRoute}`);
    }
  });

  requiredJourneyIds.forEach((journeyId) => {
    if (!seenIds.has(journeyId)) errors.push(`missing required journey ${journeyId}`);
  });

  if (![...seenAudiences].some((audience) => audience.includes('Житель'))) {
    errors.push('matrix must contain a resident journey');
  }
  if (![...seenAudiences].some((audience) => audience.includes('Председатель'))) {
    errors.push('matrix must contain a chairperson journey');
  }
  if (!seenViewports.has('mobile') && !seenViewports.has('both')) {
    errors.push('matrix must cover a mobile viewport');
  }
  if (!seenInteractions.has('open-mobile-menu')) errors.push('matrix must contain the mobile menu journey');
  if (!seenInteractions.has('build-correction-message')) errors.push('matrix must contain the correction message journey');
  if (!seenInteractions.has('choose-project-route')) errors.push('matrix must contain the project route journey');

  auditMobileMenu(siteJs, errors);

  if (!docText.includes('data/user_journey_matrix.csv')) {
    errors.push('user journey documentation must reference data/user_journey_matrix.csv');
  }
  if (!docText.includes('scripts/audit_user_journey_matrix.js')) {
    errors.push('user journey documentation must reference scripts/audit_user_journey_matrix.js');
  }
  if (!docText.includes('data/css_regression_matrix.csv')) {
    errors.push('user journey documentation must distinguish the visual regression matrix');
  }

  if (errors.length) {
    throw new Error(`User journey audit failed:\n${errors.join('\n')}`);
  }

  console.log(`User journey matrix OK: ${rows.length - 1} journeys, ${seenInteractions.size} interactions`);
}

main();
