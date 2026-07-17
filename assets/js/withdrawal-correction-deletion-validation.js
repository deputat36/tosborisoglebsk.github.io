(function initWithdrawalCorrectionDeletionValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WithdrawalCorrectionDeletionValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const EXPECTED_IDS = [
    'request_intake',
    'request_classification',
    'context_and_authority_check',
    'protective_visibility_decision',
    'content_action',
    'propagation_check',
    'requester_response',
    'case_closure_and_follow_up'
  ];
  const EXTERNAL_FIELDS = [
    'owner_role_code',
    'reviewer_role_code',
    'channel_code',
    'target_time_code',
    'evidence_ref'
  ];
  const CODE_FIELDS = [
    'request_type_codes',
    'input_codes',
    'action_codes',
    'output_codes'
  ];
  const text = (value) => String(value == null ? '' : value).trim();
  const list = (value) => text(value).split(';').map((item) => item.trim()).filter(Boolean);

  function validationIssues(row, index) {
    const item = row || {};
    const issues = [];
    const expectedId = EXPECTED_IDS[index];
    if (text(item.stage_id) !== expectedId) issues.push(`ожидался stage_id ${expectedId || 'за пределами процесса'}`);
    if (Number(item.sequence) !== index + 1) issues.push(`sequence должен быть ${index + 1}`);
    if (text(item.stage_status) !== 'draft') issues.push('stage_status должен оставаться draft');
    for (const field of ['stage_title', 'draft_purpose', 'request_type_codes', 'input_codes', 'action_codes', 'output_codes', 'blocker', 'next_step']) {
      if (!text(item[field])) issues.push(`${field} не заполнено`);
    }
    for (const field of EXTERNAL_FIELDS) {
      if (text(item[field])) issues.push(`${field} должен оставаться пустым до внешнего решения`);
    }
    for (const field of CODE_FIELDS) {
      const values = list(item[field]);
      if (new Set(values).size !== values.length) issues.push(`${field} содержит повторяющиеся коды`);
      if (values.some((value) => !/^[a-z0-9_]+$/i.test(value))) issues.push(`${field} содержит недопустимый код`);
    }
    const joined = Object.values(item).join(' ');
    if (/https?:\/\//i.test(joined) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(joined) || /\+?7[\s()-]*\d{3}[\s()-]*\d{3}/.test(joined)) {
      issues.push('строка содержит прямой адрес или контакт');
    }
    if (/\b(?:password|пароль|token|токен|secret|api[_ -]?key|приватн(?:ый|ого) ключ)\b/i.test(joined)) {
      issues.push('строка содержит секрет или учётные данные');
    }
    return Array.from(new Set(issues));
  }

  function summarize(rows) {
    const items = Array.isArray(rows) ? rows : [];
    return {
      total: items.length,
      draft: items.filter((row) => text(row.stage_status) === 'draft').length,
      withoutOwner: items.filter((row) => !text(row.owner_role_code)).length,
      withoutChannel: items.filter((row) => !text(row.channel_code)).length,
      withoutTargetTime: items.filter((row) => !text(row.target_time_code)).length,
      withoutEvidence: items.filter((row) => !text(row.evidence_ref)).length,
      invalid: items.filter((row, index) => validationIssues(row, index).length > 0).length
    };
  }

  return { EXPECTED_IDS, EXTERNAL_FIELDS, CODE_FIELDS, list, validationIssues, summarize };
}));
