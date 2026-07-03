const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const consentPath = path.join(process.cwd(), 'data', 'publication_consent_checklist.csv');
const expectedHeaders = [
  'item',
  'field',
  'type',
  'required_before_publish',
  'acceptable_confirmation',
  'do_not_publish_if',
  'next_step'
];
const requiredFields = new Set([
  'official_name',
  'territory',
  'contact_person',
  'phone',
  'email',
  'social',
  'photo',
  'logo',
  'projects_done',
  'verified_at'
]);
const sensitiveRequiredFields = new Set([
  'contact_person',
  'phone',
  'email',
  'social',
  'photo',
  'logo'
]);
const allowedTypes = new Set([
  'fact',
  'personal_data',
  'personal_contact',
  'personal_or_public_contact',
  'public_contact',
  'media',
  'metadata'
]);
const allowedRequiredValues = new Set(['да', 'нет']);
const sensitiveTypes = new Set(['personal_data', 'personal_contact', 'personal_or_public_contact', 'media']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function main() {
  if (!fs.existsSync(consentPath)) {
    throw new Error(`Missing file: ${consentPath}`);
  }

  const rows = parseCsv(fs.readFileSync(consentPath, 'utf8'));
  const errors = [];

  if (rows.length < 2) {
    throw new Error('Publication consent checklist audit failed:\ndata/publication_consent_checklist.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seenFields = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `consent row ${index + 2}`;
    const [item, field, type, requiredBeforePublish, acceptableConfirmation, doNotPublishIf, nextStep] = row.map((cell) => (cell || '').trim());

    if (!item) errors.push(`${line}: missing item`);
    if (!field) errors.push(`${line}: missing field`);
    if (field && seenFields.has(field)) errors.push(`${line}: duplicate field ${field}`);
    if (field) seenFields.add(field);
    if (!allowedTypes.has(type)) errors.push(`${line}: unsupported type ${type}`);
    if (!allowedRequiredValues.has(requiredBeforePublish)) errors.push(`${line}: unsupported required_before_publish ${requiredBeforePublish}`);
    if (!acceptableConfirmation) errors.push(`${line}: missing acceptable_confirmation`);
    if (!doNotPublishIf) errors.push(`${line}: missing do_not_publish_if`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    if (requiredBeforePublish === 'да' && !doNotPublishIf) {
      errors.push(`${line}: required field must describe when not to publish`);
    }

    if (sensitiveRequiredFields.has(field) && requiredBeforePublish !== 'да') {
      errors.push(`${line}: sensitive field ${field} must require confirmation before publication`);
    }

    if (sensitiveTypes.has(type) && !/не публиковать|неясно|нет подтверждения|без разрешения|оставить без ссылки|использовать временную заглушку/.test(doNotPublishIf + ' ' + nextStep)) {
      errors.push(`${line}: sensitive item must explicitly block unsafe publication`);
    }

    if (field === 'verified_at' && type !== 'metadata') {
      errors.push(`${line}: verified_at must be metadata`);
    }
  });

  requiredFields.forEach((field) => {
    if (!seenFields.has(field)) {
      errors.push(`missing required consent field ${field}`);
    }
  });

  if (errors.length) {
    throw new Error(`Publication consent checklist audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Publication consent checklist OK: ${rows.length - 1} rows`);
}

main();
