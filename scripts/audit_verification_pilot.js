const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { repoPathExists } = require('./lib/path_checks');

const pilotPath = path.join(process.cwd(), 'data', 'verification_pilot.csv');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const expectedHeaders = [
  'tos',
  'slug',
  'priority',
  'current_status',
  'target_status',
  'required_evidence',
  'public_contact_needed',
  'media_needed',
  'source_needed',
  'privacy_check',
  'next_step'
];
const requiredSlugs = new Set(['ivanovka', 'podstepki', 'gubari', 'tancyrey']);
const allowedPriorities = new Set(['high', 'medium', 'low']);
const allowedCurrentStatuses = new Set(['requires_verification', 'checking', 'blocked', 'partially_verified', 'verified']);
const allowedTargetStatuses = new Set(['partially_verified_or_verified', 'verified', 'partially_verified']);
const allowedYesNo = new Set(['да', 'нет']);

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function extractRoutes(value) {
  const matches = (value || '').match(/\/[a-z0-9-]+\//g);
  return matches ? Array.from(new Set(matches)) : [];
}

function main() {
  if (!fs.existsSync(pilotPath)) {
    throw new Error(`Missing file: ${pilotPath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const rows = parseCsv(fs.readFileSync(pilotPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('Verification pilot audit failed:\ndata/toses.json must be an array');
  }

  if (rows.length < 2) {
    throw new Error('Verification pilot audit failed:\ndata/verification_pilot.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const knownSlugs = new Set(toses.map((tos) => tos.slug).filter(Boolean));
  const seenSlugs = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `verification pilot row ${index + 2}`;
    const [tos, slug, priority, currentStatus, targetStatus, requiredEvidence, publicContactNeeded, mediaNeeded, sourceNeeded, privacyCheck, nextStep] = row.map((cell) => (cell || '').trim());

    if (!tos) errors.push(`${line}: missing tos`);
    if (!slug) errors.push(`${line}: missing slug`);
    if (slug && !knownSlugs.has(slug)) errors.push(`${line}: unknown slug ${slug}`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate slug ${slug}`);
    if (slug) seenSlugs.add(slug);
    if (slug && !repoPathExists(`/tos/${slug}/`)) errors.push(`${line}: missing TOS page /tos/${slug}/`);
    if (!allowedPriorities.has(priority)) errors.push(`${line}: unsupported priority ${priority}`);
    if (!allowedCurrentStatuses.has(currentStatus)) errors.push(`${line}: unsupported current_status ${currentStatus}`);
    if (!allowedTargetStatuses.has(targetStatus)) errors.push(`${line}: unsupported target_status ${targetStatus}`);
    if (!requiredEvidence || requiredEvidence.length < 40) errors.push(`${line}: required_evidence is too short`);
    if (!allowedYesNo.has(publicContactNeeded)) errors.push(`${line}: unsupported public_contact_needed ${publicContactNeeded}`);
    if (!mediaNeeded) errors.push(`${line}: missing media_needed`);
    if (!allowedYesNo.has(sourceNeeded)) errors.push(`${line}: unsupported source_needed ${sourceNeeded}`);
    if (privacyCheck !== 'обязательно') errors.push(`${line}: privacy_check must be обязательно`);
    if (!nextStep || nextStep.length < 40) errors.push(`${line}: next_step is too short`);

    extractRoutes(nextStep).forEach((route) => {
      if (!repoPathExists(route)) {
        errors.push(`${line}: missing next_step route ${route}`);
      }
    });

    if (priority === 'high' && !requiredSlugs.has(slug)) {
      errors.push(`${line}: high priority pilot slug is not in required set ${slug}`);
    }
  });

  requiredSlugs.forEach((slug) => {
    if (!seenSlugs.has(slug)) {
      errors.push(`missing required verification pilot slug ${slug}`);
    }
  });

  if (errors.length) {
    throw new Error(`Verification pilot audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Verification pilot OK: ${rows.length - 1} rows`);
}

main();
