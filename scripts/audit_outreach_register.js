const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');
const { outreachStatuses, outreachGroups } = require('./lib/status_sets');

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
const sentStatuses = new Set(['sent', 'waiting', 'follow_up']);
const resultStatuses = new Set(['received', 'closed', 'resolved']);

function compareDates(a, b) {
  return a.localeCompare(b);
}

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

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const sourceIndex = buildSourceIndex();
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'outreach_register.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      outreachId,
      requestGroup,
      sourceRequestId,
      subject,
      recipientType,
      channel,
      contact,
      status,
      sentDate,
      followUpDate,
      responseDate,
      responseSource,
      owner,
      blocker,
      nextStep
    ] = item;

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

    if (sentDate && !isIsoDate(sentDate)) errors.push(`line ${line}: invalid sent_date ${sentDate}`);
    if (followUpDate && !isIsoDate(followUpDate)) errors.push(`line ${line}: invalid follow_up_date ${followUpDate}`);
    if (responseDate && !isIsoDate(responseDate)) errors.push(`line ${line}: invalid response_date ${responseDate}`);

    if (sentStatuses.has(status)) {
      if (!channel) errors.push(`line ${line}: status ${status} requires channel`);
      if (!sentDate) errors.push(`line ${line}: status ${status} requires sent_date`);
    }

    if (status === 'waiting' || status === 'follow_up') {
      if (!followUpDate) errors.push(`line ${line}: status ${status} requires follow_up_date`);
    }

    if (resultStatuses.has(status)) {
      if (!responseDate) errors.push(`line ${line}: status ${status} requires response_date`);
      if (!responseSource) errors.push(`line ${line}: status ${status} requires response_source`);
    }

    if (sentDate && followUpDate && compareDates(followUpDate, sentDate) < 0) {
      errors.push(`line ${line}: follow_up_date is earlier than sent_date`);
    }

    if (sentDate && responseDate && compareDates(responseDate, sentDate) < 0) {
      errors.push(`line ${line}: response_date is earlier than sent_date`);
    }

    void contact;
    void owner;
    void blocker;
  });

  if (errors.length) {
    throw new Error(`Outreach register audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Outreach register OK: ${items.length} rows`);
}

if (require.main === module) {
  main();
}

module.exports = { buildSourceIndex, readCsvIds };
