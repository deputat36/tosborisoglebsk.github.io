const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const READINESS_PATH = path.join(ROOT, 'data', 'personal_data_readiness.json');
const POLICY_PATH = path.join(ROOT, 'data', 'private_evidence_reference_policy.json');
const PRIVACY_PATH = path.join(ROOT, 'privacy', 'index.html');
const STORAGE_DOC_PATH = path.join(ROOT, 'docs', 'PRIVATE-EVIDENCE-STORAGE.md');
const READINESS_DOC_PATH = path.join(ROOT, 'docs', 'PERSONAL-DATA-READINESS-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');

const REQUIRED_DECISIONS = new Set([
  'operator_assignment',
  'purposes_and_data_categories',
  'processing_and_distribution_basis',
  'distribution_consent_form',
  'media_permission_form',
  'withdrawal_correction_and_deletion_process',
  'private_evidence_storage',
  'retention_access_and_incident_rules'
]);

const ALLOWED_DECISION_STATUSES = new Set(['pending', 'in_review', 'blocked', 'approved']);
const REQUIRED_PRIVACY_PHRASES = [
  'Юридически утверждённая политика обработки персональных данных пока не опубликована',
  'Оператор портала пока не определён',
  'редакционная памятка, а не юридически утверждённая политика',
  'не является согласием на обработку или распространение персональных данных',
  'оригиналы согласий и закрытые доказательства нельзя загружать в публичный GitHub',
  'Отзыв, исправление и удаление',
  'Отдельный юридически проверенный порядок пока не утверждён',
  '/update-tos/?type=card#message-builder',
  '/contacts/'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function main() {
  const errors = [];
  const readiness = JSON.parse(read(READINESS_PATH));
  const policy = JSON.parse(read(POLICY_PATH));
  const privacy = read(PRIVACY_PATH);
  const storageDoc = read(STORAGE_DOC_PATH);
  const readinessDoc = read(READINESS_DOC_PATH);
  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const projectMode = read(PROJECT_MODE_PATH);
  const projectModeFull = read(PROJECT_MODE_FULL_PATH);
  const workflow = read(WORKFLOW_PATH);

  if (readiness.schema_version !== 1) errors.push('personal data readiness schema_version must be 1');
  if (readiness.portal_status !== 'pre_legal_readiness') {
    errors.push('portal_status must remain pre_legal_readiness until all required decisions are approved');
  }

  const operator = readiness.operator || {};
  if (!['pending', 'approved'].includes(operator.status)) {
    errors.push('operator.status must be pending or approved');
  }
  if (operator.status === 'approved') {
    for (const field of ['public_name', 'legal_status', 'decision_ref', 'approved_at', 'approved_by']) {
      if (!nonEmpty(operator[field])) errors.push(`approved operator requires ${field}`);
    }
  } else {
    if (nonEmpty(operator.public_name) || nonEmpty(operator.decision_ref) || nonEmpty(operator.approved_at)) {
      errors.push('pending operator must not expose incomplete approval metadata');
    }
  }

  const controls = readiness.public_controls || {};
  const expectedControls = {
    privacy_page_role: 'editorial_guidance_not_legal_policy',
    personal_data_collection_enabled: false,
    signed_consent_collection_enabled: false,
    private_evidence_in_public_repository: false,
    automatic_publication_from_submissions: false
  };
  for (const [key, expected] of Object.entries(expectedControls)) {
    if (controls[key] !== expected) errors.push(`public_controls.${key} must be ${JSON.stringify(expected)}`);
  }

  const decisions = Array.isArray(readiness.decisions) ? readiness.decisions : [];
  if (decisions.length !== REQUIRED_DECISIONS.size) {
    errors.push(`personal data readiness must contain exactly ${REQUIRED_DECISIONS.size} decisions`);
  }

  const ids = new Set();
  for (const decision of decisions) {
    const id = String(decision && decision.id || '').trim();
    if (!id) {
      errors.push('personal data decision is missing id');
      continue;
    }
    if (ids.has(id)) errors.push(`duplicate personal data decision ${id}`);
    ids.add(id);
    if (!REQUIRED_DECISIONS.has(id)) errors.push(`unexpected personal data decision ${id}`);
    if (!ALLOWED_DECISION_STATUSES.has(decision.status)) {
      errors.push(`${id}: invalid status ${decision.status}`);
    }
    if (!nonEmpty(decision.required_before)) errors.push(`${id}: required_before is missing`);
    if (!nonEmpty(decision.notes)) errors.push(`${id}: notes are missing`);

    if (decision.status === 'approved') {
      for (const field of ['decision_ref', 'legal_review_ref', 'approved_at', 'approved_by']) {
        if (!nonEmpty(decision[field])) errors.push(`${id}: approved decision requires ${field}`);
      }
      if (!/^decision:[a-z0-9][a-z0-9._:-]*$/i.test(String(decision.decision_ref || ''))) {
        errors.push(`${id}: decision_ref must be an opaque decision: reference`);
      }
      if (!/^evidence:[a-z0-9][a-z0-9._:-]*$/i.test(String(decision.legal_review_ref || ''))) {
        errors.push(`${id}: legal_review_ref must be an opaque evidence: reference`);
      }
    } else {
      for (const field of ['decision_ref', 'legal_review_ref', 'approved_at', 'approved_by']) {
        if (nonEmpty(decision[field])) errors.push(`${id}: ${field} must stay empty until approval`);
      }
    }
  }

  for (const id of REQUIRED_DECISIONS) {
    if (!ids.has(id)) errors.push(`missing personal data decision ${id}`);
  }

  if (operator.status !== 'approved') {
    if (controls.personal_data_collection_enabled !== false) errors.push('personal data collection must stay disabled before operator approval');
    if (controls.signed_consent_collection_enabled !== false) errors.push('signed consent collection must stay disabled before operator approval');
  }

  if (policy.repository_visibility !== 'public') errors.push('private evidence policy must declare public repository visibility');
  if (policy.storage_rule !== 'private_evidence_outside_repository') errors.push('private evidence must remain outside the repository');
  if (!(policy.private_storage_requirements || []).includes('operator_assignment')) {
    errors.push('private evidence policy must require operator_assignment');
  }

  for (const phrase of REQUIRED_PRIVACY_PHRASES) {
    if (!privacy.includes(phrase)) errors.push(`privacy/index.html is missing required phrase: ${phrase}`);
  }
  if (/<form\b/i.test(privacy)) errors.push('privacy/index.html must not contain an active form before legal readiness');
  if (/действующ(?:ая|ей)\s+политик(?:а|и)\s+обработки\s+персональных\s+данных/i.test(privacy)) {
    errors.push('privacy/index.html must not claim that a formal personal data policy is already in force');
  }
  if (/форма\s+согласия\s+(?:утверждена|действует)/i.test(privacy)) {
    errors.push('privacy/index.html must not claim that a consent form is approved');
  }

  for (const token of ['pre_legal_readiness', 'восемь решений', 'не является согласием', 'не заменяет юридическую проверку']) {
    if (!readinessDoc.includes(token)) errors.push(`readiness documentation is missing ${token}`);
  }
  for (const token of ['Репозиторий портала публичный', 'Этот закрытый реестр не создаётся', 'Портал пока не имеет юридически утверждённых форм согласий']) {
    if (!storageDoc.includes(token)) errors.push(`private evidence documentation is missing ${token}`);
  }

  const scripts = packageJson.scripts || {};
  if (scripts['audit:personal-data-readiness'] !== 'node scripts/audit_personal_data_readiness.js') {
    errors.push('package.json must define audit:personal-data-readiness');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run audit:personal-data-readiness')) {
    errors.push('audit:all must include audit:personal-data-readiness');
  }
  for (const [label, content] of [['project-mode', projectMode], ['project-mode-full', projectModeFull]]) {
    if (!content.includes('scripts/audit_personal_data_readiness.js')) {
      errors.push(`${label} must include personal data readiness audit`);
    }
  }
  if (!workflow.includes('Audit personal data readiness')) {
    errors.push('main workflow must run personal data readiness audit');
  }

  if (errors.length) {
    throw new Error(`Personal data readiness audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Personal data readiness OK: ${decisions.length} required decisions remain explicitly controlled`);
}

main();
