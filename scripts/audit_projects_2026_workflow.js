const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');

const verificationPath = path.join(process.cwd(), 'data', 'projects_2026_verification.csv');
const requestsPath = path.join(process.cwd(), 'data', 'projects_2026_result_requests.csv');
const verificationHeaders = [
  'project_id',
  'tos_name',
  'project_title',
  'reported_scope',
  'participation_source_date',
  'participation_source_url',
  'participation_confirmed',
  'result_source_date',
  'result_source_url',
  'official_result',
  'grant_amount',
  'implementation_status',
  'tos_confirmation',
  'reuse_text_or_photo',
  'status',
  'blocker',
  'next_step'
];
const requestHeaders = [
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
const projectIdPattern = /^proj-2026-\d{3}$/;
const requestIdPattern = /^req-2026-\d{3}$/;
const allowedYesNo = new Set(['да', 'нет']);
const allowedImplementationStatuses = new Set(['не подтверждено', 'планируется', 'в работе', 'завершено', 'отложено']);
const allowedTosConfirmations = new Set(['не получено', 'получено', 'не требуется']);
const allowedProjectStatuses = new Set(['result_confirmed_needs_tos_followup', 'result_checked_needs_tos_followup', 'draft', 'published', 'blocked']);
const allowedRequestStatuses = new Set(['draft', 'sent', 'answered', 'resolved_without_outreach', 'blocked']);
const allowedPublicationPermissions = new Set(['не подтверждено', 'да', 'нет', 'не применимо']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function readCsv(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (rows.length < 2) {
    throw new Error(`Projects 2026 workflow audit failed:\n${label} must contain a header and at least one row`);
  }

  return rows;
}

function validateHeaders(errors, rows, expectedHeaders, label) {
  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`${label}: unexpected headers: ${headers.join(', ')}`);
  }
}

