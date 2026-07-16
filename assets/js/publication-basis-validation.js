(function initPublicationBasisValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PublicationBasisValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function publicationBasisValidationFactory() {
  'use strict';

  const REQUEST_STATUSES = Object.freeze([
    'draft',
    'sent',
    'waiting',
    'received',
    'needs_clarification',
    'closed_without_response'
  ]);

  const DECISION_STATUSES = Object.freeze([
    'not_reviewed',
    'keep_current',
    'remove_fields',
    'replace_with_general_channel',
    'hide_until_confirmed',
    'no_change_without_evidence'
  ]);

  const CHAIRPERSON_STATUSES = Object.freeze([
    '',
    'unknown',
    'confirmed_current',
    'incorrect',
    'hide_requested',
    'not_applicable'
  ]);

  const PROFILE_CLASSIFICATIONS = Object.freeze([
    '',
    'unknown',
    'personal',
    'official_community',
    'other_public',
    'needs_clarification',
    'not_applicable'
  ]);

  const TEMPLATE_BY_WAVE = Object.freeze({
    '1': 'publication-basis-wave-1',
    '2': 'publication-basis-wave-2',
    '3': 'publication-basis-wave-3'
  });

  const SENT_STATUSES = new Set(['sent', 'waiting', 'received', 'needs_clarification', 'closed_without_response']);
  const RESPONSE_STATUSES = new Set(['received', 'needs_clarification']);
  const FINAL_DECISIONS = new Set(['keep_current', 'remove_fields', 'replace_with_general_channel', 'hide_until_confirmed']);
  const TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
  const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function parseFieldTypes(value) {
    const items = String(value || '').split(';').map((item) => item.trim()).filter(Boolean);
    return Array.from(new Set(items));
  }

  function hasOutcomeFields(item) {
    return Boolean(
      item.chairperson_status ||
      item.field_types_to_keep ||
      item.field_types_to_remove ||
      item.preferred_public_channel_type ||
      item.personal_profile_classification ||
      item.factual_source_ref
    );
  }

  function validateToken(errors, value, label, allowBlank = true) {
    const text = String(value || '').trim();
    if (!text && allowBlank) return;
    if (!TOKEN_PATTERN.test(text)) errors.push(`${label}: допустим только обезличенный системный код`);
  }

  function validateFieldTypeList(errors, value, label) {
    for (const item of parseFieldTypes(value)) {
      if (!TOKEN_PATTERN.test(item)) errors.push(`${label}: недопустимый тип поля ${item}`);
    }
  }

  function validateDecision(errors, item) {
    const decision = item.decision_status;
    const keep = parseFieldTypes(item.field_types_to_keep);
    const remove = parseFieldTypes(item.field_types_to_remove);
    const overlap = keep.filter((field) => remove.includes(field));
    if (overlap.length) errors.push(`одни и те же поля нельзя одновременно оставить и удалить: ${overlap.join(';')}`);

    if (decision === 'keep_current' && !keep.length) errors.push('keep_current требует field_types_to_keep');
    if (decision === 'remove_fields' && !remove.length) errors.push('remove_fields требует field_types_to_remove');
    if (decision === 'replace_with_general_channel') {
      if (!remove.length) errors.push('replace_with_general_channel требует field_types_to_remove');
      if (!item.preferred_public_channel_type) errors.push('replace_with_general_channel требует preferred_public_channel_type');
    }
    if (decision === 'hide_until_confirmed' && !remove.length) {
      errors.push('hide_until_confirmed требует field_types_to_remove');
    }
  }

  function validationIssues(item) {
    const errors = [];
    const wave = String(item.wave || '');
    const status = String(item.request_status || '');
    const decision = String(item.decision_status || '');

    if (!SLUG_PATTERN.test(String(item.tos_slug || ''))) errors.push('нет корректного tos_slug');
    if (!TEMPLATE_BY_WAVE[wave]) errors.push('wave должен быть 1, 2 или 3');
    if (TEMPLATE_BY_WAVE[wave] && item.template_id !== TEMPLATE_BY_WAVE[wave]) errors.push('template_id не соответствует wave');
    if (TEMPLATE_BY_WAVE[wave] && item.priority !== `P0-${wave}`) errors.push('priority не соответствует wave');
    if (!Number.isInteger(Number(item.score)) || Number(item.score) < 0) errors.push('score должен быть неотрицательным целым числом');
    if (!REQUEST_STATUSES.includes(status)) errors.push('неизвестный request_status');
    if (!DECISION_STATUSES.includes(decision)) errors.push('неизвестный decision_status');
    if (!CHAIRPERSON_STATUSES.includes(String(item.chairperson_status || ''))) errors.push('неизвестный chairperson_status');
    if (!PROFILE_CLASSIFICATIONS.includes(String(item.personal_profile_classification || ''))) errors.push('неизвестная personal_profile_classification');
    if (!String(item.next_step || '').trim()) errors.push('нет next_step');

    validateToken(errors, item.recipient_role, 'recipient_role');
    validateToken(errors, item.channel_type, 'channel_type');
    validateToken(errors, item.owner_role, 'owner_role');
    validateToken(errors, item.reviewed_by_role, 'reviewed_by_role');
    validateToken(errors, item.preferred_public_channel_type, 'preferred_public_channel_type');
    validateFieldTypeList(errors, item.field_types_to_keep, 'field_types_to_keep');
    validateFieldTypeList(errors, item.field_types_to_remove, 'field_types_to_remove');

    for (const field of ['sent_date', 'follow_up_date', 'response_date', 'reviewed_at']) {
      if (item[field] && !isIsoDate(item[field])) errors.push(`${field} должен быть YYYY-MM-DD`);
    }

    if (SENT_STATUSES.has(status)) {
      if (!item.recipient_role) errors.push(`${status} требует recipient_role`);
      if (!item.channel_type) errors.push(`${status} требует channel_type`);
      if (!item.owner_role) errors.push(`${status} требует owner_role`);
      if (!item.sent_date) errors.push(`${status} требует sent_date`);
      if (!item.follow_up_date) errors.push(`${status} требует follow_up_date`);
    }

    if (item.sent_date && item.follow_up_date && item.follow_up_date < item.sent_date) {
      errors.push('follow_up_date раньше sent_date');
    }
    if (item.sent_date && item.response_date && item.response_date < item.sent_date) {
      errors.push('response_date раньше sent_date');
    }
    if (item.response_date && item.reviewed_at && item.reviewed_at < item.response_date) {
      errors.push('reviewed_at раньше response_date');
    }

    if (status === 'draft') {
      for (const field of ['sent_date', 'follow_up_date', 'response_date', 'reviewed_at', 'reviewed_by_role']) {
        if (item[field]) errors.push(`draft не допускает ${field}`);
      }
      if (decision !== 'not_reviewed') errors.push('draft требует decision_status=not_reviewed');
      if (hasOutcomeFields(item)) errors.push('draft не допускает результат разбора или factual_source_ref');
    }

    if (status === 'sent' || status === 'waiting') {
      if (item.response_date || item.reviewed_at || item.reviewed_by_role || hasOutcomeFields(item)) {
        errors.push(`${status} не допускает результат ответа до его получения`);
      }
      if (decision !== 'not_reviewed') errors.push(`${status} требует decision_status=not_reviewed`);
    }

    if (RESPONSE_STATUSES.has(status) && !item.response_date) errors.push(`${status} требует response_date`);

    if (status === 'received') {
      if (decision === 'not_reviewed') {
        if (item.reviewed_at || item.reviewed_by_role || hasOutcomeFields(item)) {
          errors.push('неразобранный received не допускает редакционные выводы или factual_source_ref');
        }
      } else {
        if (!item.reviewed_at) errors.push('разобранный received требует reviewed_at');
        if (!item.reviewed_by_role) errors.push('разобранный received требует reviewed_by_role');
        if (FINAL_DECISIONS.has(decision) && !item.factual_source_ref) errors.push(`${decision} требует factual_source_ref`);
        validateDecision(errors, item);
      }
    }

    if (status === 'needs_clarification') {
      if (!item.reviewed_at) errors.push('needs_clarification требует reviewed_at');
      if (!item.reviewed_by_role) errors.push('needs_clarification требует reviewed_by_role');
      if (decision !== 'no_change_without_evidence') errors.push('needs_clarification требует decision_status=no_change_without_evidence');
      if (item.field_types_to_keep || item.field_types_to_remove || item.preferred_public_channel_type) {
        errors.push('needs_clarification не допускает окончательное решение по полям');
      }
    }

    if (status === 'closed_without_response') {
      if (item.response_date) errors.push('closed_without_response не допускает response_date');
      if (!item.reviewed_at) errors.push('closed_without_response требует reviewed_at');
      if (!item.reviewed_by_role) errors.push('closed_without_response требует reviewed_by_role');
      if (!['hide_until_confirmed', 'no_change_without_evidence'].includes(decision)) {
        errors.push('closed_without_response допускает только hide_until_confirmed или no_change_without_evidence');
      }
      if (item.factual_source_ref) errors.push('closed_without_response не создаёт factual_source_ref');
      validateDecision(errors, item);
    }

    return errors;
  }

  function isReadyToSend(item) {
    return item.request_status === 'draft' && Boolean(item.recipient_role && item.channel_type && item.owner_role) && validationIssues(item).length === 0;
  }

  function readinessReason(item) {
    if (item.request_status !== 'draft') return '';
    const missing = [];
    if (!item.recipient_role) missing.push('роль получателя');
    if (!item.channel_type) missing.push('канал');
    if (!item.owner_role) missing.push('ответственный');
    return missing.length ? `нужно определить: ${missing.join(', ')}` : 'готово к фактической отправке';
  }

  function isFinalized(item) {
    if (item.request_status === 'closed_without_response') return true;
    return item.request_status === 'received' && item.decision_status !== 'not_reviewed' && validationIssues(item).length === 0;
  }

  return Object.freeze({
    CHAIRPERSON_STATUSES,
    DECISION_STATUSES,
    PROFILE_CLASSIFICATIONS,
    REQUEST_STATUSES,
    TEMPLATE_BY_WAVE,
    isFinalized,
    isIsoDate,
    isReadyToSend,
    parseFieldTypes,
    readinessReason,
    validationIssues
  });
}));
