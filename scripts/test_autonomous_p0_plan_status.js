const assert = require('assert');
const { auditAutonomousP0Plan, EXPECTED_NAV } = require('./audit_autonomous_p0_plan_status');

const plan = `# Автономный план P0 для портала ТОС БГО

Последнее обновление: 15 июля 2026 года.

Автономно завершены технические этапы A–H.

## Этап H. Упрощение публичной оболочки

Статус: \`done\`.

Автономная техническая часть P0 завершена.

Внешние задачи: issue #34, issue #164, issue #166, issue #254.
Нельзя определять оператора персональных данных.
Нельзя отправлять сообщения от имени портала без отдельного разрешения.
`;

const nav = EXPECTED_NAV.map((href) => `<a href="${href}">Раздел</a>`).join('');
const indexHtml = `<nav class="nav" id="site-nav" aria-label="Навигация">${nav}</nav>
<section class="hero"><a href="/tos/">Каталог</a></section>
<section id="primary-actions"></section>
<h2>Состояние каталога</h2>
<section data-portal-working-status></section>`;
const workbenchHtml = `<div class="eyebrow">Рабочая панель</div>
<h1>Инструменты развития портала ТОС БГО</h1>
<a href="/site-health/">Аудит</a>
<a href="/verification-tasks/">Задачи</a>`;

const validErrors = auditAutonomousP0Plan({ planText: plan, indexHtml, workbenchHtml });
assert.deepStrictEqual(validErrors, [], `Valid P0 fixture failed:\n${validErrors.join('\n')}`);

const stalePlan = plan.replace('Статус: `done`.', 'Статус: `next_autonomous_stage`.');
const staleErrors = auditAutonomousP0Plan({ planText: stalePlan, indexHtml, workbenchHtml });
assert(staleErrors.some((error) => error.includes('next_autonomous_stage')), 'Stale stage H status must be rejected.');

const serviceNav = indexHtml.replace('</nav>', '<a href="/workbench/">Рабочая панель</a></nav>');
const serviceErrors = auditAutonomousP0Plan({ planText: plan, indexHtml: serviceNav, workbenchHtml });
assert(serviceErrors.some((error) => error.includes('service route')), 'Service route in public nav must be rejected.');

const mapHero = indexHtml.replace('<a href="/tos/">', '<a href="/map/">');
const mapErrors = auditAutonomousP0Plan({ planText: plan, indexHtml: mapHero, workbenchHtml });
assert(mapErrors.some((error) => error.includes('empty map route')), 'Map promoted in hero must be rejected.');

const missingWorkbench = workbenchHtml.replace('/verification-tasks/', '/missing-route/');
const workbenchErrors = auditAutonomousP0Plan({ planText: plan, indexHtml, workbenchHtml: missingWorkbench });
assert(workbenchErrors.some((error) => error.includes('workbench verification tasks')), 'Missing workbench tool link must be rejected.');

console.log('Autonomous P0 plan status self-test OK');
