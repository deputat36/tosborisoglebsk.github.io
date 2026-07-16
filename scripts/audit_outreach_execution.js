const fs = require('fs');
const path = require('path');
const execution = require('../assets/js/outreach-execution');

const ROOT = process.cwd();
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const requireToken = (errors, content, token, label) => {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
};

function main() {
  const errors = [];
  const html = read('outreach-register/index.html');
  const logic = read('assets/js/outreach-execution.js');
  const ui = read('assets/js/outreach-execution-ui.js');
  const docs = read('docs/OUTREACH-EXECUTION-PACKET.md');
  const workflow = read('.github/workflows/outreach-governance.yml');
  const manual = read('scripts/audit_manual_extensions.js');
  const scripts = JSON.parse(read('package.json')).scripts || {};
  const register = execution.parseCsv(read('data/outreach_register.csv'));
  const sources = {
    priority: execution.parseCsv(read('data/priority_tos_requests.csv')),
    candidates: execution.parseCsv(read('data/candidate_registry_requests.csv')),
    projects: execution.parseCsv(read('data/projects_2026_result_requests.csv'))
  };
  const drafts = register.filter((item) => item.status === 'draft');

  if (register.length !== 16) errors.push(`expected 16 register rows, found ${register.length}`);
  if (drafts.length !== 15) errors.push(`expected 15 drafts, found ${drafts.length}`);
  if (sources.priority.length !== 4) errors.push(`expected 4 priority rows, found ${sources.priority.length}`);
  if (sources.candidates.length !== 5) errors.push(`expected 5 candidate rows, found ${sources.candidates.length}`);
  if (sources.projects.length !== 6) errors.push(`expected 6 project rows, found ${sources.projects.length}`);
  drafts.forEach((item) => {
    if (execution.buildRequestText(item, sources).length < 80) errors.push(`${item.outreach_id}: missing request text`);
  });

  [
    'href="#outreach-execution"',
    'id="outreach-execution-root"',
    'Граница доверия:',
    'не отправляет сообщения и не изменяет GitHub',
    '/assets/js/outreach-execution.js',
    '/assets/js/outreach-execution-ui.js'
  ].forEach((token) => requireToken(errors, html, token, 'page'));
  const registerIndex = html.indexOf('/assets/js/outreach-register.js');
  const logicIndex = html.indexOf('/assets/js/outreach-execution.js');
  const uiIndex = html.indexOf('/assets/js/outreach-execution-ui.js');
  if (!(registerIndex >= 0 && logicIndex > registerIndex && uiIndex > logicIndex)) errors.push('invalid script order');

  [
    'buildRequestText',
    'validateExecution',
    'buildUpdatedRow',
    "status: 'sent'",
    'фактическая отправка не подтверждена'
  ].forEach((token) => requireToken(errors, logic, token, 'logic'));
  [
    'localStorage',
    "loadCsv('/data/outreach_register.csv')",
    'Копировать запрос',
    'Скачать карточку подготовки',
    'Скачать строку sent',
    'Запрос действительно отправлен',
    'exportButton.disabled = true'
  ].forEach((token) => requireToken(errors, ui, token, 'ui'));
  [
    'Локальный пакет отправки',
    '15 черновиков',
    'Скачать строку `sent`',
    'не выполняет отправку',
    'не закрывает issue #166'
  ].forEach((token) => requireToken(errors, docs, token, 'docs'));
  [
    "'assets/js/outreach-execution.js'",
    "'assets/js/outreach-execution-ui.js'",
    "'scripts/test_outreach_execution.js'",
    "'scripts/audit_outreach_execution.js'",
    'Test outreach execution packet',
    'Audit outreach execution packet',
    'contents: read'
  ].forEach((token) => requireToken(errors, workflow, token, 'workflow'));
  [
    "['outreach execution packet self-test', 'scripts/test_outreach_execution.js']",
    "['outreach execution packet', 'scripts/audit_outreach_execution.js']"
  ].forEach((token) => requireToken(errors, manual, token, 'manual audit'));

  if (scripts['test:outreach-execution'] !== 'node scripts/test_outreach_execution.js') errors.push('missing test script');
  if (scripts['audit:outreach-execution'] !== 'node scripts/audit_outreach_execution.js') errors.push('missing audit script');
  const auditAll = String(scripts['audit:all'] || '');
  if (!auditAll.includes('npm run test:outreach-execution')) errors.push('audit:all missing execution test');
  if (!auditAll.includes('npm run audit:outreach-execution')) errors.push('audit:all missing execution audit');
  if (/contents:\s*write/i.test(workflow)) errors.push('workflow must remain read-only');

  if (errors.length) throw new Error(`Outreach execution audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Outreach execution packet OK: 15 messages and guarded local export');
}

if (require.main === module) main();