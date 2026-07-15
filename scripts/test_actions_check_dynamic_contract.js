const assert = require('assert');
const fs = require('fs');
const {
  buildPage,
  countStatuses,
  detectTriggers,
  diagnosticsRows,
  formatDate,
  latestIsoDate
} = require('./generate_actions_check_page');

const health = {
  generated_at: '2026-07-14T10:15:00.000Z',
  pages: {
    total: 412,
    public: 350,
    noindex: 62,
    seo_warnings_count: 1,
    broken_internal_links_count: 2
  }
};

const diagnostics = [
  'check_id,group,subject,result,evidence,status,next_action,checked_at',
  'actions-001,repo,Репозиторий,Проверен,Исторический commit 1111111111111111111111111111111111111111,passed,Продолжать проверку,2026-07-01',
  'actions-002,runs,Запуск,Требует проверки,workflow_runs warning,warning,Проверить Actions UI,2026-07-03',
  'actions-003,manual-check,Pages,Ожидает проверки,Deployment UI,pending,Открыть Pages,2026-07-02'
].join('\n');

const workflow = `name: Test

on:
  workflow_dispatch:
  pull_request:
  push:

jobs:
  test:
    runs-on: ubuntu-latest
`;

const rows = diagnosticsRows(diagnostics);
const statuses = countStatuses(rows);
const triggers = detectTriggers(workflow);
const html = buildPage({ health, diagnostics, workflow });

assert.strictEqual(rows.length, 3);
assert.deepStrictEqual(statuses, { passed: 1, warning: 1, pending: 1, failed: 0, blocked: 0 });
assert.deepStrictEqual(triggers.map((item) => item.key), ['workflow_dispatch', 'pull_request', 'push']);
assert.strictEqual(latestIsoDate(rows), '2026-07-03');
assert.strictEqual(formatDate('2026-07-03'), '3 июля 2026 года');

for (const marker of [
  'data-actions-pages-total>412<',
  'data-actions-pages-public>350<',
  'data-actions-pages-noindex>62<',
  'data-actions-seo-warnings>1<',
  'data-actions-broken-links>2<',
  'data-actions-diagnostics-total>3<',
  'data-actions-status-warning>1<',
  'data-actions-status-pending>1<',
  '3 июля 2026 года',
  'ручной запуск, pull request, push в рабочую ветку'
]) {
  assert.ok(html.includes(marker), `generated HTML is missing ${marker}`);
}

for (const staleValue of [
  'Итог проверки на 2 июля 2026 года',
  '369 HTML-страниц',
  '1111111111111111111111111111111111111111',
  'расписание'
]) {
  assert.ok(!html.includes(staleValue), `generated HTML leaked stale value: ${staleValue}`);
}

assert.throws(
  () => buildPage({ health: { generated_at: health.generated_at, pages: { ...health.pages, total: -1 } }, diagnostics, workflow }),
  /non-negative integer/
);
assert.throws(
  () => buildPage({ health, diagnostics: 'check_id,group\n', workflow }),
  /no checked_at values/
);
assert.throws(
  () => buildPage({ health, diagnostics, workflow: 'name: missing triggers\n' }),
  /No workflow triggers detected/
);

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const auditAll = packageJson.scripts && packageJson.scripts['audit:all'];
assert.ok(typeof auditAll === 'string', 'package.json must define audit:all');

const healthIndex = auditAll.indexOf('npm run report:health');
const actionsCheckIndex = auditAll.indexOf('npm run generate:actions-check');
const projectModeIndex = auditAll.indexOf('npm run audit:project-mode');

assert.ok(healthIndex >= 0, 'audit:all must generate site health');
assert.ok(actionsCheckIndex > healthIndex, 'audit:all must regenerate actions-check after site health');
assert.ok(projectModeIndex > actionsCheckIndex, 'audit:all must regenerate actions-check before project-mode');

console.log('Actions check dynamic contract self-test OK');
