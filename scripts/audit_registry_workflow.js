const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');

const intakePath = path.join(process.cwd(), 'data', 'registry_intake_checklist.csv');
const diffPath = path.join(process.cwd(), 'data', 'registry_diff_matrix_template.csv');
const intakeHeaders = [
  'step',
  'stage',
  'required_input',
  'output',
  'owner_status',
  'blocker_if_missing',
  'next_action'
];
const diffHeaders = [
  'registry_name',
  'normalized_name',
  'slug_candidate',
  'current_catalog_match',
  'match_status',
  'territory_type',
  'official_source',
  'source_date',
  'create_card',
  'update_existing',
  'needs_manual_review',
  'next_step'
];
const allowedOwnerStatuses = new Set(['todo', 'in_progress', 'done', 'blocked']);
const allowedMatchStatuses = new Set(['existing', 'missing', 'renamed', 'needs_official_confirmation', 'low_evidence_candidate']);
const allowedTerritoryTypes = new Set(['Городской', 'Сельский', 'городской', 'сельский', 'не подтверждено', 'unknown']);
const allowedYesNo = new Set(['да', 'нет']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function readCsv(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  if (rows.length < 2) {
    throw new Error(`Registry workflow audit failed:\n${label} must contain a header and at least one row`);
  }

  return rows;
}

function isBlankRow(row) {
  return row.every((cell) => !(cell || '').trim());
}

function validateHeaders(errors, rows, expectedHeaders, label) {
  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`${label}: unexpected headers: ${headers.join(', ')}`);
  }
}

function auditIntake(errors, rows) {
  validateHeaders(errors, rows, intakeHeaders, 'registry_intake_checklist.csv');

  const steps = new Set();
  rows.slice(1).forEach((row, index) => {
    if (isBlankRow(row)) return;

    const line = `registry intake row ${index + 2}`;
    const [step, stage, requiredInput, output, ownerStatus, blockerIfMissing, nextAction] = row.map((cell) => (cell || '').trim());

    if (!/^\d+$/.test(step)) errors.push(`${line}: invalid step ${step}`);
    if (steps.has(step)) errors.push(`${line}: duplicate step ${step}`);
    if (step) steps.add(step);
    if (!stage) errors.push(`${line}: missing stage`);
    if (!requiredInput) errors.push(`${line}: missing required_input`);
    if (!output) errors.push(`${line}: missing output`);
    if (!allowedOwnerStatuses.has(ownerStatus)) errors.push(`${line}: unsupported owner_status ${ownerStatus}`);
    if (!blockerIfMissing) errors.push(`${line}: missing blocker_if_missing`);
    if (!nextAction) errors.push(`${line}: missing next_action`);
  });

  for (let step = 1; step <= 10; step += 1) {
    if (!steps.has(String(step))) {
      errors.push(`registry_intake_checklist.csv: missing step ${step}`);
    }
  }
}

function auditDiff(errors, rows) {
  validateHeaders(errors, rows, diffHeaders, 'registry_diff_matrix_template.csv');

  const seenSlugs = new Set();
  let candidateCount = 0;

  rows.slice(1).forEach((row, index) => {
    if (isBlankRow(row)) return;

    candidateCount += 1;
    const line = `registry diff row ${index + 2}`;
    const [
      registryName,
      normalizedName,
      slugCandidate,
      currentCatalogMatch,
      matchStatus,
      territoryType,
      officialSource,
      sourceDate,
      createCard,
      updateExisting,
      needsManualReview,
      nextStep
    ] = row.map((cell) => (cell || '').trim());

    if (!registryName) errors.push(`${line}: missing registry_name`);
    if (!normalizedName) errors.push(`${line}: missing normalized_name`);
    if (!slugCandidate) errors.push(`${line}: missing slug_candidate`);
    if (slugCandidate && !slugPattern.test(slugCandidate)) errors.push(`${line}: invalid slug_candidate ${slugCandidate}`);
    if (slugCandidate && seenSlugs.has(slugCandidate)) errors.push(`${line}: duplicate slug_candidate ${slugCandidate}`);
    if (slugCandidate) seenSlugs.add(slugCandidate);
    if (!currentCatalogMatch) errors.push(`${line}: missing current_catalog_match`);
    if (!allowedMatchStatuses.has(matchStatus)) errors.push(`${line}: unsupported match_status ${matchStatus}`);
    if (!allowedTerritoryTypes.has(territoryType)) errors.push(`${line}: unsupported territory_type ${territoryType}`);
    if (sourceDate && !isIsoDate(sourceDate)) errors.push(`${line}: invalid source_date ${sourceDate}`);
    if (!allowedYesNo.has(createCard)) errors.push(`${line}: unsupported create_card ${createCard}`);
    if (!allowedYesNo.has(updateExisting)) errors.push(`${line}: unsupported update_existing ${updateExisting}`);
    if (!allowedYesNo.has(needsManualReview)) errors.push(`${line}: unsupported needs_manual_review ${needsManualReview}`);
    if (!nextStep) errors.push(`${line}: missing next_step`);

    if (matchStatus === 'needs_official_confirmation' && needsManualReview !== 'да') {
      errors.push(`${line}: needs_official_confirmation requires manual review`);
    }

    if (createCard === 'да' && !sourceDate) {
      errors.push(`${line}: create_card requires source_date`);
    }

    if (createCard === 'да' && matchStatus !== 'missing') {
      errors.push(`${line}: create_card requires match_status missing`);
    }

    if (createCard === 'да' && !officialSource) {
      errors.push(`${line}: create_card requires official_source`);
    }
  });

  if (candidateCount < 1) {
    errors.push('registry_diff_matrix_template.csv: must contain at least one candidate row');
  }
}

function main() {
  const errors = [];
  const intakeRows = readCsv(intakePath, 'data/registry_intake_checklist.csv');
  const diffRows = readCsv(diffPath, 'data/registry_diff_matrix_template.csv');

  auditIntake(errors, intakeRows);
  auditDiff(errors, diffRows);

  if (errors.length) {
    throw new Error(`Registry workflow audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Registry workflow OK: ${intakeRows.length - 1} intake rows, ${diffRows.slice(1).filter((row) => !isBlankRow(row)).length} diff rows`);
}

main();
