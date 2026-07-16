const fs = require('fs');
const path = require('path');
const execution = require('../assets/js/publication-basis-execution');

const ROOT = process.cwd();
const paths = {
  page: 'publication-basis-review/index.html',
  core: 'assets/js/publication-basis-execution.js',
  ui: 'assets/js/publication-basis-execution-ui.js',
  doc: 'docs/PUBLICATION-BASIS-EXECUTION-WORKSPACE.md',
  workflow: '.github/workflows/publication-basis-execution-audit.yml',
  manual: 'scripts/audit_manual_extensions.js',
  package: 'package.json',
  register: 'data/publication_basis_confirmation_register.csv',
  queue: 'data/publication_basis_review_queue.csv',
  templates: 'data/publication_basis_confirmation_templates.json',
  tos: 'data/tos.json'
};

function read(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(full, 'utf8');
}

function requireTokens(errors, content, label, tokens) {
  tokens.forEach((token) => {
    if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
  });
}

function main() {
  const errors = [];
  const page = read(paths.page);
  const core = read(paths.core);
  const ui = read(paths.ui);
  const doc = read(paths.doc);
  const workflow = read(paths.workflow);
  const manual = read(paths.manual);
  const packageJson = read(paths.package);
  const register = execution.parseCsv(read(paths.register));
  const queue = execution.parseCsv(read(paths.queue));
  const templates = JSON.parse(read(paths.templates));
  const tos = JSON.parse(read(paths.tos));

  const queueBySlug = execution.indexBy(queue, 'slug');
  const templatesById = execution.indexBy(templates.templates || [], 'id');
  const tosBySlug = execution.indexBy(tos, 'id');

  if (register.length !== 24) errors.push(`register must contain 24 rows, found ${register.length}`);
  if (register.some((item) => item.request_status !== 'draft')) errors.push('canonical register must remain draft in this technical change');

  register.forEach((item) => {
    const packet = execution.buildRequestPacket(item, queueBySlug.get(item.tos_slug), tosBySlug.get(item.tos_slug), templatesById.get(item.template_id), '2026-07-30');
    if (!packet) errors.push(`${item.tos_slug}: request packet is not resolved`);
    else if (/\[(?:НАЗВАНИЕ ТОС|ССЫЛКА НА КАРТОЧКУ|ПЕРЕЧЕНЬ ТИПОВ ОПУБЛИКОВАННЫХ ПОЛЕЙ|СРОК ОТВЕТА)\]/.test(packet.subject + packet.message)) {
      errors.push(`${item.tos_slug}: request packet keeps a placeholder`);
    }
  });

  requireTokens(errors, page, paths.page, [
    'id="publication-basis-execution-root"',
    'href="/docs/PUBLICATION-BASIS-EXECUTION-WORKSPACE.md"',
    '/assets/js/publication-basis-execution.js',
    '/assets/js/publication-basis-execution-ui.js'
  ]);
  const validationIndex = page.indexOf('/assets/js/publication-basis-validation.js');
  const registerIndex = page.indexOf('/assets/js/publication-basis-register.js');
  const coreIndex = page.indexOf('/assets/js/publication-basis-execution.js');
  const uiIndex = page.indexOf('/assets/js/publication-basis-execution-ui.js');
  if (!(validationIndex >= 0 && registerIndex > validationIndex && coreIndex > registerIndex && uiIndex > coreIndex)) {
    errors.push('execution scripts must load after validation/register in core/ui order');
  }

  requireTokens(errors, core, paths.core, [
    'REGISTER_HEADERS', 'buildRequestPacket', 'buildPreflightText', 'validateExecution',
    'serializeUpdatedRow', 'actual_sent', 'publication_consent_ref'
  ]);
  if (/\.contacts\b|\.chair\b/.test(core)) errors.push('execution core must not read personal contacts or chairperson value from tos.json');

  requireTokens(errors, ui, paths.ui, [
    "const STORAGE_KEY = 'tos-publication-basis-execution-v1'",
    "loadCsv('/data/publication_basis_confirmation_register.csv')",
    "loadCsv('/data/publication_basis_review_queue.csv')",
    "loadJson('/data/publication_basis_confirmation_templates.json')",
    "loadJson('/data/tos.json')",
    'Редакционный запрос действительно отправлен',
    'Скачать строку sent',
    'localStorage',
    'new Blob'
  ]);
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/is.test(ui) || /XMLHttpRequest|sendBeacon|WebSocket/.test(ui)) {
    errors.push('execution UI must remain local-only and must not contain network writes');
  }

  requireTokens(errors, doc, paths.doc, [
    'Пакет не отправляет сообщения',
    'кнопка экспорта строки `sent` заблокирована',
    '`decision_status` остаётся `not_reviewed`',
    'не создают `publication_consent_ref` автоматически',
    '`tos-publication-basis-execution-v1`',
    'Автоматический аудит подтверждает только целостность инструмента'
  ]);

  requireTokens(errors, workflow, paths.workflow, [
    'assets/js/publication-basis-execution.js',
    'assets/js/publication-basis-execution-ui.js',
    'scripts/test_publication_basis_execution_workspace.js',
    'scripts/audit_publication_basis_execution_workspace.js',
    'Test publication basis execution workspace',
    'Audit publication basis execution workspace',
    'contents: read'
  ]);
  if (/contents:\s*write/i.test(workflow)) errors.push('workflow must remain read-only');

  requireTokens(errors, manual, paths.manual, [
    'scripts/test_publication_basis_execution_workspace.js',
    'scripts/audit_publication_basis_execution_workspace.js'
  ]);
  requireTokens(errors, packageJson, paths.package, [
    'test:publication-basis-execution-workspace',
    'audit:publication-basis-execution-workspace'
  ]);

  if (errors.length) throw new Error(`Publication basis execution workspace audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  console.log('Publication basis execution workspace OK: 24 packets, local-only UI, guarded sent export');
}

main();
