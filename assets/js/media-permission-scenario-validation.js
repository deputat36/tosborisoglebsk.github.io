(function initMediaPermissionScenarioValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MediaPermissionScenarioValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const EXPECTED = [
    ['portrait_or_interview', 'people'],
    ['group_event_photo', 'people'],
    ['minors_or_vulnerable_people', 'people'],
    ['incidental_people_in_public_space', 'public_space'],
    ['location_or_property_context', 'public_space'],
    ['tos_logo_or_identity', 'identity'],
    ['partner_brand_identity', 'identity'],
    ['poster_or_document_scan', 'documents'],
    ['third_party_or_archive_media', 'third_party'],
    ['video_or_audio_recording', 'audiovisual']
  ];
  const EXTERNAL_FIELDS = [
    'selected_permission_scope_code', 'selected_attribution_code',
    'selected_duration_code', 'selected_withdrawal_route_code',
    'decision_owner_role', 'legal_reviewer_role', 'evidence_ref'
  ];
  const CODE_FIELDS = [
    'media_type_codes', 'participant_context_codes',
    'publication_surface_codes', 'verification_question_codes'
  ];
  const text = (value) => String(value == null ? '' : value).trim();
  const list = (value) => text(value).split(';').map((item) => item.trim()).filter(Boolean);

  function validationIssues(row, index) {
    const item = row || {};
    const issues = [];
    const expected = EXPECTED[index] || [];
    if (text(item.scenario_id) !== expected[0]) issues.push(`ожидался scenario_id ${expected[0] || 'за пределами матрицы'}`);
    if (text(item.scenario_group) !== expected[1]) issues.push(`ожидался scenario_group ${expected[1] || 'за пределами матрицы'}`);
    if (Number(item.sequence) !== index + 1) issues.push(`sequence должен быть ${index + 1}`);
    if (text(item.scenario_status) !== 'draft') issues.push('scenario_status должен оставаться draft');
    for (const field of ['scenario_title', ...CODE_FIELDS, 'blocker', 'next_step']) {
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
    return Array.from(new Set(issues));
  }

  function summarize(rows) {
    const items = Array.isArray(rows) ? rows : [];
    return {
      total: items.length,
      draft: items.filter((row) => text(row.scenario_status) === 'draft').length,
      groups: new Set(items.map((row) => text(row.scenario_group)).filter(Boolean)).size,
      undecided: items.filter((row) => !text(row.selected_permission_scope_code)).length,
      withoutEvidence: items.filter((row) => !text(row.evidence_ref)).length,
      invalid: items.filter((row, index) => validationIssues(row, index).length > 0).length
    };
  }

  return { EXPECTED, EXTERNAL_FIELDS, CODE_FIELDS, list, validationIssues, summarize };
}));
