(function initPrivateEvidenceStorageValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrivateEvidenceStorageValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const EXPECTED_IDS = [
    'access_control',
    'multi_factor_authentication',
    'audit_log',
    'encryption',
    'backup_restore',
    'export_portability',
    'deletion_withdrawal',
    'incident_response',
    'data_location_and_terms',
    'offboarding_and_ownership'
  ];
  const ALLOWED_GROUPS = new Set(['access', 'accountability', 'security', 'resilience', 'portability', 'lifecycle', 'incident', 'legal', 'governance']);
  const ALLOWED_CRITICALITY = new Set(['mandatory', 'high']);
  const CANDIDATE_FIELDS = ['candidate_a_result', 'candidate_b_result', 'candidate_c_result'];
  const EMPTY_EXTERNAL_FIELDS = ['selected_candidate_code', 'owner_role_code', 'reviewer_role_code', 'evidence_ref'];
  const text = (value) => String(value == null ? '' : value).trim();

  function validationIssues(row, index) {
    const item = row || {};
    const issues = [];
    const expectedId = EXPECTED_IDS[index];
    if (text(item.requirement_id) !== expectedId) issues.push(`ожидался requirement_id ${expectedId || 'за пределами матрицы'}`);
    if (Number(item.sequence) !== index + 1) issues.push(`sequence должен быть ${index + 1}`);
    if (text(item.requirement_status) !== 'draft') issues.push('requirement_status должен оставаться draft');
    if (!ALLOWED_GROUPS.has(text(item.requirement_group))) issues.push('requirement_group содержит неизвестную группу');
    if (!ALLOWED_CRITICALITY.has(text(item.criticality))) issues.push('criticality должен быть mandatory или high');

    for (const field of ['requirement_title', 'minimum_requirement', 'verification_method', 'blocker', 'next_step']) {
      if (!text(item[field])) issues.push(`${field} не заполнено`);
    }
    for (const field of CANDIDATE_FIELDS) {
      if (text(item[field]) !== 'not_assessed') issues.push(`${field} должен оставаться not_assessed до реальной проверки`);
    }
    for (const field of EMPTY_EXTERNAL_FIELDS) {
      if (text(item[field])) issues.push(`${field} должен оставаться пустым до внешнего решения`);
    }

    const joined = Object.values(item).join(' ');
    if (/https?:\/\//i.test(joined) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(joined) || /\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(joined)) {
      issues.push('строка содержит прямой адрес или контакт');
    }
    if (/\b(?:password|token|secret|api[_ -]?key|парол[ья]|токен|секрет)\b/i.test(joined)) {
      issues.push('строка содержит недопустимое упоминание секрета или учётных данных');
    }
    return Array.from(new Set(issues));
  }

  function summarize(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const assessments = items.reduce((sum, row) => sum + CANDIDATE_FIELDS.filter((field) => text(row[field]) === 'not_assessed').length, 0);
    return {
      total: items.length,
      draft: items.filter((row) => text(row.requirement_status) === 'draft').length,
      mandatory: items.filter((row) => text(row.criticality) === 'mandatory').length,
      candidateSlots: items.length * CANDIDATE_FIELDS.length,
      notAssessed: assessments,
      selected: items.filter((row) => text(row.selected_candidate_code)).length,
      withRoles: items.filter((row) => text(row.owner_role_code) || text(row.reviewer_role_code)).length,
      invalid: items.filter((row, index) => validationIssues(row, index).length > 0).length
    };
  }

  return { EXPECTED_IDS, ALLOWED_GROUPS, ALLOWED_CRITICALITY, CANDIDATE_FIELDS, EMPTY_EXTERNAL_FIELDS, validationIssues, summarize };
}));