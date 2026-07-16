(function initPersonalDataDecisionValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PersonalDataDecisionValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const DECISION_STATUSES = new Set(['pending', 'in_review', 'blocked', 'approved']);
  const IMPLEMENTATION_STATUSES = new Set(['not_started', 'blocked', 'ready', 'in_progress', 'completed']);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ROLE_RE = /^role:[a-z0-9][a-z0-9._:-]*$/i;
  const OPTION_RE = /^option:[a-z0-9][a-z0-9._:-]*$/i;
  const DECISION_REF_RE = /^decision:[a-z0-9][a-z0-9._:-]*$/i;
  const EVIDENCE_REF_RE = /^evidence:[a-z0-9][a-z0-9._:-]*$/i;

  const text = (value) => String(value == null ? '' : value).trim();
  const nonEmpty = (value) => text(value).length > 0;

  function prerequisiteIds(row) {
    return text(row && row.recommended_prerequisite_ids)
      .split(';').map((item) => item.trim()).filter(Boolean);
  }

  function prerequisitesResolved(row, allRows) {
    const map = new Map((allRows || []).map((item) => [text(item.decision_id), item]));
    return prerequisiteIds(row).every((id) => map.get(id) && text(map.get(id).decision_status) === 'approved');
  }

  function isApprovalComplete(row) {
    return text(row && row.decision_status) === 'approved'
      && OPTION_RE.test(text(row.selected_option_code))
      && DECISION_REF_RE.test(text(row.decision_ref))
      && EVIDENCE_REF_RE.test(text(row.legal_review_ref))
      && DATE_RE.test(text(row.approved_at))
      && ROLE_RE.test(text(row.approved_by_role));
  }

  function validationIssues(row, canonicalDecision, allRows, options) {
    const item = row || {};
    const opts = options || {};
    const issues = [];
    const id = text(item.decision_id);
    const sequence = Number(item.sequence);
    const status = text(item.decision_status);
    const implementationStatus = text(item.implementation_status);
    const prerequisites = prerequisiteIds(item);

    if (!id) issues.push('не указан decision_id');
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 8) issues.push('sequence должен быть от 1 до 8');
    if (!DECISION_STATUSES.has(status)) issues.push(`недопустимый decision_status: ${status || 'пусто'}`);
    if (!IMPLEMENTATION_STATUSES.has(implementationStatus)) issues.push(`недопустимый implementation_status: ${implementationStatus || 'пусто'}`);
    if (prerequisites.includes(id)) issues.push('решение не может зависеть само от себя');
    if (new Set(prerequisites).size !== prerequisites.length) issues.push('повторяются зависимости');

    for (const field of ['decision_owner_role', 'legal_reviewer_role', 'approved_by_role', 'implemented_by_role']) {
      if (nonEmpty(item[field]) && !ROLE_RE.test(text(item[field]))) issues.push(`${field} должен иметь формат role:`);
    }
    if (nonEmpty(item.selected_option_code) && !OPTION_RE.test(text(item.selected_option_code))) issues.push('selected_option_code должен иметь формат option:');
    if (nonEmpty(item.decision_ref) && !DECISION_REF_RE.test(text(item.decision_ref))) issues.push('decision_ref должен иметь формат decision:');
    if (nonEmpty(item.legal_review_ref) && !EVIDENCE_REF_RE.test(text(item.legal_review_ref))) issues.push('legal_review_ref должен иметь формат evidence:');
    if (nonEmpty(item.implementation_ref) && !EVIDENCE_REF_RE.test(text(item.implementation_ref))) issues.push('implementation_ref должен иметь формат evidence:');
    for (const field of ['approved_at', 'implemented_at']) {
      if (nonEmpty(item[field]) && !DATE_RE.test(text(item[field]))) issues.push(`${field} должен быть YYYY-MM-DD`);
    }

    if (status === 'pending' && nonEmpty(item.selected_option_code)) issues.push('pending не должен содержать выбранный вариант');
    if (status === 'in_review') {
      if (!ROLE_RE.test(text(item.decision_owner_role))) issues.push('in_review требует decision_owner_role');
      if (!ROLE_RE.test(text(item.legal_reviewer_role))) issues.push('in_review требует legal_reviewer_role');
    }
    if (status === 'blocked' && !nonEmpty(item.blocker)) issues.push('blocked требует blocker');

    if (status === 'approved') {
      if (!ROLE_RE.test(text(item.decision_owner_role))) issues.push('approved требует decision_owner_role');
      if (!ROLE_RE.test(text(item.legal_reviewer_role))) issues.push('approved требует legal_reviewer_role');
      if (!OPTION_RE.test(text(item.selected_option_code))) issues.push('approved требует selected_option_code');
      if (!DECISION_REF_RE.test(text(item.decision_ref))) issues.push('approved требует decision_ref');
      if (!EVIDENCE_REF_RE.test(text(item.legal_review_ref))) issues.push('approved требует legal_review_ref');
      if (!DATE_RE.test(text(item.approved_at))) issues.push('approved требует approved_at');
      if (!ROLE_RE.test(text(item.approved_by_role))) issues.push('approved требует approved_by_role');
    } else {
      for (const field of ['decision_ref', 'legal_review_ref', 'approved_at', 'approved_by_role']) {
        if (nonEmpty(item[field])) issues.push(`${field} должен оставаться пустым до approved`);
      }
    }

    if (status !== 'approved' && !['not_started', 'blocked'].includes(implementationStatus)) issues.push('реализация не может начаться до утверждения');
    if (implementationStatus === 'blocked' && !nonEmpty(item.blocker)) issues.push('blocked implementation требует blocker');
    if (implementationStatus === 'in_progress' && !ROLE_RE.test(text(item.implemented_by_role))) issues.push('in_progress требует implemented_by_role');
    if (implementationStatus === 'completed') {
      if (!EVIDENCE_REF_RE.test(text(item.implementation_ref))) issues.push('completed требует implementation_ref');
      if (!DATE_RE.test(text(item.implemented_at))) issues.push('completed требует implemented_at');
      if (!ROLE_RE.test(text(item.implemented_by_role))) issues.push('completed требует implemented_by_role');
    } else {
      if (nonEmpty(item.implementation_ref)) issues.push('implementation_ref допустим только для completed');
      if (nonEmpty(item.implemented_at)) issues.push('implemented_at допустим только для completed');
      if (implementationStatus !== 'in_progress' && nonEmpty(item.implemented_by_role)) issues.push('implemented_by_role допустим только для in_progress или completed');
    }

    if (allRows) {
      const byId = new Map(allRows.map((candidate) => [text(candidate.decision_id), candidate]));
      for (const prerequisite of prerequisites) {
        const dependency = byId.get(prerequisite);
        if (!dependency) issues.push(`не найдена зависимость ${prerequisite}`);
        else if (Number(dependency.sequence) >= sequence) issues.push(`зависимость ${prerequisite} должна иметь меньший sequence`);
      }
    }

    if (!opts.skipCanonical) {
      if (!canonicalDecision) issues.push('нет решения в personal_data_readiness.json');
      else {
        if (text(canonicalDecision.id) !== id) issues.push('decision_id не совпадает с каноническим реестром');
        if (text(canonicalDecision.status) !== status) issues.push('decision_status не совпадает с каноническим реестром');
        if (status === 'approved') {
          const pairs = [['decision_ref', 'decision_ref'], ['legal_review_ref', 'legal_review_ref'], ['approved_at', 'approved_at'], ['approved_by_role', 'approved_by']];
          for (const [packetField, canonicalField] of pairs) {
            if (text(item[packetField]) !== text(canonicalDecision[canonicalField])) issues.push(`${packetField} не совпадает с каноническим реестром`);
          }
        }
      }
    }
    return Array.from(new Set(issues));
  }

  function isReadyForReview(row, allRows) {
    const status = text(row && row.decision_status);
    return ['pending', 'in_review'].includes(status)
      && ROLE_RE.test(text(row.decision_owner_role))
      && ROLE_RE.test(text(row.legal_reviewer_role))
      && prerequisitesResolved(row, allRows)
      && validationIssues(row, null, allRows, { skipCanonical: true }).length === 0;
  }

  function readinessReason(row, allRows) {
    if (!ROLE_RE.test(text(row && row.decision_owner_role))) return 'назначить владельца решения';
    if (!ROLE_RE.test(text(row && row.legal_reviewer_role))) return 'назначить юридического проверяющего';
    if (!prerequisitesResolved(row, allRows)) return 'сначала утвердить рекомендованные зависимости';
    if (text(row && row.decision_status) === 'pending') return 'можно передавать в юридическую проверку';
    if (text(row && row.decision_status) === 'in_review') return 'юридическая проверка выполняется';
    if (text(row && row.decision_status) === 'blocked') return text(row.blocker) || 'решение заблокировано';
    if (text(row && row.decision_status) === 'approved') return 'решение утверждено; контролировать реализацию';
    return 'проверить структуру строки';
  }

  return {
    DECISION_STATUSES,
    IMPLEMENTATION_STATUSES,
    prerequisiteIds,
    prerequisitesResolved,
    isReadyForReview,
    isApprovalComplete,
    validationIssues,
    readinessReason
  };
}));
