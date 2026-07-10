const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const REVIEW_PATH = path.join(ROOT, 'data', 'priority_tos_response_review.csv');
const TRACKING_PATH = path.join(ROOT, 'data', 'priority_tos_tracking_template.csv');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const DOC_PATH = path.join(ROOT, 'docs', 'PRIORITY-TOS-VERIFICATION.md');
const PAGE_PATH = path.join(ROOT, 'data-requests', 'priority-tos', 'index.html');

const expectedHeaders = [
  'tos',
  'slug',
  'review_status',
  'response_received_at',
  'response_source_type',
  'public_source_url',
  'private_source_recorded',
  'chairperson_confirmed',
  'boundaries_confirmed',
  'public_phone_confirmed',
  'email_confirmed',
  'social_confirmed',
  'logo_rights_confirmed',
  'photo_rights_confirmed',
  'publication_consent_confirmed',
  'verification_decision',
  'next_step',
  'notes'
];

const requiredSlugs = new Set(['ivanovka', 'podstepki', 'gubari', 'tancyrey']);
const allowedStatuses = new Set([
  'Нет ответа',
  'Требует разбора',
  'Частично подтверждено',
  'Готово к обновлению',
  'Подтверждено',
  'Заблокировано'
]);
const allowedSourceTypes = new Set([
  '',
  'Публичный источник',
  'Ответ председателя',
  'Ответ координатора',
  'Ответ администрации',
  'Иное'
]);
const allowedBooleans = new Set(['', 'да', 'нет']);
const allowedDecisions = new Set(['', 'partial', 'verified', 'needs_review']);

function normalizeHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function validateBoolean(errors, line, label, value) {
  if (!allowedBooleans.has(value)) errors.push(`${line}: unsupported ${label} ${value}`);
}

function hasSource(publicSourceUrl, privateSourceRecorded) {
  return Boolean(publicSourceUrl) || privateSourceRecorded === 'да';
}

