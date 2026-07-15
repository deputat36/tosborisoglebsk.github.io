const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const INVENTORY_PATH = path.join(ROOT, 'data', 'publication_basis_inventory.json');
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'data', 'publication_basis_review_queue.csv');

const HEADERS = [
  'priority',
  'wave',
  'score',
  'slug',
  'basis_status',
  'personal_fields',
  'personal_field_count',
  'phone_count',
  'email_count',
  'personal_profile_count',
  'community_count',
  'other_public_link_count',
  'missing_source_ref',
  'missing_publication_consent_ref',
  'missing_verification_scope',
  'reason_codes',
  'next_action',
  'status'
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value) {
  return value === true;
}

function escapeCsv(value) {
  const text = String(value == null ? '' : value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function waveFor(record) {
  const phone = number(record.phone_count) > 0;
  const email = number(record.email_count) > 0;
  const profile = number(record.personal_profile_count) > 0;
  const unclassified = number(record.other_public_link_count) > 0;
  if (profile || (phone && email) || unclassified) return 1;
  if (phone || email) return 2;
  return 3;
}

function scoreFor(record) {
  let score = 0;
  if (!bool(record.has_source_ref)) score += 20;
  if (!bool(record.has_publication_consent_ref)) score += 25;
  score += number(record.personal_profile_count) * 20;
  score += number(record.email_count) * 15;
  score += number(record.phone_count) * 10;
  score += number(record.other_public_link_count) * 10;
  score += Math.max(0, number(record.personal_field_count) - 1) * 3;
  return score;
}

function reasonCodes(record) {
  const reasons = [];
  if (!bool(record.has_source_ref)) reasons.push('source_ref_missing');
  if (!bool(record.has_publication_consent_ref)) reasons.push('publication_consent_ref_missing');
  if (number(record.personal_profile_count) > 0) reasons.push('personal_profile_published');
  if (number(record.phone_count) > 0) reasons.push('phone_published');
  if (number(record.email_count) > 0) reasons.push('email_published');
  if (number(record.other_public_link_count) > 0) reasons.push('link_classification_required');
  if (Array.isArray(record.missing_verification_scope) && record.missing_verification_scope.length) reasons.push('verification_scope_incomplete');
  return reasons;
}

function nextAction(wave) {
  if (wave === 1) return 'classify_channels_and_confirm_publication_scope';
  if (wave === 2) return 'confirm_contact_publication_scope';
  return 'confirm_chairperson_name_publication';
}

function rowFor(record) {
  const wave = waveFor(record);
  return {
    priority: `P0-${wave}`,
    wave,
    score: scoreFor(record),
    slug: String(record.slug || ''),
    basis_status: String(record.basis_status || ''),
    personal_fields: Array.isArray(record.personal_fields) ? record.personal_fields.join(';') : '',
    personal_field_count: number(record.personal_field_count),
    phone_count: number(record.phone_count),
    email_count: number(record.email_count),
    personal_profile_count: number(record.personal_profile_count),
    community_count: number(record.community_count),
    other_public_link_count: number(record.other_public_link_count),
    missing_source_ref: !bool(record.has_source_ref),
    missing_publication_consent_ref: !bool(record.has_publication_consent_ref),
    missing_verification_scope: Array.isArray(record.missing_verification_scope) ? record.missing_verification_scope.join(';') : '',
    reason_codes: reasonCodes(record).join(';'),
    next_action: nextAction(wave),
    status: 'pending_external_confirmation'
  };
}

function buildQueue(inventory) {
  return (Array.isArray(inventory && inventory.records) ? inventory.records : [])
    .filter((record) => record && record.basis_status !== 'basis_documented' && record.personal_field_count > 0)
    .map(rowFor)
    .sort((a, b) => a.wave - b.wave || b.score - a.score || a.slug.localeCompare(b.slug, 'ru'));
}

function toCsv(rows) {
  return `${HEADERS.join(',')}\n${rows.map((row) => HEADERS.map((header) => escapeCsv(row[header])).join(',')).join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(INVENTORY_PATH)) throw new Error('Missing data/publication_basis_inventory.json');
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  const rows = buildQueue(inventory);
  const outputPath = process.env.PUBLICATION_BASIS_QUEUE_OUTPUT
    ? path.resolve(ROOT, process.env.PUBLICATION_BASIS_QUEUE_OUTPUT)
    : DEFAULT_OUTPUT_PATH;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCsv(rows), 'utf8');
  const waves = [1, 2, 3].map((wave) => rows.filter((row) => row.wave === wave).length);
  console.log(`Publication basis review queue generated: ${rows.length} tasks; waves ${waves.join('/')}`);
}

if (require.main === module) main();

module.exports = { HEADERS, buildQueue, reasonCodes, rowFor, scoreFor, toCsv, waveFor };
