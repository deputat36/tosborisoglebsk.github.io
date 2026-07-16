const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { outreachStatuses, outreachGroups } = require('./lib/status_sets');
const { validationIssues } = require('../assets/js/outreach-validation');

const filePath = path.join(process.cwd(), 'data', 'outreach_register.csv');
const expectedHeaders = [
  'outreach_id',
  'request_group',
  'source_request_id',
  'subject',
  'recipient_type',
  'channel',
  'contact',
  'status',
  'sent_date',
  'follow_up_date',
  'response_date',
  'response_source',
  'owner',
  'blocker',
  'next_step'
];

function readCsvIds(relativePath, fieldName) {
  const sourcePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(sourcePath)) return new Set();

  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
  const [headers, ...items] = rows;
  const fieldIndex = headers ? headers.indexOf(fieldName) : -1;
  if (fieldIndex === -1) return new Set();

  return new Set(items.map((item) => item[fieldIndex]).filter(Boolean));
}

function buildSourceIndex() {
  return {
    registry: new Set(['registry-full']),
    priority_card: readCsvIds('data/priority_tos_requests.csv', 'slug'),
    candidate_registry: readCsvIds('data/candidate_registry_requests.csv', 'request_id'),
    project_result: readCsvIds('data/projects_2026_result_requests.csv', 'request_id')
  };
}

function rowObject(headers, cells) {
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
}

function auditRows(headers, items, sourceIndex = buildSourceIndex()) {
  const errors = [];
  const seen = new Set();

  items.forEach((cells, index) => {
    const line = index + 2;
    const item = rowObject(headers, cells);
    const {
      outreach_id: outreachId,
      request_group: requestGroup,
      source_request_id: sourceRequestId,
      subject,
      recipient_type: recipientType,
      status,
      next_step: nextStep
    } = item;

    if (!outreachId) errors.push(`line ${line}: missing outreach_id`);
    if (seen.has(outreachId)) errors.push(`line ${line}: duplicate outreach_id ${outreachId}`);
    seen.add(outreachId);

    if (!outreachGroups.has(requestGroup)) errors.push(`line ${line}: unsupported request_group ${requestGroup}`);
    if (!sourceRequestId) errors.push(`line ${line}: missing source_request_id`);
    if (sourceRequestId && sourceIndex[requestGroup] && !sourceIndex[requestGroup].has(sourceRequestId)) {
      errors.push(`line ${line}: source_request_id ${sourceRequestId} is absent for ${requestGroup}`);
    }
    if (!subject) errors.push(`line ${line}: missing subject`);
    if (!recipientType) errors.push(`line ${line}: missing recipient_type`);
    if (!outreachStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    validationIssues(item).forEach((issue) => errors.push(`line ${line}: ${issue}`));
  });

  return errors;
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'outreach_register.csv');
  errors.push(...auditRows(headers, items));

  if (errors.length) {
    throw new Error(`Outreach register audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Outreach register OK: ${items.length} rows`);
}

if (require.main === module) {
  main();
}

module.exports = { auditRows, buildSourceIndex, readCsvIds, rowObject };
