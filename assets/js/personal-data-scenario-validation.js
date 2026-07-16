(function initPersonalDataScenarioValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PersonalDataScenarioValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const EXPECTED_IDS = [
    'public_tos_card',
    'update_request',
    'media_submission',
    'correction_deletion_request'
  ];
  const text = (value) => String(value == null ? '' : value).trim();
  const list = (value) => text(value).split(';').map((item) => item.trim()).filter(Boolean);

  function validationIssues(row, index) {
    const item = row || {};
    const issues = [];
    const expectedId = EXPECTED_IDS[index];
    if (text(item.scenario_id) !== expectedId) issues.push(`ожидался scenario_id ${expectedId || 'за пределами матрицы'}`);
    if (Number(item.sequence) !== index + 1) issues.push(`sequence должен быть ${index + 1}`);
    if (text(item.scenario_status) !== 'draft') issues.push('scenario_status должен оставаться draft');
    for (const field of ['scenario_title', 'draft_purpose', 'actor_codes', 'source_codes', 'field_group_codes', 'action_codes', 'review_question_codes', 'blocker', 'next_step']) {
      if (!text(item[field])) issues.push(`${field} не заполнено`);
    }
    for (const field of ['retention_class_code', 'basis_code', 'distribution_rule_code']) {
      if (text(item[field])) issues.push(`${field} должен оставаться пустым до внешнего решения`);
    }
    for (const field of ['actor_codes', 'source_codes', 'field_group_codes', 'public_output_codes', 'internal_record_codes', 'action_codes', 'review_question_codes']) {
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
      draft: items.filter((row) => text(row.scenario_status) === 'draft').length,
      withPublicOutput: items.filter((row) => list(row.public_output_codes).length > 0).length,
      missingBasis: items.filter((row) => !text(row.basis_code)).length,
      missingRetention: items.filter((row) => !text(row.retention_class_code)).length,
      invalid: items.filter((row, index) => validationIssues(row, index).length > 0).length
    };
  }

  return { EXPECTED_IDS, list, validationIssues, summarize };
}));
