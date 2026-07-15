const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_NAV = [
  '/tos/',
  '/residents/',
  '/chairperson/',
  '/projects/',
  '/documents/',
  '/contacts/',
  '/sections/'
];
const FORBIDDEN_PUBLIC_SERVICE_ROUTES = [
  '/workbench/',
  '/site-health/',
  '/data-requests/',
  '/verification-tasks/',
  '/publication-queue/',
  '/collection-board/'
];

function extractHeaderNav(html) {
  const match = html.match(/<nav class="nav" id="site-nav"[\s\S]*?<\/nav>/);
  return match ? match[0] : '';
}

function extractHrefs(html) {
  return Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);
}

function auditAutonomousP0Plan({ planText, indexHtml, workbenchHtml }) {
  const errors = [];
  const requireToken = (text, token, label) => {
    if (!text.includes(token)) errors.push(`${label}: missing token ${token}`);
  };

  requireToken(planText, 'Последнее обновление: 15 июля 2026 года.', 'plan update date');
  requireToken(planText, 'Автономно завершены технические этапы A–H.', 'A-H completion');
  requireToken(planText, '## Этап H. Упрощение публичной оболочки', 'stage H heading');
  requireToken(planText, 'Статус: `done`.', 'completed stage status');
  requireToken(planText, 'Автономная техническая часть P0 завершена.', 'technical boundary');
  requireToken(planText, 'issue #34', 'priority cards blocker');
  requireToken(planText, 'issue #164', 'Pages blocker');
  requireToken(planText, 'issue #166', 'outreach blocker');
  requireToken(planText, 'issue #254', 'publication basis blocker');
  requireToken(planText, 'определять оператора персональных данных', 'operator boundary');
  requireToken(planText, 'отправлять сообщения от имени портала без отдельного разрешения', 'outreach boundary');

  const forbiddenPlanClaims = [
    'Статус: `next_autonomous_stage`.',
    'Следующий автономный этап — H',
    'сократить главное меню до 6–7 пользовательских разделов'
  ];
  for (const claim of forbiddenPlanClaims) {
    if (planText.includes(claim)) errors.push(`stale plan claim is forbidden: ${claim}`);
  }

  const nav = extractHeaderNav(indexHtml);
  if (!nav) {
    errors.push('main page header navigation is missing');
  } else {
    const hrefs = extractHrefs(nav);
    if (hrefs.length !== EXPECTED_NAV.length) {
      errors.push(`main navigation must contain exactly ${EXPECTED_NAV.length} links, found ${hrefs.length}`);
    }
    EXPECTED_NAV.forEach((href, index) => {
      if (hrefs[index] !== href) {
        errors.push(`main navigation link ${index + 1} must be ${href}, found ${hrefs[index] || 'missing'}`);
      }
    });
    for (const route of FORBIDDEN_PUBLIC_SERVICE_ROUTES) {
      if (hrefs.some((href) => href.startsWith(route))) {
        errors.push(`service route must not be present in main navigation: ${route}`);
      }
    }
    if (hrefs.includes('/map/')) errors.push('empty map route must not be present in main navigation');
  }

  const mainHero = indexHtml.match(/<section class="hero">[\s\S]*?<\/section>/)?.[0] || '';
  if (!mainHero) errors.push('main hero section is missing');
  if (mainHero.includes('href="/map/"')) errors.push('empty map route must not be promoted in main hero');
  requireToken(indexHtml, 'id="primary-actions"', 'primary actions section');
  requireToken(indexHtml, '<h2>Состояние каталога</h2>', 'catalog state section');
  requireToken(indexHtml, 'data-portal-working-status', 'working catalog status');

  requireToken(workbenchHtml, '<div class="eyebrow">Рабочая панель</div>', 'workbench role marker');
  requireToken(workbenchHtml, '<h1>Инструменты развития портала ТОС БГО</h1>', 'workbench heading');
  requireToken(workbenchHtml, '/site-health/', 'workbench site health link');
  requireToken(workbenchHtml, '/verification-tasks/', 'workbench verification tasks link');

  return errors;
}

function runCli() {
  const planText = fs.readFileSync(path.join(ROOT, 'docs', 'AUTONOMOUS-P0-PLAN-2026-07-12.md'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const workbenchHtml = fs.readFileSync(path.join(ROOT, 'workbench', 'index.html'), 'utf8');
  const errors = auditAutonomousP0Plan({ planText, indexHtml, workbenchHtml });

  if (errors.length) {
    console.error('Autonomous P0 plan status audit failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Autonomous P0 plan status audit OK: stages A-H are complete and public-shell boundaries match the main branch');
}

if (require.main === module) runCli();

module.exports = {
  EXPECTED_NAV,
  FORBIDDEN_PUBLIC_SERVICE_ROUTES,
  auditAutonomousP0Plan,
  extractHeaderNav,
  extractHrefs
};
