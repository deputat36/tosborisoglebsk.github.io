const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');

const requestStatuses = new Set(['draft', 'sent', 'waiting', 'follow_up', 'received', 'closed', 'resolved_without_outreach']);

function readCsv(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  return { headers, items };
}

function ensureUnique(items, index, label, errors) {
  const seen = new Set();

  items.forEach((item, rowIndex) => {
    const line = rowIndex + 2;
    const value = item[index];

    if (!value) errors.push(`${label}: line ${line}: missing key`);
    if (seen.has(value)) errors.push(`${label}: line ${line}: duplicate key ${value}`);
    seen.add(value);
  });
}

function validatePriorityRequests(errors) {
  const label = 'priority_tos_requests.csv';
  const expectedHeaders = ['tos', 'slug', 'location', 'chairperson', 'known_contact', 'missing', 'send_via', 'next_step'];
  const { headers, items } = readCsv('data/priority_tos_requests.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  ensureUnique(items, 1, label, errors);

  items.forEach((item, rowIndex) => {
    const line = rowIndex + 2;
    const [tos, slug, location, chairperson, knownContact, missing, sendVia, nextStep] = item;

    if (!tos) errors.push(`${label}: line ${line}: missing tos`);
    if (!slug) errors.push(`${label}: line ${line}: missing slug`);
    if (!location) errors.push(`${label}: line ${line}: missing location`);
    if (!chairperson) errors.push(`${label}: line ${line}: missing chairperson`);
    if (!missing) errors.push(`${label}: line ${line}: missing missing`);
    if (!sendVia) errors.push(`${label}: line ${line}: missing send_via`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);

    void knownContact;
  });
}

function validateCandidateRequests(errors) {
  const label = 'candidate_registry_requests.csv';
  const expectedHeaders = [
    'request_id',
    'candidate_name',
    'slug_draft',
    'evidence_level',
    'recipient_name_or_office',
    'recipient_contact',
    'requested_fields',
    'request_text',
    'sent_date',
    'response_date',
    'response_source',
    'official_status',
    'territory_type',
    'publication_permission',
    'status',
    'blocker',
    'next_step'
  ];
  const { headers, items } = readCsv('data/candidate_registry_requests.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  ensureUnique(items, 0, label, errors);

  items.forEach((item, rowIndex) => {
    const line = rowIndex + 2;
    const [
      requestId,
      candidateName,
      slugDraft,
      evidenceLevel,
      recipientNameOrOffice,
      recipientContact,
      requestedFields,
      requestText,
      sentDate,
      responseDate,
      responseSource,
      officialStatus,
      territoryType,
      publicationPermission,
      status,
      blocker,
      nextStep
    ] = item;

    if (!requestId) errors.push(`${label}: line ${line}: missing request_id`);
    if (!candidateName) errors.push(`${label}: line ${line}: missing candidate_name`);
    if (!slugDraft) errors.push(`${label}: line ${line}: missing slug_draft`);
    if (!['low', 'medium', 'high'].includes(evidenceLevel)) errors.push(`${label}: line ${line}: unsupported evidence_level ${evidenceLevel}`);
    if (!requestedFields) errors.push(`${label}: line ${line}: missing requested_fields`);
    if (!requestText) errors.push(`${label}: line ${line}: missing request_text`);
    if (sentDate && !isIsoDate(sentDate)) errors.push(`${label}: line ${line}: invalid sent_date ${sentDate}`);
    if (responseDate && !isIsoDate(responseDate)) errors.push(`${label}: line ${line}: invalid response_date ${responseDate}`);
    if (responseDate && !responseSource) errors.push(`${label}: line ${line}: response_date requires response_source`);
    if (!officialStatus) errors.push(`${label}: line ${line}: missing official_status`);
    if (!territoryType) errors.push(`${label}: line ${line}: missing territory_type`);
    if (!publicationPermission) errors.push(`${label}: line ${line}: missing publication_permission`);
    if (!requestStatuses.has(status)) errors.push(`${label}: line ${line}: unsupported status ${status}`);
    if (!blocker) errors.push(`${label}: line ${line}: missing blocker`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);

    void recipientNameOrOffice;
    void recipientContact;
  });
}

function validateProjectResultRequests(errors) {
  const label = 'projects_2026_result_requests.csv';
  const expectedHeaders = [
    'request_id',
    'project_id',
    'tos_name',
    'project_title',
    'recipient_type',
    'recipient_name_or_office',
    'recipient_contact',
    'requested_fields',
    'request_text',
    'sent_date',
    'response_date',
    'response_source',
    'publication_permission',
    'status',
    'blocker',
    'next_step'
  ];
  const { headers, items } = readCsv('data/projects_2026_result_requests.csv');
  errors.push(...validateHeaders(headers, expectedHeaders, label));

  ensureUnique(items, 0, label, errors);

  items.forEach((item, rowIndex) => {
    const line = rowIndex + 2;
    const [
      requestId,
      projectId,
      tosName,
      projectTitle,
      recipientType,
      recipientNameOrOffice,
      recipientContact,
      requestedFields,
      requestText,
      sentDate,
      responseDate,
      responseSource,
      publicationPermission,
      status,
      blocker,
      nextStep
    ] = item;

    if (!requestId) errors.push(`${label}: line ${line}: missing request_id`);
    if (!projectId) errors.push(`${label}: line ${line}: missing project_id`);
    if (projectId !== 'all' && !tosName) errors.push(`${label}: line ${line}: missing tos_name`);
    if (projectId !== 'all' && !projectTitle) errors.push(`${label}: line ${line}: missing project_title`);
    if (!recipientType) errors.push(`${label}: line ${line}: missing recipient_type`);
    if (!requestedFields) errors.push(`${label}: line ${line}: missing requested_fields`);
    if (!requestText) errors.push(`${label}: line ${line}: missing request_text`);
    if (sentDate && !isIsoDate(sentDate)) errors.push(`${label}: line ${line}: invalid sent_date ${sentDate}`);
    if (responseDate && !isIsoDate(responseDate)) errors.push(`${label}: line ${line}: invalid response_date ${responseDate}`);
    if (responseDate && !responseSource) errors.push(`${label}: line ${line}: response_date requires response_source`);
    if (!publicationPermission) errors.push(`${label}: line ${line}: missing publication_permission`);
    if (!requestStatuses.has(status)) errors.push(`${label}: line ${line}: unsupported status ${status}`);
    if (status === 'draft' && !blocker) errors.push(`${label}: line ${line}: draft requires blocker`);
    if (!nextStep) errors.push(`${label}: line ${line}: missing next_step`);

    void recipientNameOrOffice;
    void recipientContact;
  });
}

function main() {
  const errors = [];

  validatePriorityRequests(errors);
  validateCandidateRequests(errors);
  validateProjectResultRequests(errors);

  if (errors.length) {
    throw new Error(`Request source audit failed:\n${errors.join('\n')}`);
  }

  console.log('Request source tables OK');
}

main();
