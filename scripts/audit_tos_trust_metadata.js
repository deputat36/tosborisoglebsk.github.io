const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'toses.json');
const requiredKeys = [
  'source_type',
  'source_ref',
  'checked_at',
  'checked_by',
  'recheck_after',
  'verification_scope',
  'publication_consent_ref'
];

function isDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function main() {
  const errors = [];

  if (!fs.existsSync(filePath)) {
    throw new Error('Missing data/toses.json');
  }

  const toses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(toses)) {
    throw new Error('data/toses.json must contain an array');
  }

  for (const tos of toses) {
    const label = tos.slug || tos.name || 'unknown';
    const trust = tos.trust;

    if (!trust || typeof trust !== 'object' || Array.isArray(trust)) {
      errors.push(`${label}: missing trust object`);
      continue;
    }

    requiredKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(trust, key)) {
        errors.push(`${label}: missing trust.${key}`);
      }
    });

    if (!Array.isArray(trust.verification_scope)) {
      errors.push(`${label}: trust.verification_scope must be an array`);
    }

    if (!isDate(trust.checked_at)) {
      errors.push(`${label}: trust.checked_at must be empty or YYYY-MM-DD`);
    }

    if (!isDate(trust.recheck_after)) {
      errors.push(`${label}: trust.recheck_after must be empty or YYYY-MM-DD`);
    }

    if (trust.checked_at) {
      if (!trust.source_type) errors.push(`${label}: checked_at requires source_type`);
      if (!trust.source_ref) errors.push(`${label}: checked_at requires source_ref`);
      if (!trust.checked_by) errors.push(`${label}: checked_at requires checked_by`);
      if (!Array.isArray(trust.verification_scope) || !trust.verification_scope.length) {
        errors.push(`${label}: checked_at requires non-empty verification_scope`);
      }
    }

    if (trust.recheck_after && !trust.checked_at) {
      errors.push(`${label}: recheck_after requires checked_at`);
    }

    if (trust.publication_consent_ref && !trust.source_ref) {
      errors.push(`${label}: publication_consent_ref requires source_ref`);
    }

    if (trust.checked_at && tos.updated_at === trust.checked_at && !trust.source_ref) {
      errors.push(`${label}: updated_at must not be treated as verification evidence`);
    }
  }

  if (errors.length) {
    throw new Error(`TOS trust metadata audit failed:\n${errors.join('\n')}`);
  }

  const checked = toses.filter((tos) => tos.trust && tos.trust.checked_at).length;
  console.log(`TOS trust metadata OK: ${toses.length} records, ${checked} with evidence-backed checks`);
}

main();
