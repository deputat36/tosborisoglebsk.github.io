const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseCsv } = require('./lib/csv');
const { isIsoDate } = require('./lib/date_checks');

const ROOT = process.cwd();
const TOSES_PATH = path.resolve(ROOT, process.env.PRIORITY_TOS_CURRENT_FILE || path.join('data', 'toses.json'));
const REVIEW_PATH = path.resolve(ROOT, process.env.PRIORITY_TOS_REVIEW_FILE || path.join('data', 'priority_tos_response_review.csv'));
const POLICY_PATH = path.resolve(ROOT, process.env.PRIORITY_TOS_POLICY_FILE || path.join('data', 'priority_tos_evidence_policy.json'));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalize(item))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'ru'));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalize(value[key]);
        return result;
      }, {});
  }
  if (typeof value === 'string') return value.trim();
  return value ?? null;
}

function equalValues(left, right) {
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function hasPublicValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasPublicValue(item));
  if (value && typeof value === 'object') return Object.values(value).some((item) => hasPublicValue(item));
  return String(value ?? '').trim().length > 0;
}

function readReviewRows() {
  const rows = parseCsv(fs.readFileSync(REVIEW_PATH, 'utf8'));
  const headers = (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
  const result = new Map();

  rows.slice(1).forEach((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] || '').trim();
    });
    if (record.slug) result.set(record.slug, record);
  });

  return result;
}

function gitShowJson(ref, filePath) {
  try {
    const raw = execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveBaseToses() {
  const baseFile = String(process.env.PRIORITY_TOS_BASE_FILE || '').trim();
  if (baseFile) {
    const resolved = path.resolve(ROOT, baseFile);
    if (!fs.existsSync(resolved)) return null;
    const value = readJson(resolved);
    return Array.isArray(value) ? { ref: `file:${resolved}`, toses: value } : null;
  }

  const refs = [];
  const explicit = String(process.env.PRIORITY_TOS_BASE_REF || '').trim();
  const baseBranch = String(process.env.GITHUB_BASE_REF || '').trim();

  if (explicit) refs.push(explicit);
  if (baseBranch) refs.push(`origin/${baseBranch}`, baseBranch);
  refs.push('HEAD^');

  for (const ref of [...new Set(refs)]) {
    const value = gitShowJson(ref, 'data/toses.json');
    if (Array.isArray(value)) return { ref, toses: value };
  }

  return null;
}

function validatePolicy(policy, errors) {
  if (!policy || typeof policy !== 'object') {
    errors.push('priority TOS evidence policy must be an object');
    return;
  }
  if (!Number.isInteger(policy.version) || policy.version < 1) errors.push('policy.version must be a positive integer');
  if (!Array.isArray(policy.slugs) || policy.slugs.length !== 4) errors.push('policy.slugs must contain four priority TOS slugs');
  if (!policy.protected_fields || typeof policy.protected_fields !== 'object') errors.push('policy.protected_fields must be an object');
  if (!Array.isArray(policy.ready_review_statuses) || !policy.ready_review_statuses.length) errors.push('policy.ready_review_statuses is required');
  if (!Array.isArray(policy.allowed_decisions) || !policy.allowed_decisions.length) errors.push('policy.allowed_decisions is required');
}

function main() {
  const errors = [];

  [TOSES_PATH, REVIEW_PATH, POLICY_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Priority TOS update evidence audit failed:\n${errors.join('\n')}`);

  const currentToses = readJson(TOSES_PATH);
  const policy = readJson(POLICY_PATH);
  const reviewRows = readReviewRows();
  validatePolicy(policy, errors);

  const currentBySlug = new Map((Array.isArray(currentToses) ? currentToses : []).map((item) => [item.slug, item]));
  const requiredSlugs = new Set(policy.slugs || []);

  requiredSlugs.forEach((slug) => {
    if (!currentBySlug.has(slug)) errors.push(`current data missing priority TOS ${slug}`);
    if (!reviewRows.has(slug)) errors.push(`response review missing priority TOS ${slug}`);
  });

  const base = resolveBaseToses();
  if (!base) {
    if (errors.length) throw new Error(`Priority TOS update evidence audit failed:\n${errors.join('\n')}`);
    console.log('Priority TOS update evidence policy OK; git baseline is unavailable, diff check skipped');
    return;
  }

  const baseBySlug = new Map(base.toses.map((item) => [item.slug, item]));
  const changed = [];

  requiredSlugs.forEach((slug) => {
    const current = currentBySlug.get(slug);
    const previous = baseBySlug.get(slug);
    const review = reviewRows.get(slug) || {};

    if (!previous) {
      errors.push(`baseline ${base.ref} missing priority TOS ${slug}`);
      return;
    }

    const changedFields = Object.keys(policy.protected_fields || {}).filter(
      (field) => !equalValues(previous?.[field], current?.[field])
    );
    if (!changedFields.length) return;

    changed.push({ slug, fields: changedFields });

    if (!(policy.ready_review_statuses || []).includes(review.review_status)) {
      errors.push(`${slug}: protected fields changed (${changedFields.join(', ')}) but review_status is ${review.review_status || '(empty)'}`);
    }
    if (!isIsoDate(review.response_received_at || '')) {
      errors.push(`${slug}: protected fields changed but response_received_at is missing or invalid`);
    }
    if (!review.response_source_type) {
      errors.push(`${slug}: protected fields changed but response_source_type is missing`);
    }
    if (!review.public_source_url && review.private_source_recorded !== 'да') {
      errors.push(`${slug}: protected fields changed but no public source URL or private source record is present`);
    }
    if (!(policy.allowed_decisions || []).includes(review.verification_decision)) {
      errors.push(`${slug}: protected fields changed but verification_decision must be partial or verified`);
    }

    changedFields.forEach((field) => {
      const rule = policy.protected_fields[field] || {};
      if (rule.review_flag && review[rule.review_flag] !== 'да') {
        errors.push(`${slug}: ${field} changed but ${rule.review_flag}=да is not recorded`);
      }
      if (rule.publication_consent_if_nonempty && hasPublicValue(current?.[field]) && review.publication_consent_confirmed !== 'да') {
        errors.push(`${slug}: ${field} contains public data but publication_consent_confirmed=да is not recorded`);
      }
    });
  });

  if (errors.length) {
    throw new Error(`Priority TOS update evidence audit failed against ${base.ref}:\n${errors.join('\n')}`);
  }

  if (!changed.length) {
    console.log(`Priority TOS update evidence OK: no protected field changes against ${base.ref}`);
    return;
  }

  console.log(`Priority TOS update evidence OK against ${base.ref}: ${changed.map((item) => `${item.slug} [${item.fields.join(', ')}]`).join('; ')}`);
}

main();
