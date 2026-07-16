const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const {
  TEMPLATE_BY_WAVE,
  isFinalized,
  isReadyToSend,
  validationIssues
} = require('../assets/js/publication-basis-validation');

const ROOT = process.cwd();
const REGISTER_PATH = path.join(ROOT, 'data', 'publication_basis_confirmation_register.csv');
const QUEUE_PATH = path.join(ROOT, 'data', 'publication_basis_review_queue.csv');
const TEMPLATES_PATH = path.join(ROOT, 'data', 'publication_basis_confirmation_templates.json');

const EXPECTED_HEADERS = [
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

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function rowsAsObjects(csvText, label, expectedHeaders = null) {
  const rows = parseCsv(csvText);
  const [headers, ...items] = rows;
  if (!headers) throw new Error(`${label} is empty`);
  if (expectedHeaders) {
    const headerErrors = validateHeaders(headers, expectedHeaders, label);
    if (headerErrors.length) throw new Error(headerErrors.join('\n'));
  }
  return {
    headers,
    items: items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])))
  };
}

function main() {
  const errors = [];
  const register = rowsAsObjects(read(REGISTER_PATH), 'publication_basis_confirmation_register.csv', EXPECTED_HEADERS);
  const queue = rowsAsObjects(read(QUEUE_PATH), 'publication_basis_review_queue.csv');
  const templates = JSON.parse(read(TEMPLATES_PATH));
  const templateIds = new Set((templates.templates || []).map((item) => item.id));
  const queueBySlug = new Map(queue.items.map((item) => [item.slug, item]));
  const seen = new Set();

  if (register.items.length !== queue.items.length) {
    errors.push(`register must contain exactly ${queue.items.length} rows, found ${register.items.length}`);
  }

  register.items.forEach((item, index) => {
    const line = index + 2;
    const slug = item.tos_slug;
    if (seen.has(slug)) errors.push(`line ${line}: duplicate tos_slug ${slug}`);
    seen.add(slug);

    const source = queueBySlug.get(slug);
    if (!source) {
      errors.push(`line ${line}: tos_slug ${slug} is absent from publication basis queue`);
    } else {
      if (item.wave !== source.wave) errors.push(`line ${line}: wave differs from queue for ${slug}`);
      if (item.priority !== source.priority) errors.push(`line ${line}: priority differs from queue for ${slug}`);
      if (item.score !== source.score) errors.push(`line ${line}: score differs from queue for ${slug}`);
      const expectedTemplate = TEMPLATE_BY_WAVE[source.wave];
      if (item.template_id !== expectedTemplate) errors.push(`line ${line}: template_id differs from wave for ${slug}`);
    }

    if (!templateIds.has(item.template_id)) errors.push(`line ${line}: unknown template_id ${item.template_id}`);
    validationIssues(item).forEach((issue) => errors.push(`line ${line} (${slug || 'no-slug'}): ${issue}`));
  });

  queue.items.forEach((item) => {
    if (!seen.has(item.slug)) errors.push(`queue slug is missing from register: ${item.slug}`);
  });

  const registerOrder = register.items.map((item) => item.tos_slug).join('|');
  const queueOrder = queue.items.map((item) => item.slug).join('|');
  if (registerOrder !== queueOrder) errors.push('register rows must preserve queue priority order');

  if (EXPECTED_HEADERS.some((header) => /consent|raw_response|recipient_contact|email|phone/i.test(header))) {
    errors.push('register schema must not contain consent, raw response or recipient contact fields');
  }

  if (errors.length) {
    throw new Error(`Publication basis confirmation register audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  const statusCounts = register.items.reduce((result, item) => {
    result[item.request_status] = (result[item.request_status] || 0) + 1;
    return result;
  }, {});
  const ready = register.items.filter(isReadyToSend).length;
  const finalized = register.items.filter(isFinalized).length;
  console.log(`Publication basis confirmation register OK: ${register.items.length} rows, ready ${ready}, finalized ${finalized}, statuses ${JSON.stringify(statusCounts)}`);
}

if (require.main === module) main();

module.exports = { EXPECTED_HEADERS, rowsAsObjects };
