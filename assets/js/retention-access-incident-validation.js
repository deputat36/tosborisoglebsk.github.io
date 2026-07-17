(function initRetentionAccessIncidentValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RetentionAccessIncidentValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const EXPECTED = [
    ['retention_start_trigger', 'retention'],
    ['retention_end_trigger', 'retention'],
    ['least_privilege_access', 'access'],
    ['access_review_and_revocation', 'access'],
    ['backup_scope_and_separation', 'backup'],
    ['restore_rehearsal', 'backup'],
    ['secure_deletion', 'deletion'],
    ['registry_export_and_handover', 'continuity'],
    ['incident_classification_and_containment', 'incident'],
    ['incident_response_and_closure', 'incident']
  ];
  const EXTERNAL_FIELDS = [
    'decision_value_code', 'decision_owner_role', 'legal_reviewer_role',
    'approved_at', 'evidence_ref', 'implementation_ref'
  ];
  const text = (value) => String(value == null ? '' : value).trim();
  const list = (value) => text(value).split(';').map((item) => item.trim()).filter(Boolean);

  function validationIssues(row, index) {
    const item = row || {};
    const issues = [];
    const expected = EXPECTED[index] || [];
    if (text(item.rule_id) !== expected[0]) issues.push(`ожидался rule_id ${expected[0] || 'за пределами матрицы'}`);
    if (text(item.domain_code) !== expected[1]) issues.push(`ожидался domain_code ${expected[1] || 'за пределами матрицы'}`);
    if (Number(item.sequence) !== index + 1) issues.push(`sequence должен быть ${index + 1}`);
    if (text(item.rule_status) !== 'draft') issues.push('rule_status должен оставаться draft');
    for (const field of ['rule_title', 'draft_requirement_codes', 'verification_question_codes', 'blocker', 'next_step']) {
      if (!text(item[field])) issues.push(`${field} не заполнено`);
    }
    for (const field of EXTERNAL_FIELDS) {
      if (text(item[field])) issues.push(`${field} должен оставаться пустым до внешнего решения`);
    }
    if (text(item.implementation_status) !== 'not_started') issues.push('implementation_status должен оставаться not_started');
    for (const field of ['draft_requirement_codes', 'verification_question_codes']) {
      const values = list(item[field]);
      if (new Set(values).size !== values.length) issues.push(`${field} содержит повторяющиеся коды`);
      if (values.some((value) => !/^[a-z0-9_]+$/i.test(value))) issues.push(`${field} содержит недопустимый код`);
    }
    const joined = Object.values(item).join(' ');
    if (/https?:\/\//i.test(joined) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(joined) || /\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(joined)) {
      issues.push('строка содержит прямой адрес или контакт');
    }
    return Array.from(new Set(issues));
  }

  function summarize(rows) {
    const items = Array.isArray(rows) ? rows : [];
    return {
      total: items.length,
      draft: items.filter((row) => text(row.rule_status) === 'draft').length,
      domains: new Set(items.map((row) => text(row.domain_code)).filter(Boolean)).size,
      undecided: items.filter((row) => !text(row.decision_value_code)).length,
      notStarted: items.filter((row) => text(row.implementation_status) === 'not_started').length,
      invalid: items.filter((row, index) => validationIssues(row, index).length > 0).length
    };
  }

  return { EXPECTED, EXTERNAL_FIELDS, list, validationIssues, summarize };
}));
