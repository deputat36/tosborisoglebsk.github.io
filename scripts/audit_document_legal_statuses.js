const fs = require('fs');
const path = require('path');

const root = process.cwd();
const documentsPath = path.join(root, 'data', 'documents.json');
const policyPath = path.join(root, 'data', 'document_legal_status_policy.json');
const matrixPath = path.join(root, 'data', 'legal_authority_matrix.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(root, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function main() {
  const errors = [];
  const documents = readJson(documentsPath);
  const policy = readJson(policyPath);
  const matrix = readJson(matrixPath);

  const allowed = new Set(Object.keys(policy.allowed_statuses || {}));
  const strict = new Set(policy.strict_statuses || []);
  const strictRequired = policy.required_for_strict_status || [];
  const approvedRequired = policy.approved_sample_requires || [];

  if (!Array.isArray(documents)) errors.push('data/documents.json must contain an array');
  if (!allowed.size) errors.push('document legal status policy has no allowed statuses');

  for (const item of Array.isArray(documents) ? documents : []) {
    const label = item.title || 'untitled document';
    if (!allowed.has(item.legal_status)) {
      errors.push(`${label}: invalid or missing legal_status=${item.legal_status || ''}`);
      continue;
    }

    if (!isDate(item.legal_checked_at)) errors.push(`${label}: legal_checked_at must be empty or YYYY-MM-DD`);
    if (!isDate(item.legal_recheck_after)) errors.push(`${label}: legal_recheck_after must be empty or YYYY-MM-DD`);
    if (item.legal_recheck_after && !item.legal_checked_at) {
      errors.push(`${label}: legal_recheck_after requires legal_checked_at`);
    }

    if (strict.has(item.legal_status)) {
      strictRequired.forEach((field) => {
        if (!String(item[field] || '').trim()) errors.push(`${label}: ${item.legal_status} requires ${field}`);
      });
    }

    if (item.legal_status === 'approved_sample') {
      approvedRequired.forEach((field) => {
        if (!String(item[field] || '').trim()) errors.push(`${label}: approved_sample requires ${field}`);
      });
    }

    if (item.legal_status === 'draft_methodical' && /^Можно (использовать|заполнить)/i.test(String(item.status || ''))) {
      errors.push(`${label}: draft methodical template must not be labelled as ready to use`);
    }

    if (item.legal_status === 'source_requires_official_check') {
      const hasStrictEvidence = Boolean(item.official_source_url && item.legal_checked_at && item.legal_checked_by);
      if (!hasStrictEvidence && /^Действующ/i.test(String(item.status || ''))) {
        errors.push(`${label}: unverified local legal source must not be labelled as current`);
      }
    }
  }

  const matrixStatuses = new Set(['requires_official_source', 'requires_specialist_review', 'verified_current']);
  const seen = new Set();
  if (!matrix || !Array.isArray(matrix.items)) {
    errors.push('legal authority matrix must contain items array');
  } else {
    for (const item of matrix.items) {
      const label = item.id || 'unknown matrix item';
      if (!item.id || seen.has(item.id)) errors.push(`legal matrix has missing or duplicate id: ${label}`);
      seen.add(item.id);
      ['question', 'level', 'status', 'basis_hint', 'official_source_url', 'checked_at', 'checked_by'].forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(item, field)) errors.push(`${label}: missing ${field}`);
      });
      if (!matrixStatuses.has(item.status)) errors.push(`${label}: invalid matrix status=${item.status || ''}`);
      if (!isDate(item.checked_at)) errors.push(`${label}: checked_at must be empty or YYYY-MM-DD`);
      if (item.status === 'verified_current' && !(item.official_source_url && item.checked_at && item.checked_by)) {
        errors.push(`${label}: verified_current requires official source, date and checker`);
      }
    }
  }

  const charter = Array.isArray(documents)
    ? documents.find((item) => item.title === 'Устав Борисоглебского городского округа')
    : null;
  if (!charter || charter.legal_status !== 'source_requires_official_check') {
    errors.push('BGO charter must remain source_requires_official_check until official verification');
  }

  if (errors.length) {
    throw new Error(`Document legal status audit failed:\n${errors.join('\n')}`);
  }

  const counts = Array.from(allowed).reduce((acc, status) => {
    acc[status] = documents.filter((item) => item.legal_status === status).length;
    return acc;
  }, {});
  console.log(`Document legal statuses OK: ${documents.length} documents, matrix=${matrix.items.length}`);
  console.log(JSON.stringify(counts));
}

main();
