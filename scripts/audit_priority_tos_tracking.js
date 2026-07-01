const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const trackingPath = path.join(process.cwd(), 'data', 'priority_tos_tracking_template.csv');
const requestsPath = path.join(process.cwd(), 'data', 'priority_tos_requests.csv');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const expectedHeaders = [
  'tos',
  'slug',
  'current_status',
  'send_channel',
  'contact_found',
  'sent_at',
  'reply_at',
  'received_public_phone',
  'received_email',
  'received_social',
  'received_logo',
  'received_photo',
  'source_confirmed',
  'can_publish_contacts',
  'next_step',
  'notes'
];
const requiredSlugs = new Set(['ivanovka', 'podstepki', 'gubari', 'tancyrey']);
const allowedStatuses = new Set(['Не начинали', 'Готово к отправке', 'Отправлено', 'Ожидаем ответ', 'Получено', 'Заблокировано']);
const allowedBooleanValues = new Set(['', 'да', 'нет']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function validateBoolean(errors, line, label, value) {
  if (!allowedBooleanValues.has(value)) {
    errors.push(`${line}: unsupported ${label} ${value}`);
  }
}

function validateOptionalDate(errors, line, label, value) {
  if (value && !isIsoDate(value)) {
    errors.push(`${line}: invalid ${label} ${value}`);
  }
}

function main() {
  if (!fs.existsSync(trackingPath)) {
    throw new Error(`Missing file: ${trackingPath}`);
  }

  if (!fs.existsSync(requestsPath)) {
    throw new Error(`Missing file: ${requestsPath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const rows = parseCsv(fs.readFileSync(trackingPath, 'utf8'));
  const requestCsv = fs.readFileSync(requestsPath, 'utf8');
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const knownSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);
  const errors = [];

  if (rows.length < 2) {
    throw new Error('Priority TOS tracking audit failed:\ndata/priority_tos_tracking_template.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seenSlugs = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `priority row ${index + 2}`;
    const [
      tos,
      slug,
      currentStatus,
      sendChannel,
      contactFound,
      sentAt,
      replyAt,
      receivedPublicPhone,
      receivedEmail,
      receivedSocial,
      receivedLogo,
      receivedPhoto,
      sourceConfirmed,
      canPublishContacts,
      nextStep
    ] = row.map((cell) => (cell || '').trim());

    if (!tos) errors.push(`${line}: missing tos`);
    if (!slug) errors.push(`${line}: missing slug`);
    if (slug && !knownSlugs.has(slug)) errors.push(`${line}: unknown slug ${slug}`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate slug ${slug}`);
    if (slug) seenSlugs.add(slug);
    if (slug && !repoPathExists(`/tos/${slug}/`)) errors.push(`${line}: missing TOS page /tos/${slug}/`);

    if (!allowedStatuses.has(currentStatus)) errors.push(`${line}: unsupported current_status ${currentStatus}`);
    if (!sendChannel) errors.push(`${line}: missing send_channel`);
    validateBoolean(errors, line, 'contact_found', contactFound);
    validateBoolean(errors, line, 'received_public_phone', receivedPublicPhone);
    validateBoolean(errors, line, 'received_email', receivedEmail);
    validateBoolean(errors, line, 'received_social', receivedSocial);
    validateBoolean(errors, line, 'received_logo', receivedLogo);
    validateBoolean(errors, line, 'received_photo', receivedPhoto);
    validateBoolean(errors, line, 'source_confirmed', sourceConfirmed);
    validateBoolean(errors, line, 'can_publish_contacts', canPublishContacts);
    validateOptionalDate(errors, line, 'sent_at', sentAt);
    validateOptionalDate(errors, line, 'reply_at', replyAt);

    if (['Отправлено', 'Ожидаем ответ', 'Получено'].includes(currentStatus) && !sentAt) {
      errors.push(`${line}: ${currentStatus} requires sent_at`);
    }

    if (currentStatus === 'Получено' && !replyAt) {
      errors.push(`${line}: received status requires reply_at`);
    }

    if (canPublishContacts === 'да' && sourceConfirmed !== 'да') {
      errors.push(`${line}: can_publish_contacts requires source_confirmed`);
    }

    if (!nextStep) errors.push(`${line}: missing next_step`);
  });

  requiredSlugs.forEach((slug) => {
    if (!seenSlugs.has(slug)) {
      errors.push(`missing required priority slug ${slug}`);
    }

    if (!requestCsv.includes(`"${slug}"`)) {
      errors.push(`priority request CSV missing required slug ${slug}`);
    }
  });

  if (errors.length) {
    throw new Error(`Priority TOS tracking audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Priority TOS tracking OK: ${rows.length - 1} rows`);
}

main();