function validateVerification(errors, rows) {
  const label = 'projects_2026_verification.csv';
  validateHeaders(errors, rows, verificationHeaders, label);
  const seenProjects = new Set();
  let winnerCount = 0;

  rows.slice(1).forEach((row, index) => {
    const line = `${label}: line ${index + 2}`;
    const [
      projectId,
      tosName,
      projectTitle,
      reportedScope,
      participationSourceDate,
      participationSourceUrl,
      participationConfirmed,
      resultSourceDate,
      resultSourceUrl,
      officialResult,
      grantAmount,
      implementationStatus,
      tosConfirmation,
      reuseTextOrPhoto,
      status,
      blocker,
      nextStep
    ] = row.map((cell) => (cell || '').trim());

    if (!projectIdPattern.test(projectId)) errors.push(`${line}: invalid project_id ${projectId}`);
    if (seenProjects.has(projectId)) errors.push(`${line}: duplicate project_id ${projectId}`);
    if (projectId) seenProjects.add(projectId);
    if (!tosName) errors.push(`${line}: missing tos_name`);
    if (!projectTitle) errors.push(`${line}: missing project_title`);
    if (!reportedScope || reportedScope.length < 30) errors.push(`${line}: reported_scope is too short`);
    if (!isIsoDate(participationSourceDate)) errors.push(`${line}: invalid participation_source_date ${participationSourceDate}`);
    if (!isHttpUrl(participationSourceUrl)) errors.push(`${line}: invalid participation_source_url ${participationSourceUrl}`);
    if (!allowedYesNo.has(participationConfirmed)) errors.push(`${line}: unsupported participation_confirmed ${participationConfirmed}`);
    if (!isIsoDate(resultSourceDate)) errors.push(`${line}: invalid result_source_date ${resultSourceDate}`);
    if (!isHttpUrl(resultSourceUrl)) errors.push(`${line}: invalid result_source_url ${resultSourceUrl}`);
    if (!officialResult) errors.push(`${line}: missing official_result`);
    if (!allowedImplementationStatuses.has(implementationStatus)) errors.push(`${line}: unsupported implementation_status ${implementationStatus}`);
    if (!allowedTosConfirmations.has(tosConfirmation)) errors.push(`${line}: unsupported tos_confirmation ${tosConfirmation}`);
    if (!allowedYesNo.has(reuseTextOrPhoto)) errors.push(`${line}: unsupported reuse_text_or_photo ${reuseTextOrPhoto}`);
    if (!allowedProjectStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    if (officialResult === 'победитель') {
      winnerCount += 1;
      if (!/^\d+(?:\.\d{2})?$/.test(grantAmount)) errors.push(`${line}: winner must have numeric grant_amount`);
      if (status !== 'result_confirmed_needs_tos_followup') errors.push(`${line}: winner must keep follow-up status until implementation is confirmed`);
    } else {
      if (!officialResult.includes('не включён')) errors.push(`${line}: non-winner official_result must state absence from winners list`);
      if (!String(grantAmount).includes('отсутствует в перечне победителей')) errors.push(`${line}: non-winner grant_amount must explain absence from winners list`);
    }

    if (implementationStatus === 'не подтверждено' && !blocker) {
      errors.push(`${line}: unconfirmed implementation requires blocker`);
    }

    if (tosConfirmation !== 'получено' && status.includes('needs_tos_followup') && !blocker) {
      errors.push(`${line}: TOS follow-up status requires blocker`);
    }
  });

  if (rows.length - 1 !== 5) errors.push(`${label}: expected 5 project rows, got ${rows.length - 1}`);
  if (winnerCount !== 1) errors.push(`${label}: expected exactly 1 confirmed winner, got ${winnerCount}`);

  return seenProjects;
}

function validateRequests(errors, rows, projectIds) {
  const label = 'projects_2026_result_requests.csv';
  validateHeaders(errors, rows, requestHeaders, label);
  const seenRequests = new Set();
  const seenProjectRequests = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `${label}: line ${index + 2}`;
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
    ] = row.map((cell) => (cell || '').trim());

    if (!requestIdPattern.test(requestId)) errors.push(`${line}: invalid request_id ${requestId}`);
    if (seenRequests.has(requestId)) errors.push(`${line}: duplicate request_id ${requestId}`);
    if (requestId) seenRequests.add(requestId);
    if (projectId !== 'all' && !projectIds.has(projectId)) errors.push(`${line}: unknown project_id ${projectId}`);
    if (projectId !== 'all') seenProjectRequests.add(projectId);
    if (projectId !== 'all' && (!tosName || !projectTitle)) errors.push(`${line}: project request requires tos_name and project_title`);
    if (!recipientType) errors.push(`${line}: missing recipient_type`);
    if (!requestedFields) errors.push(`${line}: missing requested_fields`);
    if (!requestText || requestText.length < 80) errors.push(`${line}: request_text is too short`);
    if (sentDate && !isIsoDate(sentDate)) errors.push(`${line}: invalid sent_date ${sentDate}`);
    if (responseDate && !isIsoDate(responseDate)) errors.push(`${line}: invalid response_date ${responseDate}`);
    if (responseSource && !isHttpUrl(responseSource)) errors.push(`${line}: invalid response_source ${responseSource}`);
    if (!allowedPublicationPermissions.has(publicationPermission)) errors.push(`${line}: unsupported publication_permission ${publicationPermission}`);
    if (!allowedRequestStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    if (status === 'resolved_without_outreach') {
      if (sentDate) errors.push(`${line}: resolved_without_outreach must not have sent_date`);
      if (!responseDate || !responseSource) errors.push(`${line}: resolved_without_outreach requires response_date and response_source`);
      if (publicationPermission !== 'не применимо') errors.push(`${line}: resolved_without_outreach must use publication_permission не применимо`);
    }

    if (status === 'draft' && !blocker) errors.push(`${line}: draft request requires blocker`);
    if (['sent', 'answered'].includes(status) && !sentDate) errors.push(`${line}: ${status} request requires sent_date`);
    if (status === 'answered' && (!responseDate || !responseSource)) errors.push(`${line}: answered request requires response_date and response_source`);

    void recipientNameOrOffice;
    void recipientContact;
  });

  projectIds.forEach((projectId) => {
    if (!seenProjectRequests.has(projectId)) errors.push(`${label}: missing project follow-up request for ${projectId}`);
  });

  if (!seenRequests.has('req-2026-001')) errors.push(`${label}: missing general protocol request req-2026-001`);
}

function main() {
  const errors = [];
  const verificationRows = readCsv(verificationPath, 'data/projects_2026_verification.csv');
  const requestRows = readCsv(requestsPath, 'data/projects_2026_result_requests.csv');
  const projectIds = validateVerification(errors, verificationRows);

  validateRequests(errors, requestRows, projectIds);

  if (errors.length) {
    throw new Error(`Projects 2026 workflow audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Projects 2026 workflow OK: ${projectIds.size} projects, ${requestRows.length - 1} requests`);
}

main();
