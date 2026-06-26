const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

function readCsv(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  return { headers, items };
}

function isIntegerString(value) {
  return /^\d+$/.test(value || '');
}

function validateReadiness(errors) {
  const label = 'verification_readiness_matrix.csv';
  const expectedHeaders = [
    'tos',
    'slug',
    'total_required',
    'accepted_count',
    'missing_count',
    'readiness_percent',
    'current_gate',
    'next_required_action',
    'can_set_verified',
    'blockers'
  ];
  const { headers, items } = readCsv('data/verification_readiness_matrix.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [tos, slug, totalRequired, acceptedCount, missingCount, readinessPercent, currentGate, nextRequiredAction, canSetVerified, blockers] = item;

    if (!tos) errors.push(`${label}: line ${line}: missing tos`);
    if (!slug) errors.push(`${label}: line ${line}: missing slug`);
    if (seen.has(slug)) errors.push(`${label}: line ${line}: duplicate slug ${slug}`);
    seen.add(slug);

    if (!isIntegerString(totalRequired)) errors.push(`${label}: line ${line}: invalid total_required ${totalRequired}`);
    if (!isIntegerString(acceptedCount)) errors.push(`${label}: line ${line}: invalid accepted_count ${acceptedCount}`);
    if (!isIntegerString(missingCount)) errors.push(`${label}: line ${line}: invalid missing_count ${missingCount}`);
    if (!isIntegerString(readinessPercent)) errors.push(`${label}: line ${line}: invalid readiness_percent ${readinessPercent}`);

    if (isIntegerString(totalRequired) && isIntegerString(acceptedCount) && isIntegerString(missingCount)) {
      const total = Number(totalRequired);
      const accepted = Number(acceptedCount);
      const missing = Number(missingCount);
      if (accepted + missing !== total) errors.push(`${label}: line ${line}: accepted_count plus missing_count must equal total_required`);
    }

    if (!currentGate) errors.push(`${label}: line ${line}: missing current_gate`);
    if (!nextRequiredAction) errors.push(`${label}: line ${line}: missing next_required_action`);
    if (!['да', 'нет'].includes(canSetVerified)) errors.push(`${label}: line ${line}: unsupported can_set_verified ${canSetVerified}`);
    if (canSetVerified === 'нет' && !blockers) errors.push(`${label}: line ${line}: blocked row requires blockers`);
  });
}

function validateEvidence(errors) {
  const label = 'verification_evidence_register.csv';
  const expectedHeaders = [
    'tos',
    'slug',
    'evidence_item',
    'source_type',
    'source_reference',
    'received_date',
    'public_permission',
    'media_permission',
    'verification_status',
    'reviewer',
    'next_step',
    'notes'
  ];
  const { headers, items } = readCsv('data/verification_evidence_register.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  const seenKeys = new Set();
  const rowsBySlug = new Map();
  const allowedPermissions = new Set(['да', 'нет', 'не требуется']);
  const allowedStatuses = new Set(['missing', 'pending', 'accepted', 'rejected']);

  items.forEach((item, index) => {
    const line = index + 2;
    const [tos, slug, evidenceItem, sourceType, sourceReference, receivedDate, publicPermission, mediaPermission, verificationStatus, reviewer, nextStep, notes] = item;
    const key = `${slug}::${evidenceItem}`;

    if (!tos) errors.push(`${label}: line ${line}: missing tos`);
    if (!slug) errors.push(`${label}: line ${line}: missing slug`);
    if (!evidenceItem) errors.push(`${label}: line ${line}: missing evidence_item`);
    if (seenKeys.has(key)) errors.push(`${label}: line ${line}: duplicate evidence item ${key}`);
    seenKeys.add(key);

    rowsBySlug.set(slug, (rowsBySlug.get(slug) || 0) + 1);

    if (!sourceType) errors.push(`${label}: line ${line}: missing source_type`);
    if (receivedDate && !isIsoDate(receivedDate)) errors.push(`${label}: line ${line}: invalid received_date ${receivedDate}`);
    if (!allowedPermissions.has(publicPermission)) errors.push(`${label}: line ${line}: unsupported public_permission ${publicPermission}`);
    if (!allowedPermissions.has(mediaPermission)) errors.push(`${label}: line ${line}: unsupported media_permission ${mediaPermission}`);
    if (!allowedStatuses.has(verificationStatus)) errors.push(`${label}: line ${line}: unsupported verification_status ${verificationStatus}`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);

    if (verificationStatus === 'accepted') {
      if (!sourceReference) errors.push(`${label}: line ${line}: accepted item requires source_reference`);
      if (!receivedDate) errors.push(`${label}: line ${line}: accepted item requires received_date`);
      if (!reviewer) errors.push(`${label}: line ${line}: accepted item requires reviewer`);
    }

    void notes;
  });

  rowsBySlug.forEach((count, slug) => {
    if (count !== 6) errors.push(`${label}: slug ${slug} must contain 6 evidence rows, got ${count}`);
  });
}

function validateConsent(errors) {
  const label = 'publication_consent_checklist.csv';
  const expectedHeaders = [
    'item',
    'field',
    'type',
    'required_before_publish',
    'acceptable_confirmation',
    'do_not_publish_if',
    'next_step'
  ];
  const { headers, items } = readCsv('data/publication_consent_checklist.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  const seenFields = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [itemName, field, type, requiredBeforePublish, acceptableConfirmation, doNotPublishIf, nextStep] = item;

    if (!itemName) errors.push(`${label}: line ${line}: missing item`);
    if (!field) errors.push(`${label}: line ${line}: missing field`);
    if (seenFields.has(field)) errors.push(`${label}: line ${line}: duplicate field ${field}`);
    seenFields.add(field);
    if (!type) errors.push(`${label}: line ${line}: missing type`);
    if (!['да', 'нет'].includes(requiredBeforePublish)) errors.push(`${label}: line ${line}: unsupported required_before_publish ${requiredBeforePublish}`);
    if (!acceptableConfirmation) errors.push(`${label}: line ${line}: missing acceptable_confirmation`);
    if (!doNotPublishIf) errors.push(`${label}: line ${line}: missing do_not_publish_if`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);
  });
}

function main() {
  const errors = [];

  validateReadiness(errors);
  validateEvidence(errors);
  validateConsent(errors);

  if (errors.length) {
    throw new Error(`Verification source audit failed:\n${errors.join('\n')}`);
  }

  console.log('Verification source tables OK');
}

if (require.main === module) {
  main();
}

module.exports = {
  validateReadiness,
  validateEvidence,
  validateConsent
};
