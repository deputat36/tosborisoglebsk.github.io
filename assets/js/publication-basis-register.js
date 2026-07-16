document.addEventListener('DOMContentLoaded', () => {
  const validation = window.PublicationBasisValidation;
  const statsRoot = document.querySelector('#publication-basis-stats');
  const listRoot = document.querySelector('#publication-basis-list');
  if (!validation || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const statusLabels = {
    draft: 'Черновик',
    sent: 'Отправлено',
    waiting: 'Ожидается ответ',
    received: 'Ответ получен',
    needs_clarification: 'Нужно уточнение',
    closed_without_response: 'Закрыто без ответа'
  };

  const decisionLabels = {
    not_reviewed: 'Не разобрано',
    keep_current: 'Оставить подтверждённое',
    remove_fields: 'Удалить поля',
    replace_with_general_channel: 'Заменить общим каналом',
    hide_until_confirmed: 'Скрыть до подтверждения',
    no_change_without_evidence: 'Не менять без доказательств'
  };

  let rows = [];
  let filter = 'all';

  function parseCsv(text) {
    const result = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
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

  function isOverdue(item) {
    if (!item.follow_up_date || ['received', 'closed_without_response'].includes(item.request_status)) return false;
    const deadline = new Date(`${item.follow_up_date}T23:59:59`);
    return !Number.isNaN(deadline.getTime()) && deadline < new Date();
  }

  function visibleRows() {
    return rows.filter((item) => {
      const issues = validation.validationIssues(item);
      if (filter === 'all') return true;
      if (filter === 'wave1') return item.wave === '1';
      if (filter === 'wave2') return item.wave === '2';
      if (filter === 'wave3') return item.wave === '3';
      if (filter === 'ready') return validation.isReadyToSend(item);
      if (filter === 'overdue') return isOverdue(item);
      if (filter === 'invalid') return issues.length > 0;
      if (filter === 'finalized') return validation.isFinalized(item);
      return item.request_status === filter;
    });
  }

  function renderStats() {
    const values = [
      ['Всего карточек', rows.length],
      ['Черновики', rows.filter((item) => item.request_status === 'draft').length],
      ['Готово к отправке', rows.filter(validation.isReadyToSend).length],
      ['Отправлено или ждём', rows.filter((item) => ['sent', 'waiting'].includes(item.request_status)).length],
      ['Ответ получен', rows.filter((item) => ['received', 'needs_clarification'].includes(item.request_status)).length],
      ['Завершено', rows.filter(validation.isFinalized).length],
      ['Просрочен повтор', rows.filter(isOverdue).length],
      ['Ошибки данных', rows.filter((item) => validation.validationIssues(item).length > 0).length]
    ];
    statsRoot.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function renderTable() {
    const items = visibleRows();
    if (!items.length) {
      listRoot.innerHTML = '<div class="empty">По выбранному фильтру задач нет.</div>';
      return;
    }

    listRoot.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Карточка</th><th>Волна</th><th>Статус</th><th>Готовность</th><th>Канал и роли</th><th>Даты</th><th>Решение</th><th>Контроль</th></tr></thead><tbody>${items.map((item) => {
      const issues = validation.validationIssues(item);
      const overdue = isOverdue(item);
      const readiness = validation.readinessReason(item);
      const dates = [
        item.sent_date ? `отправлено: ${item.sent_date}` : '',
        item.follow_up_date ? `повтор: ${item.follow_up_date}` : '',
        item.response_date ? `ответ: ${item.response_date}` : '',
        item.reviewed_at ? `разбор: ${item.reviewed_at}` : ''
      ].filter(Boolean).join('<br>') || 'не указаны';
      const channel = [
        item.recipient_role ? `получатель: ${item.recipient_role}` : '',
        item.channel_type ? `канал: ${item.channel_type}` : '',
        item.owner_role ? `ответственный: ${item.owner_role}` : ''
      ].filter(Boolean).map(esc).join('<br>') || 'не определены';
      const decision = `<b>${esc(decisionLabels[item.decision_status] || item.decision_status)}</b>${item.factual_source_ref ? `<div class="tiny">source: ${esc(item.factual_source_ref)}</div>` : ''}`;
      const control = issues.length
        ? `<span class="tag warn">Ошибка данных</span><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : `<span class="tag${overdue ? ' warn' : ''}">${esc(overdue ? 'Просрочен повтор' : 'Структура корректна')}</span><div class="tiny">${esc(item.blocker || item.next_step || '')}</div>`;
      const statusClass = overdue || item.request_status === 'needs_clarification' ? ' warn' : '';
      return `<tr><td><a href="/tos/${esc(item.tos_slug)}/"><b>${esc(item.tos_slug)}</b></a><div class="tiny">${esc(item.template_id)}</div></td><td><b>${esc(item.wave)}</b><div class="tiny">${esc(item.priority)} · score ${esc(item.score)}</div></td><td><span class="tag${statusClass}">${esc(statusLabels[item.request_status] || item.request_status)}</span></td><td>${esc(readiness || (validation.isFinalized(item) ? 'этап завершён' : 'в работе'))}</td><td>${channel}</td><td>${dates}</td><td>${decision}</td><td>${control}<div class="tiny">${esc(item.next_step || '')}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function render() {
    renderStats();
    renderTable();
  }

  document.querySelectorAll('[data-publication-basis-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.publicationBasisFilter || 'all';
      document.querySelectorAll('[data-publication-basis-filter]').forEach((item) => item.classList.toggle('primary', item === button));
      renderTable();
    });
  });

  fetch('/data/publication_basis_confirmation_register.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => { rows = parseCsv(text.replace(/^\ufeff/, '')); render(); })
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>CSV не загружен</span></article>';
      listRoot.innerHTML = '<div class="empty">Не удалось загрузить журнал. Откройте CSV напрямую.</div>';
    });
});
