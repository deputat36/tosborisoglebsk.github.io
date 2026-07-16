(function initManualBlockerSummary(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ManualBlockerSummary = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createManualBlockerSummary() {
  'use strict';

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    const source = String(text || '').replace(/^\ufeff/, '');

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '"' && quoted && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(value);
        if (row.some((cell) => cell !== '')) rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    if (value || row.length) {
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
    }

    const headers = rows.shift() || [];
    return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  }

  const countBy = (rows, predicate) => (rows || []).filter(predicate).length;
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  function summarizeVerification(rows) {
    const items = rows || [];
    const accepted = items.reduce((sum, row) => sum + numeric(row.accepted_count), 0);
    const required = items.reduce((sum, row) => sum + numeric(row.total_required), 0);
    const ready = countBy(items, (row) => String(row.can_set_verified || '').toLowerCase() === 'да');
    const blocked = countBy(items, (row) => String(row.current_gate || '').startsWith('blocked'));
    return {
      issue: '34', total: items.length, completed: ready, ready, blocked, accepted, required,
      progress: `${ready}/${items.length}`,
      headline: `${ready} из ${items.length} карточек готовы к подтверждённому статусу`,
      detail: `${accepted} из ${required} обязательных элементов имеют принятое evidence`
    };
  }

  function summarizePages(rows) {
    const items = rows || [];
    const checked = countBy(items, (row) => row.status && row.status !== 'not_checked');
    const passed = countBy(items, (row) => ['passed', 'confirmed', 'success'].includes(row.status));
    const failed = countBy(items, (row) => ['failed', 'mismatch', 'blocked'].includes(row.status));
    return {
      issue: '164', total: items.length, completed: checked, checked, passed, failed,
      progress: `${checked}/${items.length}`,
      headline: `${checked} из ${items.length} пунктов проверены вручную`,
      detail: checked === items.length ? `${passed} подтверждено, ${failed} требуют внимания` : 'Нужно открыть Settings → Pages и заполнить observed_value, status и evidence_ref'
    };
  }

  function summarizeOutreach(rows, validation) {
    const items = rows || [];
    const active = items.filter((row) => row.status !== 'resolved');
    const ready = validation ? countBy(active, (row) => validation.readiness(row).state === 'ready' && validation.validationIssues(row).length === 0) : 0;
    const sent = countBy(active, (row) => ['sent', 'waiting', 'follow_up', 'received', 'closed'].includes(row.status));
    const completed = countBy(active, (row) => ['received', 'closed', 'resolved'].includes(row.status));
    const overdue = validation ? countBy(active, (row) => validation.isOverdue(row)) : 0;
    const invalid = validation ? countBy(items, (row) => validation.validationIssues(row).length > 0) : 0;
    return {
      issue: '166', total: active.length, completed, ready, sent, overdue, invalid,
      resolvedOutsideActiveSet: items.length - active.length,
      progress: `${completed}/${active.length}`,
      headline: `${sent} из ${active.length} активных запросов фактически отправлены`,
      detail: `${ready} готовы к отправке · ${overdue} просроченных повторов · ${invalid} ошибок структуры`
    };
  }

  function summarizePersonalData(rows, validation) {
    const items = rows || [];
    const approved = countBy(items, (row) => row.decision_status === 'approved');
    const inReview = countBy(items, (row) => row.decision_status === 'in_review');
    const blocked = countBy(items, (row) => row.decision_status === 'blocked');
    const assigned = countBy(items, (row) => Boolean(row.decision_owner_role && row.legal_reviewer_role));
    const ready = validation ? countBy(items, (row) => validation.isReadyForReview(row, items)) : 0;
    const implemented = countBy(items, (row) => row.implementation_status === 'completed');
    const invalid = validation ? countBy(items, (row) => validation.validationIssues(row, null, items, { skipCanonical: true }).length > 0) : 0;
    return {
      issue: '205', total: items.length, completed: approved, approved, inReview, blocked, assigned, ready, implemented, invalid,
      progress: `${approved}/${items.length}`,
      headline: `${approved} из ${items.length} решений утверждены`,
      detail: `${assigned} имеют обе роли · ${ready} готовы к проверке · ${implemented} реализованы · ${invalid} ошибок`
    };
  }

  function summarizePublicationBasis(rows, validation) {
    const items = rows || [];
    const ready = validation ? countBy(items, (row) => validation.isReadyToSend(row)) : 0;
    const sent = countBy(items, (row) => ['sent', 'waiting', 'received', 'needs_clarification', 'closed_without_response'].includes(row.request_status));
    const responses = countBy(items, (row) => ['received', 'needs_clarification'].includes(row.request_status));
    const finalized = validation ? countBy(items, (row) => validation.isFinalized(row)) : 0;
    const invalid = validation ? countBy(items, (row) => validation.validationIssues(row).length > 0) : 0;
    return {
      issue: '254', total: items.length, completed: finalized, ready, sent, responses, finalized, invalid,
      progress: `${finalized}/${items.length}`,
      headline: `${finalized} из ${items.length} карточек имеют завершённый разбор`,
      detail: `${ready} готовы к отправке · ${sent} отправлены · ${responses} ответов · ${invalid} ошибок`
    };
  }

  return Object.freeze({
    parseCsv,
    summarizeVerification,
    summarizePages,
    summarizeOutreach,
    summarizePersonalData,
    summarizePublicationBasis
  });
}));
