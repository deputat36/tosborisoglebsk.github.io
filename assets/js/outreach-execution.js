(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OutreachExecution = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REGISTER_HEADERS = [
    'outreach_id', 'request_group', 'source_request_id', 'subject', 'recipient_type',
    'channel', 'contact', 'status', 'sent_date', 'follow_up_date', 'response_date',
    'response_source', 'owner', 'blocker', 'next_step'
  ];

  const clean = (value) => String(value == null ? '' : value).trim();

  function parseCsv(text) {
    const result = [];
    let row = [];
    let value = '';
    let quoted = false;
    const source = String(text || '').replace(/^\ufeff/, '');
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

  function buildSourceIndex(sources) {
    return {
      priority: indexBy(sources.priority || [], 'slug'),
      candidates: indexBy(sources.candidates || [], 'request_id'),
      projects: indexBy(sources.projects || [], 'request_id')
    };
  }

  function registryRequestText() {
    return [
      'Здравствуйте.',
      '',
      'Мы актуализируем открытый справочный каталог ТОС Борисоглебского городского округа на портале tosborisoglebsk.ru.',
      'Просим предоставить или подтвердить актуальный открытый список ТОС БГО: официальное название, тип, территорию и границы, действующий статус, год создания при наличии, открытые сведения о председателе или ответственном лице, разрешённые к публикации контакты и ссылки на официальные источники.',
      '',
      'Если часть сведений нельзя размещать открыто, просим отдельно указать, какие поля допустимы только для внутренней связи. Закрытые документы и личные данные для публикации не требуются.',
      '',
      'Спасибо за помощь в актуализации каталога ТОС БГО.'
    ].join('\n');
  }

  function priorityRequestText(source) {
    if (!source) return '';
    const missing = clean(source.missing).split(';').map(clean).filter(Boolean);
    const lines = [
      'Здравствуйте.',
      '',
      `Мы актуализируем карточку ${clean(source.tos)} (${clean(source.location)}) на портале tosborisoglebsk.ru.`,
      'Просим подтвердить актуальность открытых сведений о ТОС и сообщить, какие данные можно разместить публично.'
    ];
    if (missing.length) {
      lines.push('', 'Сейчас требуется уточнить:');
      missing.forEach((item) => lines.push(`— ${item};`));
    }
    lines.push(
      '',
      'Также просим прислать ссылку на открытый источник подтверждения и отдельно указать, какие контакты, фото или материалы разрешено публиковать.',
      '',
      'Если какие-либо сведения нельзя размещать открыто, их можно не передавать или отметить как непубличные.'
    );
    return lines.join('\n');
  }

  function buildRequestText(item, sources) {
    if (!item) return '';
    const index = buildSourceIndex(sources || {});
    if (item.request_group === 'registry') return registryRequestText();
    if (item.request_group === 'priority_card') return priorityRequestText(index.priority.get(clean(item.source_request_id)));
    if (item.request_group === 'candidate_registry') return clean(index.candidates.get(clean(item.source_request_id))?.request_text);
    if (item.request_group === 'project_result') return clean(index.projects.get(clean(item.source_request_id))?.request_text);
    return '';
  }

  function isIsoDate(value) {
    const text = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const date = new Date(`${text}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
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

  function validateExecution(item, draft) {
    const errors = [];
    const actualSent = Boolean(draft && draft.actual_sent);
    const fields = ['channel', 'contact', 'owner', 'sent_date', 'follow_up_date', 'evidence_ref', 'note'];
    for (const field of fields) {
      if (hasSensitivePattern(draft && draft[field])) errors.push(`${field}: обнаружен признак закрытого секрета`);
    }
    if (!actualSent) return { valid: errors.length === 0, actualSent: false, errors };
    if (!clean(draft.channel)) errors.push('укажите фактический канал');
    if (!clean(draft.contact)) errors.push('укажите фактического получателя или организацию');
    if (!clean(draft.owner)) errors.push('назначьте ответственного');
    if (!isIsoDate(draft.sent_date)) errors.push('укажите корректную дату фактической отправки');
    if (!isIsoDate(draft.follow_up_date)) errors.push('укажите корректную дату повторного контакта');
    if (isIsoDate(draft.sent_date) && isIsoDate(draft.follow_up_date) && draft.follow_up_date < draft.sent_date) {
      errors.push('дата повторного контакта не может быть раньше даты отправки');
    }
    if (clean(item?.status) !== 'draft') errors.push('экспорт отправки разрешён только для исходного статуса draft');
    return { valid: errors.length === 0, actualSent: true, errors };
  }

  function buildUpdatedRow(item, draft) {
    const validation = validateExecution(item, draft);
    if (!validation.actualSent || !validation.valid) {
      throw new Error(validation.errors.join('; ') || 'фактическая отправка не подтверждена');
    }
    return {
      ...item,
      channel: clean(draft.channel),
      contact: clean(draft.contact),
      status: 'sent',
      sent_date: clean(draft.sent_date),
      follow_up_date: clean(draft.follow_up_date),
      response_date: '',
      response_source: '',
      owner: clean(draft.owner),
      blocker: '',
      next_step: `ожидать ответ; повторный контакт ${clean(draft.follow_up_date)}`
    };
  }

  function serializeUpdatedRow(item, draft) {
    return serializeCsv(REGISTER_HEADERS, [buildUpdatedRow(item, draft)]);
  }

  function buildPreflightText(item, requestText, draft) {
    const lines = [
      `Карточка исполнения ${clean(item?.outreach_id)}`,
      `Тема: ${clean(item?.subject)}`,
      `Группа: ${clean(item?.request_group)}`,
      `Канал: ${clean(draft?.channel) || 'не указан'}`,
      `Получатель: ${clean(draft?.contact) || 'не указан'}`,
      `Ответственный: ${clean(draft?.owner) || 'не назначен'}`,
      `Дата отправки: ${clean(draft?.sent_date) || 'не подтверждена'}`,
      `Повторный контакт: ${clean(draft?.follow_up_date) || 'не назначен'}`,
      `Безопасная ссылка на след: ${clean(draft?.evidence_ref) || 'не указана'}`,
      '',
      'Текст запроса:',
      clean(requestText),
      '',
      `Примечание: ${clean(draft?.note) || 'нет'}`,
      '',
      'Эта карточка не подтверждает отправку, пока поле actual_sent не отмечено после реального действия.'
    ];
    return lines.join('\n');
  }

  return {
    REGISTER_HEADERS,
    buildPreflightText,
    buildRequestText,
    buildSourceIndex,
    buildUpdatedRow,
    escapeCsv,
    hasSensitivePattern,
    isIsoDate,
    parseCsv,
    priorityRequestText,
    registryRequestText,
    serializeCsv,
    serializeUpdatedRow,
    validateExecution
  };
}));