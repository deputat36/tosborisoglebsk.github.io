(function initPublicationBasisExecution(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PublicationBasisExecution = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  'use strict';

  const REGISTER_HEADERS = [
    'tos_slug', 'wave', 'priority', 'score', 'template_id', 'request_status',
    'recipient_role', 'channel_type', 'owner_role', 'sent_date', 'follow_up_date',
    'response_date', 'reviewed_at', 'reviewed_by_role', 'chairperson_status',
    'field_types_to_keep', 'field_types_to_remove', 'preferred_public_channel_type',
    'personal_profile_classification', 'factual_source_ref', 'decision_status',
    'blocker', 'next_step'
  ];

  const clean = (value) => String(value == null ? '' : value).trim();

  function parseCsv(text) {
    const source = String(text || '').replace(/^\ufeff/, '');
    const result = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(value); value = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(value);
        if (row.some((cell) => cell !== '')) result.push(row);
        row = [];
        value = '';
      } else value += char;
    }
    if (value || row.length) { row.push(value); result.push(row); }
    const headers = result.shift() || [];
    return result.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  }

  function escapeCsv(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function serializeCsv(headers, rows) {
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header] || '')).join(','))].join('\n');
  }

  function indexBy(rows, field) {
    return new Map((rows || []).filter((row) => clean(row[field])).map((row) => [clean(row[field]), row]));
  }

  function isIsoDate(value) {
    const text = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const date = new Date(`${text}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
  }

  function fieldTypeLabel(code) {
    return ({
      chairperson: 'председатель или уполномоченный представитель',
      phones: 'телефон',
      emails: 'электронная почта',
      chairperson_links: 'ссылки, связанные с председателем',
      social_links: 'ссылки на социальные сети или сообщества'
    })[clean(code)] || clean(code);
  }

  function fillTemplate(value, replacements) {
    let output = String(value || '');
    Object.entries(replacements || {}).forEach(([placeholder, replacement]) => {
      output = output.split(placeholder).join(clean(replacement));
    });
    return output;
  }

  function buildRequestPacket(item, queueRow, tosRow, template, responseDeadline) {
    if (!item || !queueRow || !tosRow || !template) return null;
    const fieldTypes = clean(queueRow.personal_fields).split(';').map(fieldTypeLabel).filter(Boolean);
    const replacements = {
      '[НАЗВАНИЕ ТОС]': `ТОС «${clean(tosRow.name || item.tos_slug)}»`,
      '[ССЫЛКА НА КАРТОЧКУ]': `https://tosborisoglebsk.ru/tos/${clean(item.tos_slug)}/`,
      '[ПЕРЕЧЕНЬ ТИПОВ ОПУБЛИКОВАННЫХ ПОЛЕЙ]': fieldTypes.join(', '),
      '[СРОК ОТВЕТА]': clean(responseDeadline) || '[УКАЖИТЕ СРОК ОТВЕТА]'
    };
    return {
      tosSlug: clean(item.tos_slug),
      tosName: clean(tosRow.name || item.tos_slug),
      cardUrl: replacements['[ССЫЛКА НА КАРТОЧКУ]'],
      fieldTypes,
      subject: fillTemplate(template.subject, replacements),
      message: fillTemplate(template.message, replacements),
      templateId: clean(template.id),
      responseDeadline: clean(responseDeadline)
    };
  }

  function hasSensitivePattern(value) {
    const text = String(value || '');
    return [
      /(?:password|парол[ья]|secret|секрет)\s*[:=]\s*\S+/i,
      /(?:token|токен)\s*[:=]\s*[A-Za-z0-9_.\-]{12,}/i,
      /gh[pousr]_[A-Za-z0-9]{20,}/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/
    ].some((pattern) => pattern.test(text));
  }

  function validateExecution(item, draft, registerValidation) {
    const errors = [];
    const actualSent = Boolean(draft && draft.actual_sent);
    for (const field of ['recipient_role', 'channel_type', 'owner_role', 'note']) {
      if (hasSensitivePattern(draft && draft[field])) errors.push(`${field}: обнаружен признак закрытого секрета`);
    }
    if (!actualSent) return { valid: errors.length === 0, actualSent: false, errors };
    if (!clean(draft.recipient_role)) errors.push('укажите обезличенную роль получателя');
    if (!clean(draft.channel_type)) errors.push('укажите тип фактического канала');
    if (!clean(draft.owner_role)) errors.push('назначьте роль ответственного');
    if (!isIsoDate(draft.sent_date)) errors.push('укажите дату фактической отправки');
    if (!isIsoDate(draft.follow_up_date)) errors.push('укажите дату повторного контакта');
    if (isIsoDate(draft.sent_date) && isIsoDate(draft.follow_up_date) && draft.follow_up_date < draft.sent_date) {
      errors.push('дата повторного контакта не может быть раньше даты отправки');
    }
    if (clean(item && item.request_status) !== 'draft') errors.push('экспорт sent разрешён только для исходного статуса draft');
    if (errors.length === 0 && registerValidation && typeof registerValidation.validationIssues === 'function') {
      const candidate = buildUpdatedRow(item, draft, null, true);
      errors.push(...registerValidation.validationIssues(candidate));
    }
    return { valid: errors.length === 0, actualSent: true, errors: Array.from(new Set(errors)) };
  }

  function buildUpdatedRow(item, draft, registerValidation, skipValidation) {
    if (!skipValidation) {
      const result = validateExecution(item, draft, registerValidation);
      if (!result.actualSent || !result.valid) throw new Error(result.errors.join('; ') || 'фактическая отправка не подтверждена');
    }
    return {
      ...item,
      request_status: 'sent',
      recipient_role: clean(draft.recipient_role),
      channel_type: clean(draft.channel_type),
      owner_role: clean(draft.owner_role),
      sent_date: clean(draft.sent_date),
      follow_up_date: clean(draft.follow_up_date),
      response_date: '',
      reviewed_at: '',
      reviewed_by_role: '',
      chairperson_status: '',
      field_types_to_keep: '',
      field_types_to_remove: '',
      preferred_public_channel_type: '',
      personal_profile_classification: '',
      factual_source_ref: '',
      decision_status: 'not_reviewed',
      blocker: '',
      next_step: `ожидать ответ; повторный контакт ${clean(draft.follow_up_date)}`
    };
  }

  function serializeUpdatedRow(item, draft, registerValidation) {
    return serializeCsv(REGISTER_HEADERS, [buildUpdatedRow(item, draft, registerValidation)]);
  }

  function buildPreflightText(item, packet, draft) {
    return [
      `Карточка подготовки ${clean(item && item.tos_slug)}`,
      `ТОС: ${clean(packet && packet.tosName)}`,
      `Шаблон: ${clean(packet && packet.templateId)}`,
      `Карточка портала: ${clean(packet && packet.cardUrl)}`,
      `Типы опубликованных полей: ${(packet && packet.fieldTypes || []).join(', ') || 'не определены'}`,
      `Срок ответа в сообщении: ${clean(packet && packet.responseDeadline) || 'не указан'}`,
      `Роль получателя: ${clean(draft && draft.recipient_role) || 'не указана'}`,
      `Тип канала: ${clean(draft && draft.channel_type) || 'не указан'}`,
      `Ответственный: ${clean(draft && draft.owner_role) || 'не назначен'}`,
      `Дата отправки: ${clean(draft && draft.sent_date) || 'не подтверждена'}`,
      `Повторный контакт: ${clean(draft && draft.follow_up_date) || 'не назначен'}`,
      '',
      `Тема: ${clean(packet && packet.subject)}`,
      '',
      clean(packet && packet.message),
      '',
      `Примечание: ${clean(draft && draft.note) || 'нет'}`,
      '',
      'Карточка не подтверждает отправку, пока actual_sent не отмечено после реального действия. Она не создаёт publication_consent_ref и не является юридическим согласием.'
    ].join('\n');
  }

  return {
    REGISTER_HEADERS,
    buildPreflightText,
    buildRequestPacket,
    buildUpdatedRow,
    escapeCsv,
    fieldTypeLabel,
    fillTemplate,
    hasSensitivePattern,
    indexBy,
    isIsoDate,
    parseCsv,
    serializeCsv,
    serializeUpdatedRow,
    validateExecution
  };
}));
