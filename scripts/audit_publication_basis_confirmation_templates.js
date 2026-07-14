const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TEMPLATE_PATH = path.join(ROOT, 'data', 'publication_basis_confirmation_templates.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'publication_basis_review_queue.csv');
const READINESS_PATH = path.join(ROOT, 'data', 'personal_data_readiness.json');
const DOC_PATH = path.join(ROOT, 'docs', 'PUBLICATION-BASIS-CONFIRMATION-PACKET-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');

const EXPECTED_TEMPLATES = new Map([
  [1, ['publication-basis-wave-1', 'classify_channels_and_confirm_publication_scope']],
  [2, ['publication-basis-wave-2', 'confirm_contact_publication_scope']],
  [3, ['publication-basis-wave-3', 'confirm_chairperson_name_publication']]
]);

const REQUIRED_PROHIBITIONS = new Set([
  'create_publication_consent_ref',
  'set_verified',
  'set_partial',
  'publish_new_personal_contact',
  'store_raw_response_in_public_repository'
]);

const FORBIDDEN_RESPONSE_FIELDS = [
  'recipient_name',
  'recipient_phone',
  'recipient_email',
  'raw_response',
  'response_text',
  'screenshot',
  'private_url',
  'signature'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const errors = [];
  const config = JSON.parse(read(TEMPLATE_PATH));
  const readiness = JSON.parse(read(READINESS_PATH));
  const queue = read(QUEUE_PATH);
  const doc = read(DOC_PATH);
  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const projectMode = read(PROJECT_MODE_PATH);
  const projectModeFull = read(PROJECT_MODE_FULL_PATH);
  const workflow = read(WORKFLOW_PATH);

  if (config.schema_version !== 1) errors.push('confirmation templates schema_version must be 1');
  if (config.status !== 'editorial_request_only') errors.push('confirmation templates must remain editorial_request_only');
  if (config.may_create_source_ref !== true) errors.push('confirmation responses may support an opaque factual source_ref');
  if (config.may_create_publication_consent_ref !== false) errors.push('confirmation templates must not create publication_consent_ref');
  if (config.requires_separate_approved_legal_process !== true) errors.push('confirmation templates must require a separate approved legal process');

  const controls = readiness.public_controls || {};
  if (controls.signed_consent_collection_enabled !== false) errors.push('signed consent collection must remain disabled');
  if (readiness.portal_status !== 'pre_legal_readiness') errors.push('confirmation packet is valid only in pre_legal_readiness mode');

  const placeholders = new Set(Array.isArray(config.placeholders) ? config.placeholders : []);
  for (const placeholder of ['[НАЗВАНИЕ ТОС]', '[ССЫЛКА НА КАРТОЧКУ]', '[ПЕРЕЧЕНЬ ТИПОВ ОПУБЛИКОВАННЫХ ПОЛЕЙ]', '[СРОК ОТВЕТА]']) {
    if (!placeholders.has(placeholder)) errors.push(`missing placeholder ${placeholder}`);
  }

  const templates = Array.isArray(config.templates) ? config.templates : [];
  if (templates.length !== 3) errors.push('confirmation packet must contain exactly three wave templates');
  const seenWaves = new Set();
  const seenIds = new Set();
  for (const template of templates) {
    const wave = Number(template.wave);
    const expected = EXPECTED_TEMPLATES.get(wave);
    if (!expected) {
      errors.push(`unexpected template wave ${template.wave}`);
      continue;
    }
    if (seenWaves.has(wave)) errors.push(`duplicate template wave ${wave}`);
    if (seenIds.has(template.id)) errors.push(`duplicate template id ${template.id}`);
    seenWaves.add(wave);
    seenIds.add(template.id);
    if (template.id !== expected[0]) errors.push(`wave ${wave}: unexpected template id`);
    if (template.purpose !== expected[1]) errors.push(`wave ${wave}: purpose does not match queue action`);
    if (!String(template.subject || '').includes('[НАЗВАНИЕ ТОС]')) errors.push(`wave ${wave}: subject must include TOS name placeholder`);

    const message = String(template.message || '');
    for (const token of ['[НАЗВАНИЕ ТОС]', '[ССЫЛКА НА КАРТОЧКУ]', '[СРОК ОТВЕТА]', 'не', 'согласия', 'publication_consent_ref']) {
      if (!message.includes(token)) errors.push(`wave ${wave}: message is missing ${token}`);
    }
    if (wave !== 3 && !message.includes('[ПЕРЕЧЕНЬ ТИПОВ ОПУБЛИКОВАННЫХ ПОЛЕЙ]')) {
      errors.push(`wave ${wave}: message must list published field types`);
    }
    if (/\b(?:даю|предоставляю)\s+согласие\b/i.test(message) || /\bсогласен\s+на\s+(?:обработку|распространение)\b/i.test(message)) {
      errors.push(`wave ${wave}: template must not imitate a consent form`);
    }
    if (/созда(?:ёт|ет|ть)\s+publication_consent_ref\s+(?:автоматически|сразу)/i.test(message) && !/не\s+созда(?:ёт|ет)/i.test(message)) {
      errors.push(`wave ${wave}: template must not promise automatic publication_consent_ref`);
    }
  }
  for (const wave of EXPECTED_TEMPLATES.keys()) {
    if (!seenWaves.has(wave)) errors.push(`missing template for wave ${wave}`);
    if (!queue.includes(`P0-${wave},${wave},`)) errors.push(`review queue does not contain wave ${wave}`);
  }

  const responseFields = new Set(Array.isArray(config.response_fields) ? config.response_fields : []);
  for (const required of ['tos_slug', 'template_id', 'response_status', 'factual_source_ref', 'received_at', 'reviewed_by_role']) {
    if (!responseFields.has(required)) errors.push(`response_fields is missing ${required}`);
  }
  for (const forbidden of FORBIDDEN_RESPONSE_FIELDS) {
    if (responseFields.has(forbidden)) errors.push(`response_fields must not include ${forbidden}`);
  }

  const statuses = new Set(Array.isArray(config.allowed_response_statuses) ? config.allowed_response_statuses : []);
  for (const status of ['draft', 'sent', 'waiting', 'received', 'needs_clarification', 'closed_without_response']) {
    if (!statuses.has(status)) errors.push(`allowed_response_statuses is missing ${status}`);
  }

  const prohibitions = new Set(Array.isArray(config.prohibited_automatic_actions) ? config.prohibited_automatic_actions : []);
  for (const action of REQUIRED_PROHIBITIONS) {
    if (!prohibitions.has(action)) errors.push(`prohibited_automatic_actions is missing ${action}`);
  }

  const serialized = JSON.stringify(config);
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(serialized)) errors.push('confirmation templates must not contain email addresses');
  if (/\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(serialized)) errors.push('confirmation templates must not contain phone numbers');
  if (/https?:\/\/(?!tosborisoglebsk\.ru)/i.test(serialized)) errors.push('confirmation templates must not contain external recipient URLs');

  for (const token of ['не является формой согласия', 'не создаёт `publication_consent_ref` автоматически', 'не содержит контактов', 'Сырая переписка', 'Статусы `sent`, `waiting` и `received` нельзя ставить без реального действия']) {
    if (!doc.includes(token)) errors.push(`confirmation packet documentation is missing: ${token}`);
  }

  const scripts = packageJson.scripts || {};
  if (scripts['audit:publication-basis-confirmation'] !== 'node scripts/audit_publication_basis_confirmation_templates.js') {
    errors.push('package.json must define audit:publication-basis-confirmation');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run audit:publication-basis-confirmation')) {
    errors.push('audit:all must include audit:publication-basis-confirmation');
  }
  for (const [label, content] of [['project-mode', projectMode], ['project-mode-full', projectModeFull]]) {
    if (!content.includes('scripts/audit_publication_basis_confirmation_templates.js')) {
      errors.push(`${label} must include confirmation template audit`);
    }
  }
  if (!workflow.includes('Audit publication basis confirmation templates')) {
    errors.push('main workflow must audit publication basis confirmation templates');
  }

  if (errors.length) {
    throw new Error(`Publication basis confirmation templates audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log('Publication basis confirmation templates OK: three editorial-only wave templates');
}

main();
