const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { TEMPLATE_BY_WAVE } = require('../assets/js/publication-basis-validation');

const ROOT = process.cwd();
const QUEUE_PATH = path.join(ROOT, 'data', 'publication_basis_review_queue.csv');
const REGISTER_PATH = path.join(ROOT, 'data', 'publication_basis_confirmation_register.csv');

const HEADERS = [
  'tos_slug',
  'wave',
  'priority',
  'score',
  'template_id',
  'request_status',
  'recipient_role',
  'channel_type',
  'owner_role',
  'sent_date',
  'follow_up_date',
  'response_date',
  'reviewed_at',
  'reviewed_by_role',
  'chairperson_status',
  'field_types_to_keep',
  'field_types_to_remove',
  'preferred_public_channel_type',
  'personal_profile_classification',
  'factual_source_ref',
  'decision_status',
  'blocker',
  'next_step'
];

function rowsAsObjects(text) {
  const rows = parseCsv(String(text || '').replace(/^\uFEFF/, ''));
  const [headers, ...items] = rows;
  if (!headers) return [];
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function escapeCsv(value) {
  const text = String(value == null ? '' : value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function defaultManualFields() {
  return {
    request_status: 'draft',
    recipient_role: '',
    channel_type: '',
    owner_role: '',
    sent_date: '',
    follow_up_date: '',
    response_date: '',
    reviewed_at: '',
    reviewed_by_role: '',
    chairperson_status: '',
    field_types_to_keep: '',
    field_types_to_remove: '',
    preferred_public_channel_type: '',
    personal_profile_classification: '',
    factual_source_ref: '',
    decision_status: 'not_reviewed',
    blocker: 'не определены роль получателя, канал и ответственный',
    next_step: 'определить безопасный канал вне публичного репозитория и назначить роль ответственного'
  };
}

function synchronizeRows(queueRows, registerRows) {
  const currentBySlug = new Map(registerRows.map((row) => [String(row.tos_slug || ''), row]));

  return queueRows.map((queue) => {
    const slug = String(queue.slug || '');
    const current = currentBySlug.get(slug) || defaultManualFields();
    const wave = String(queue.wave || '');

    return {
      ...defaultManualFields(),
      ...current,
      tos_slug: slug,
      wave,
      priority: String(queue.priority || ''),
      score: String(queue.score || ''),
      template_id: TEMPLATE_BY_WAVE[wave] || ''
    };
  });
}

function toCsv(rows) {
  return `${HEADERS.join(',')}\n${rows.map((row) => HEADERS.map((header) => escapeCsv(row[header])).join(',')).join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(QUEUE_PATH)) throw new Error('Missing data/publication_basis_review_queue.csv');
  if (!fs.existsSync(REGISTER_PATH)) throw new Error('Missing data/publication_basis_confirmation_register.csv');

  const queueRows = rowsAsObjects(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const registerRows = rowsAsObjects(fs.readFileSync(REGISTER_PATH, 'utf8'));
  const nextRows = synchronizeRows(queueRows, registerRows);
  const nextCsv = toCsv(nextRows);
  const currentCsv = fs.readFileSync(REGISTER_PATH, 'utf8').replace(/^\uFEFF/, '');

  if (nextCsv === currentCsv) {
    console.log(`Publication basis confirmation register already synchronized: ${nextRows.length} rows`);
    return;
  }

  fs.writeFileSync(REGISTER_PATH, nextCsv, 'utf8');
  console.log(`Publication basis confirmation register synchronized: ${nextRows.length} rows; manual workflow fields preserved by TOS slug`);
}

if (require.main === module) main();

module.exports = { HEADERS, defaultManualFields, rowsAsObjects, synchronizeRows, toCsv };