function main() {
  const errors = [];

  [REVIEW_PATH, TRACKING_PATH, TOSES_PATH, DOC_PATH, PAGE_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });

  if (errors.length) throw new Error(`Priority TOS response review audit failed:\n${errors.join('\n')}`);

  const rows = parseCsv(fs.readFileSync(REVIEW_PATH, 'utf8'));
  const trackingRows = parseCsv(fs.readFileSync(TRACKING_PATH, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'));
  const pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
  const knownSlugs = new Set((Array.isArray(toses) ? toses : []).map((tos) => tos.slug).filter(Boolean));
  const trackingSlugs = new Set((trackingRows.slice(1) || []).map((row) => String(row[1] || '').trim()).filter(Boolean));

  if (rows.length !== requiredSlugs.size + 1) {
    errors.push(`response review CSV must contain ${requiredSlugs.size} data rows`);
  }

  const headers = (rows[0] || []).map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const seenSlugs = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `response review row ${index + 2}`;
    const values = expectedHeaders.map((_, columnIndex) => String(row[columnIndex] || '').trim());
    const [
      tos,
      slug,
      reviewStatus,
      responseReceivedAt,
      responseSourceType,
      publicSourceUrl,
      privateSourceRecorded,
      chairpersonConfirmed,
      boundariesConfirmed,
      publicPhoneConfirmed,
      emailConfirmed,
      socialConfirmed,
      logoRightsConfirmed,
      photoRightsConfirmed,
      publicationConsentConfirmed,
      verificationDecision,
      nextStep
    ] = values;

    if (!tos) errors.push(`${line}: missing tos`);
    if (!slug) errors.push(`${line}: missing slug`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate slug ${slug}`);
    if (slug) seenSlugs.add(slug);
    if (slug && !requiredSlugs.has(slug)) errors.push(`${line}: unexpected slug ${slug}`);
    if (slug && !knownSlugs.has(slug)) errors.push(`${line}: unknown TOS slug ${slug}`);
    if (slug && !trackingSlugs.has(slug)) errors.push(`${line}: slug missing from tracking CSV ${slug}`);
    if (slug && !repoPathExists(`/tos/${slug}/`)) errors.push(`${line}: missing TOS page /tos/${slug}/`);

    if (!allowedStatuses.has(reviewStatus)) errors.push(`${line}: unsupported review_status ${reviewStatus}`);
    if (responseReceivedAt && !isIsoDate(responseReceivedAt)) errors.push(`${line}: invalid response_received_at ${responseReceivedAt}`);
    if (!allowedSourceTypes.has(responseSourceType)) errors.push(`${line}: unsupported response_source_type ${responseSourceType}`);
    if (publicSourceUrl && !/^https?:\/\//i.test(publicSourceUrl)) errors.push(`${line}: public_source_url must be http(s)`);
    if (!allowedDecisions.has(verificationDecision)) errors.push(`${line}: unsupported verification_decision ${verificationDecision}`);

    [
      ['private_source_recorded', privateSourceRecorded],
      ['chairperson_confirmed', chairpersonConfirmed],
      ['boundaries_confirmed', boundariesConfirmed],
      ['public_phone_confirmed', publicPhoneConfirmed],
      ['email_confirmed', emailConfirmed],
      ['social_confirmed', socialConfirmed],
      ['logo_rights_confirmed', logoRightsConfirmed],
      ['photo_rights_confirmed', photoRightsConfirmed],
      ['publication_consent_confirmed', publicationConsentConfirmed]
    ].forEach(([label, value]) => validateBoolean(errors, line, label, value));

    if (!nextStep) errors.push(`${line}: missing next_step`);

    const hasResponse = reviewStatus !== 'Нет ответа';
    if (hasResponse) {
      if (!responseReceivedAt) errors.push(`${line}: ${reviewStatus} requires response_received_at`);
      if (!responseSourceType) errors.push(`${line}: ${reviewStatus} requires response_source_type`);
      if (!hasSource(publicSourceUrl, privateSourceRecorded)) {
        errors.push(`${line}: ${reviewStatus} requires a public source URL or private_source_recorded=да`);
      }
    } else {
      const responseOnlyValues = [
        responseReceivedAt,
        responseSourceType,
        publicSourceUrl,
        privateSourceRecorded,
        chairpersonConfirmed,
        boundariesConfirmed,
        publicPhoneConfirmed,
        emailConfirmed,
        socialConfirmed,
        logoRightsConfirmed,
        photoRightsConfirmed,
        publicationConsentConfirmed,
        verificationDecision
      ];
      if (responseOnlyValues.some(Boolean)) errors.push(`${line}: Нет ответа must not contain review evidence`);
    }

    const publishableEvidence = [
      publicPhoneConfirmed,
      emailConfirmed,
      socialConfirmed,
      logoRightsConfirmed,
      photoRightsConfirmed
    ].includes('да');
    if (publishableEvidence && publicationConsentConfirmed !== 'да') {
      errors.push(`${line}: publishable contacts or media require publication_consent_confirmed=да`);
    }

    if (reviewStatus === 'Частично подтверждено' && verificationDecision !== 'partial') {
      errors.push(`${line}: Частично подтверждено requires verification_decision=partial`);
    }
    if (reviewStatus === 'Подтверждено' && verificationDecision !== 'verified') {
      errors.push(`${line}: Подтверждено requires verification_decision=verified`);
    }
    if (reviewStatus === 'Заблокировано' && verificationDecision !== 'needs_review') {
      errors.push(`${line}: Заблокировано requires verification_decision=needs_review`);
    }
    if (reviewStatus === 'Готово к обновлению' && !['partial', 'verified'].includes(verificationDecision)) {
      errors.push(`${line}: Готово к обновлению requires partial or verified decision`);
    }

    if (verificationDecision === 'verified') {
      if (chairpersonConfirmed !== 'да') errors.push(`${line}: verified requires chairperson_confirmed=да`);
      if (boundariesConfirmed !== 'да') errors.push(`${line}: verified requires boundaries_confirmed=да`);
      if (!hasSource(publicSourceUrl, privateSourceRecorded)) errors.push(`${line}: verified requires recorded source`);
    }
  });

  requiredSlugs.forEach((slug) => {
    if (!seenSlugs.has(slug)) errors.push(`missing required priority slug ${slug}`);
  });

  [
    '/data/priority_tos_tracking_template.csv',
    '/data/priority_tos_response_review.csv',
    '/chairperson/verify-card/',
    '/reply-review/'
  ].forEach((requiredLink) => {
    if (!pageHtml.includes(requiredLink)) errors.push(`priority request page missing link ${requiredLink}`);
  });

  if (errors.length) {
    throw new Error(`Priority TOS response review audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Priority TOS response review OK: ${rows.length - 1} rows, ${seenSlugs.size} unique slugs`);
}

main();
