const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const intakePath = path.join(process.cwd(), 'data', 'content_intake_template.csv');
const expectedHeaders = [
  'submission_type',
  'tos_name',
  'title',
  'short_summary',
  'event_or_fact_date',
  'source_person',
  'source_contact',
  'source_document_or_link',
  'publication_permission',
  'media_attached',
  'personal_data_present',
  'target_section',
  'status',
  'next_step'
];
const requiredTypes = new Set(['news', 'project', 'need', 'done', 'card_update', 'media']);
const allowedPermissions = new Set(['не подтверждено', 'да', 'нет', 'не применимо']);
const allowedMediaValues = new Set(['да', 'нет']);
const allowedPersonalDataValues = new Set(['не проверено', 'да', 'нет']);
const allowedStatuses = new Set(['draft', 'checking', 'ready', 'published', 'blocked', 'rejected']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function extractRepoTargets(value) {
  const matches = (value || '').match(/(?:\/[a-z0-9-]+\/|data\/[\w.-]+\.(?:csv|json|xml))/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function main() {
  if (!fs.existsSync(intakePath)) {
    throw new Error(`Missing file: ${intakePath}`);
  }

  const rows = parseCsv(fs.readFileSync(intakePath, 'utf8'));
  const errors = [];

  if (rows.length < 2) {
    throw new Error('Content intake template audit failed:\ndata/content_intake_template.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seenTypes = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `intake row ${index + 2}`;
    const [
      submissionType,
      tosName,
      title,
      shortSummary,
      eventOrFactDate,
      sourcePerson,
      sourceContact,
      sourceDocumentOrLink,
      publicationPermission,
      mediaAttached,
      personalDataPresent,
      targetSection,
      status,
      nextStep
    ] = row.map((cell) => (cell || '').trim());

    if (!requiredTypes.has(submissionType)) errors.push(`${line}: unsupported submission_type ${submissionType}`);
    if (submissionType && seenTypes.has(submissionType)) errors.push(`${line}: duplicate submission_type ${submissionType}`);
    if (submissionType) seenTypes.add(submissionType);

    if (eventOrFactDate && !isIsoDate(eventOrFactDate)) errors.push(`${line}: invalid event_or_fact_date ${eventOrFactDate}`);
    if (!allowedPermissions.has(publicationPermission)) errors.push(`${line}: unsupported publication_permission ${publicationPermission}`);
    if (!allowedMediaValues.has(mediaAttached)) errors.push(`${line}: unsupported media_attached ${mediaAttached}`);
    if (!allowedPersonalDataValues.has(personalDataPresent)) errors.push(`${line}: unsupported personal_data_present ${personalDataPresent}`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!targetSection) errors.push(`${line}: missing target_section`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    extractRepoTargets(targetSection).forEach((target) => {
      const normalizedTarget = target.startsWith('/') ? target : `/${target}`;
      if (!repoPathExists(normalizedTarget)) {
        errors.push(`${line}: missing target ${target}`);
      }
    });

    if (sourceDocumentOrLink && sourceDocumentOrLink.startsWith('http') && !isHttpUrl(sourceDocumentOrLink)) {
      errors.push(`${line}: invalid source_document_or_link ${sourceDocumentOrLink}`);
    }

    if (['ready', 'published'].includes(status)) {
      if (!title) errors.push(`${line}: ${status} item requires title`);
      if (!shortSummary || shortSummary.length < 30) errors.push(`${line}: ${status} item requires short_summary`);
      if (!eventOrFactDate) errors.push(`${line}: ${status} item requires event_or_fact_date`);
      if (!sourcePerson && !sourceDocumentOrLink) errors.push(`${line}: ${status} item requires source_person or source_document_or_link`);
      if (!['да', 'не применимо'].includes(publicationPermission)) errors.push(`${line}: ${status} item requires publication permission`);
      if (personalDataPresent === 'не проверено') errors.push(`${line}: ${status} item requires personal data check`);
    }

    if (status === 'blocked' && !nextStep.toLowerCase().includes('уточнить') && !nextStep.toLowerCase().includes('проверить')) {
      errors.push(`${line}: blocked item must include a concrete check or clarification step`);
    }

    if (submissionType !== 'card_update' && status !== 'draft' && !tosName) {
      errors.push(`${line}: non-draft ${submissionType} item should identify tos_name`);
    }
  });

  requiredTypes.forEach((submissionType) => {
    if (!seenTypes.has(submissionType)) {
      errors.push(`missing required submission_type ${submissionType}`);
    }
  });

  if (errors.length) {
    throw new Error(`Content intake template audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Content intake template OK: ${rows.length - 1} rows`);
}

main();
