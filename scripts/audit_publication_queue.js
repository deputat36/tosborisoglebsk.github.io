const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'data', 'publication_queue.csv');
const expectedHeaders = [
  'queue_id',
  'submission_type',
  'tos_name',
  'title',
  'source_checked',
  'permission_checked',
  'personal_data_checked',
  'media_checked',
  'target_file',
  'status',
  'blocker',
  'owner',
  'next_step'
];
const idPattern = /^queue-\d{3}$/;
const allowedTypes = new Set(['news', 'project', 'need', 'done', 'card_update', 'media']);
const allowedStatuses = new Set(['draft', 'checking', 'ready', 'published', 'rejected']);
const checkValues = new Set(['да', 'нет', 'не применимо']);
const publishedReadyStatuses = new Set(['ready', 'published']);

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'publication_queue.csv');
  const seen = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      queueId,
      submissionType,
      tosName,
      title,
      sourceChecked,
      permissionChecked,
      personalDataChecked,
      mediaChecked,
      targetFile,
      status,
      blocker,
      owner,
      nextStep
    ] = item;

    if (!queueId) errors.push(`line ${line}: missing queue_id`);
    if (queueId && !idPattern.test(queueId)) errors.push(`line ${line}: invalid queue_id ${queueId}`);
    if (queueId && seen.has(queueId)) errors.push(`line ${line}: duplicate queue_id ${queueId}`);
    if (queueId) seen.add(queueId);

    if (!allowedTypes.has(submissionType)) errors.push(`line ${line}: unsupported submission_type ${submissionType}`);
    if (!checkValues.has(sourceChecked)) errors.push(`line ${line}: unsupported source_checked ${sourceChecked}`);
    if (!checkValues.has(permissionChecked)) errors.push(`line ${line}: unsupported permission_checked ${permissionChecked}`);
    if (!checkValues.has(personalDataChecked)) errors.push(`line ${line}: unsupported personal_data_checked ${personalDataChecked}`);
    if (!checkValues.has(mediaChecked)) errors.push(`line ${line}: unsupported media_checked ${mediaChecked}`);
    if (!targetFile) errors.push(`line ${line}: missing target_file`);
    if (targetFile && !repoPathExists(targetFile)) errors.push(`line ${line}: missing target_file ${targetFile}`);
    if (!allowedStatuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    if (status === 'draft' && !blocker) errors.push(`line ${line}: draft status requires blocker`);
    if (publishedReadyStatuses.has(status)) {
      if (!title) errors.push(`line ${line}: status ${status} requires title`);
      if (!owner) errors.push(`line ${line}: status ${status} requires owner`);
      if (sourceChecked !== 'да') errors.push(`line ${line}: status ${status} requires source_checked да`);
      if (permissionChecked === 'нет') errors.push(`line ${line}: status ${status} cannot have permission_checked нет`);
      if (personalDataChecked !== 'да' && personalDataChecked !== 'не применимо') {
        errors.push(`line ${line}: status ${status} requires personal_data_checked да or не применимо`);
      }
      if (mediaChecked === 'нет') errors.push(`line ${line}: status ${status} cannot have media_checked нет`);
    }

    if (submissionType === 'media' && mediaChecked === 'не применимо') {
      errors.push(`line ${line}: media submission cannot have media_checked не применимо`);
    }

    void tosName;
  });

  if (errors.length) {
    throw new Error(`Publication queue audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Publication queue OK: ${items.length} rows`);
}

main();