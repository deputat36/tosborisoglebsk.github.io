const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'data', 'media_intake_register.csv');
const expectedHeaders = [
  'tos_name',
  'media_type',
  'file_name_or_link',
  'source',
  'source_date',
  'author_or_owner',
  'publication_permission',
  'permission_scope',
  'person_visible',
  'personal_data_risk',
  'status',
  'next_step'
];
const allowedMediaTypes = new Set(['photo', 'video', 'document', 'logo']);
const allowedStatuses = new Set(['missing', 'blocked', 'draft', 'checking', 'ready', 'published', 'rejected']);
const allowedPermissionValues = new Set(['', 'да', 'нет', 'не применимо', 'не подтверждено']);
const allowedPersonVisibleValues = new Set(['', 'да', 'нет', 'не известно']);
const allowedPersonalDataRiskValues = new Set(['', 'низкий', 'средний', 'высокий', 'не проверено']);
const publishableStatuses = new Set(['ready', 'published']);

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'media_intake_register.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      tosName,
      mediaType,
      fileNameOrLink,
      source,
      sourceDate,
      authorOrOwner,
      publicationPermission,
      permissionScope,
      personVisible,
      personalDataRisk,
      status,
      nextStep
    ] = item;
    const rowKey = `${tosName}|${mediaType}|${fileNameOrLink || status}`;

    if (!tosName) errors.push(`line ${line}: missing tos_name`);
    if (!allowedMediaTypes.has(mediaType)) errors.push(`line ${line}: unsupported media_type ${mediaType}`);
    if (seen.has(rowKey)) errors.push(`line ${line}: duplicate media row ${rowKey}`);
    seen.add(rowKey);

    if (sourceDate && !isIsoDate(sourceDate)) errors.push(`line ${line}: invalid source_date ${sourceDate}`);
    if (!allowedPermissionValues.has(publicationPermission)) {
      errors.push(`line ${line}: unsupported publication_permission ${publicationPermission}`);
    }
    if (!permissionScope) errors.push(`line ${line}: missing permission_scope`);
    if (!allowedPersonVisibleValues.has(personVisible)) {
      errors.push(`line ${line}: unsupported person_visible ${personVisible}`);
    }
    if (!allowedPersonalDataRiskValues.has(personalDataRisk)) {
      errors.push(`line ${line}: unsupported personal_data_risk ${personalDataRisk}`);
    }
    if (!allowedStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    if (fileNameOrLink) {
      const isRepoPath = fileNameOrLink.startsWith('/');
      if (!isHttpUrl(fileNameOrLink) && !isRepoPath) {
        errors.push(`line ${line}: file_name_or_link must be an URL or repository path`);
      }
      if (isRepoPath && !repoPathExists(fileNameOrLink)) {
        errors.push(`line ${line}: missing file_name_or_link target ${fileNameOrLink}`);
      }
    }

    if (publishableStatuses.has(status)) {
      if (!fileNameOrLink) errors.push(`line ${line}: status ${status} requires file_name_or_link`);
      if (!source) errors.push(`line ${line}: status ${status} requires source`);
      if (!sourceDate) errors.push(`line ${line}: status ${status} requires source_date`);
      if (!authorOrOwner) errors.push(`line ${line}: status ${status} requires author_or_owner`);
      if (publicationPermission !== 'да') errors.push(`line ${line}: status ${status} requires publication_permission да`);
      if (personVisible === 'да' && personalDataRisk !== 'низкий') {
        errors.push(`line ${line}: visible people require low personal_data_risk before ${status}`);
      }
    }

    if (status === 'blocked' && !/(?:подтверд|подтверж)/i.test(nextStep || '')) {
      errors.push(`line ${line}: blocked status should explain required confirmation in next_step`);
    }
  });

  if (errors.length) {
    throw new Error(`Media intake register audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Media intake register OK: ${items.length} rows`);
}

main();
