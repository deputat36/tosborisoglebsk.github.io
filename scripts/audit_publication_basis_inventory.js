const fs = require('fs');
const path = require('path');
const { buildInventory } = require('./generate_publication_basis_inventory');

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'toses.json');
const REPORT_PATH = path.join(ROOT, 'data', 'publication_basis_inventory.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const DOC_PATH = path.join(ROOT, 'docs', 'PUBLICATION-BASIS-INVENTORY-2026-07-14.md');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stable(value) {
  return JSON.stringify(value);
}

function sourceSecrets(toses) {
  const values = new Set();
  for (const tos of toses) {
    for (const field of ['contacts_raw', 'groups_raw']) {
      const value = String(tos && tos[field] || '').trim();
      if (value && value !== '-') values.add(value);
    }
    for (const field of ['phones', 'emails', 'chairperson_links', 'social_links']) {
      for (const value of Array.isArray(tos && tos[field]) ? tos[field] : []) {
        const item = String(value || '').trim();
        if (item) values.add(item);
      }
    }
  }
  return [...values].sort((a, b) => b.length - a.length);
}

function main() {
  const errors = [];
  const toses = JSON.parse(read(SOURCE_PATH));
  const actual = JSON.parse(read(REPORT_PATH));
  const expected = buildInventory(toses);
  const reportText = read(REPORT_PATH);

  if (stable(actual) !== stable(expected)) {
    errors.push('publication basis inventory is stale or does not match data/toses.json');
  }
  if (actual.schema_version !== 1) errors.push('publication basis inventory schema_version must be 1');
  if (actual.values_redacted !== true) errors.push('publication basis inventory must declare values_redacted=true');
  if (actual.privacy_rule !== 'inventory_only_no_legal_conclusion') {
    errors.push('publication basis inventory must remain an inventory without legal conclusion');
  }
  if (!Array.isArray(actual.records)) errors.push('publication basis inventory records must be an array');

  for (const secret of sourceSecrets(toses)) {
    if (secret.length >= 5 && reportText.includes(secret)) {
      errors.push(`inventory must not duplicate a contact or URL value from source data: ${secret.slice(0, 4)}…`);
    }
  }
  if (/https?:\/\//i.test(reportText)) errors.push('inventory must not contain URLs');
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(reportText)) errors.push('inventory must not contain email addresses');
  if (/\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(reportText)) errors.push('inventory must not contain phone numbers');

  for (const record of actual.records || []) {
    const label = record.slug || 'unknown';
    if (!Array.isArray(record.personal_fields)) errors.push(`${label}: personal_fields must be an array`);
    if (!Array.isArray(record.missing_verification_scope)) errors.push(`${label}: missing_verification_scope must be an array`);
    if (!['basis_documented', 'basis_review_required', 'source_only_consent_missing', 'no_personal_publication'].includes(record.basis_status)) {
      errors.push(`${label}: invalid basis_status ${record.basis_status}`);
    }
    if (['verified', 'partial'].includes(record.verification_status) && record.personal_field_count > 0 && record.basis_status !== 'basis_documented') {
      errors.push(`${label}: ${record.verification_status} card with personal publication requires source_ref, publication_consent_ref and complete verification_scope`);
    }
    if (record.basis_status === 'basis_documented') {
      if (!record.has_source_ref || !record.has_publication_consent_ref || record.missing_verification_scope.length) {
        errors.push(`${label}: basis_documented is inconsistent with evidence flags`);
      }
    }
  }

  const metrics = actual.metrics || {};
  if (metrics.cards_total !== (actual.records || []).length) errors.push('metrics.cards_total must match records length');
  if (metrics.cards_with_personal_publication !== (actual.records || []).filter((record) => record.personal_field_count > 0).length) {
    errors.push('metrics.cards_with_personal_publication is inconsistent');
  }
  if (metrics.basis_review_required !== (actual.records || []).filter((record) => record.basis_status === 'basis_review_required').length) {
    errors.push('metrics.basis_review_required is inconsistent');
  }

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  if (scripts['report:publication-basis'] !== 'node scripts/generate_publication_basis_inventory.js') {
    errors.push('package.json must define report:publication-basis');
  }
  if (scripts['audit:publication-basis'] !== 'node scripts/audit_publication_basis_inventory.js') {
    errors.push('package.json must define audit:publication-basis');
  }
  if (scripts['test:publication-basis'] !== 'node scripts/test_publication_basis_inventory.js') {
    errors.push('package.json must define test:publication-basis');
  }
  for (const command of ['report:publication-basis', 'test:publication-basis', 'audit:publication-basis']) {
    if (!String(scripts['audit:all'] || '').includes(`npm run ${command}`)) errors.push(`audit:all must include ${command}`);
  }

  const projectMode = read(PROJECT_MODE_PATH);
  const projectModeFull = read(PROJECT_MODE_FULL_PATH);
  for (const [label, content] of [['project-mode', projectMode], ['project-mode-full', projectModeFull]]) {
    for (const script of ['scripts/test_publication_basis_inventory.js', 'scripts/audit_publication_basis_inventory.js']) {
      if (!content.includes(script)) errors.push(`${label} must include ${script}`);
    }
  }

  const workflow = read(WORKFLOW_PATH);
  const generationIndex = workflow.indexOf('Generate publication basis inventory');
  const auditIndex = workflow.indexOf('Audit publication basis inventory');
  if (generationIndex === -1 || auditIndex === -1 || generationIndex > auditIndex) {
    errors.push('main workflow must generate publication basis inventory before auditing it');
  }

  const doc = read(DOC_PATH);
  for (const token of ['обезлич', 'личные профили', 'публичные сообщества', 'не является юридическим заключением', 'не удаляет']) {
    if (!doc.toLowerCase().includes(token.toLowerCase())) errors.push(`publication basis documentation is missing ${token}`);
  }

  if (errors.length) {
    throw new Error(`Publication basis inventory audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Publication basis inventory OK: ${metrics.cards_total} cards, ${metrics.cards_with_personal_publication} with personal publication, ${metrics.basis_review_required} require basis review`);
}

main();
