const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const calendarPath = path.join(process.cwd(), 'data', 'editorial_calendar.csv');
const expectedHeaders = [
  'period',
  'content_type',
  'target_page_or_file',
  'source_required',
  'status',
  'owner',
  'next_step'
];
const allowedPeriods = new Set([
  'еженедельно',
  'ежемесячно',
  'ежеквартально',
  'после каждого обновления',
  'после получения реестра'
]);
const allowedStatuses = new Set(['pending', 'active', 'blocked', 'ready', 'done']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function extractRepoTargets(value) {
  const matches = (value || '').match(/(?:\/[a-z0-9-]+\/|data\/[\w.-]+\.(?:csv|json|xml))/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function main() {
  if (!fs.existsSync(calendarPath)) {
    throw new Error(`Missing file: ${calendarPath}`);
  }

  const rows = parseCsv(fs.readFileSync(calendarPath, 'utf8'));
  const errors = [];

  if (rows.length < 2) {
    throw new Error('Editorial calendar audit failed:\ndata/editorial_calendar.csv must contain a header and at least one task');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seen = new Set();
  const pendingTypes = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `calendar row ${index + 2}`;
    const [period, contentType, targetPageOrFile, sourceRequired, status, owner, nextStep] = row.map((cell) => (cell || '').trim());
    const key = `${period}|${contentType}`;

    if (!allowedPeriods.has(period)) errors.push(`${line}: unsupported period ${period}`);
    if (!contentType) errors.push(`${line}: missing content_type`);
    if (!targetPageOrFile) errors.push(`${line}: missing target_page_or_file`);
    if (!sourceRequired) errors.push(`${line}: missing source_required`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    if (seen.has(key)) errors.push(`${line}: duplicate calendar item ${key}`);
    seen.add(key);

    if (status === 'blocked' && !nextStep.toLowerCase().includes('не ')) {
      errors.push(`${line}: blocked item must explain the blocking action`);
    }

    if (['ready', 'done'].includes(status) && !owner) {
      errors.push(`${line}: ${status} item must have owner`);
    }

    if (status === 'pending') {
      pendingTypes.add(contentType);
    }

    extractRepoTargets(targetPageOrFile).forEach((target) => {
      const normalizedTarget = target.startsWith('/') ? target : `/${target}`;
      if (!repoPathExists(normalizedTarget)) {
        errors.push(`${line}: missing target ${target}`);
      }
    });
  });

  ['мониторинг источников', 'новости ТОС', 'карточки ТОС', 'QA публикации'].forEach((contentType) => {
    if (!pendingTypes.has(contentType) && !seen.has(`еженедельно|${contentType}`) && !seen.has(`ежемесячно|${contentType}`) && !seen.has(`после каждого обновления|${contentType}`)) {
      errors.push(`missing required editorial calendar item ${contentType}`);
    }
  });

  if (errors.length) {
    throw new Error(`Editorial calendar audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Editorial calendar OK: ${rows.length - 1} items`);
}

main();
