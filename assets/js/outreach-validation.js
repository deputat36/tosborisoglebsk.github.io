(function initOutreachValidation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OutreachValidation = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const SENT_STATUSES = new Set(['sent', 'waiting', 'follow_up', 'received', 'closed']);
  const FOLLOW_UP_STATUSES = new Set(['sent', 'waiting', 'follow_up']);
  const RESPONSE_STATUSES = new Set(['received', 'closed', 'resolved']);
  const TERMINAL_STATUSES = new Set(['received', 'closed', 'resolved']);

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function dateValue(value) {
    if (!isIsoDate(value)) return null;
    return new Date(`${value}T12:00:00Z`);
  }

  function validationIssues(item) {
    const issues = [];
    const status = String(item.status || '');
    const sentDate = String(item.sent_date || '');
    const followUpDate = String(item.follow_up_date || '');
    const responseDate = String(item.response_date || '');
    const sent = dateValue(sentDate);
    const followUp = dateValue(followUpDate);
    const response = dateValue(responseDate);

    if (sentDate && !sent) issues.push('некорректная дата отправки');
    if (followUpDate && !followUp) issues.push('некорректная дата повторного контакта');
    if (responseDate && !response) issues.push('некорректная дата результата или ответа');

    if (SENT_STATUSES.has(status)) {
      if (!item.channel) issues.push('для статуса нужен реальный канал');
      if (!item.contact) issues.push('для статуса нужен фактический получатель или организация');
      if (!item.owner) issues.push('для статуса нужен ответственный');
      if (!sentDate) issues.push('для статуса нужна дата отправки');
    }

    if (FOLLOW_UP_STATUSES.has(status) && !followUpDate) {
      issues.push('для статуса нужна дата повторного контакта');
    }

    if (RESPONSE_STATUSES.has(status)) {
      if (!responseDate) issues.push('не указана дата результата или ответа');
      if (!item.response_source) issues.push('не указан источник результата или ответа');
    }

    if (status === 'draft') {
      if (sentDate) issues.push('черновик не может иметь дату отправки');
      if (followUpDate) issues.push('черновик не может иметь дату повторного контакта');
      if (responseDate || item.response_source) issues.push('черновик не может иметь результат или ответ');
    }

    if (['sent', 'waiting', 'follow_up'].includes(status) && (responseDate || item.response_source)) {
      issues.push('активный запрос не может иметь ответ до статуса received или closed');
    }

    if (status === 'resolved') {
      if (sentDate) issues.push('resolved не может иметь дату отправки');
      if (followUpDate) issues.push('resolved не может иметь дату повторного контакта');
    }

    if (followUp && sent && followUp < sent) issues.push('повторный контакт раньше отправки');
    if (response && sent && response < sent) issues.push('ответ раньше отправки');

    return issues;
  }

  function readiness(item) {
    if (item.status !== 'draft') return { state: 'not_draft', missing: [] };
    const missing = [];
    if (!item.channel) missing.push('channel');
    if (!item.contact) missing.push('contact');
    if (!item.owner) missing.push('owner');
    return { state: missing.length ? 'blocked' : 'ready', missing };
  }

  function isOverdue(item, now = new Date()) {
    if (!item.follow_up_date || TERMINAL_STATUSES.has(item.status)) return false;
    const deadline = new Date(`${item.follow_up_date}T23:59:59Z`);
    return !Number.isNaN(deadline.getTime()) && deadline < now;
  }

  return {
    FOLLOW_UP_STATUSES,
    RESPONSE_STATUSES,
    SENT_STATUSES,
    TERMINAL_STATUSES,
    isIsoDate,
    isOverdue,
    readiness,
    validationIssues
  };
}));
