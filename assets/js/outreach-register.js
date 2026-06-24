document.addEventListener('DOMContentLoaded', () => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const groupLabels = {
    registry: 'Полный реестр',
    priority_card: 'Приоритетная карточка',
    candidate_registry: 'Кандидат реестра',
    project_result: 'Проект 2026'
  };

  const statusLabels = {
    draft: 'Черновик',
    sent: 'Отправлено',
    waiting: 'Ждём ответ',
    follow_up: 'Повторный контакт',
    received: 'Ответ получен',
    closed: 'Закрыто'
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
        if (row.some((cell) => cell !== '')) result.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }
    if (value || row.length) {
      row.push(value);
      result.push(row);
    }

    const headers = result.shift() || [];
    return result.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  }

  function dateValue(value) {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function validationIssues(item) {
    const issues = [];
    const sent = dateValue(item.sent_date);
    const followUp = dateValue(item.follow_up_date);
    const response = dateValue(item.response_date);
    const activeAfterDraft = ['sent', 'waiting', 'follow_up', 'received', 'closed'].includes(item.status);

    if (!item.outreach_id) issues.push('нет outreach_id');
    if (!item.source_request_id) issues.push('нет source_request_id');
    if (!item.subject) issues.push('нет темы запроса');
    if (!groupLabels[item.request_group]) issues.push('неизвестная группа');
    if (!statusLabels[item.status]) issues.push('неизвестный статус');
    if (activeAfterDraft && !item.channel) issues.push('для статуса нужен канал');
    if (activeAfterDraft && !sent) issues.push('для статуса нужна дата отправки');
    if (['waiting', 'follow_up'].includes(item.status) && !followUp) issues.push('не указана дата повторного контакта');
    if (['received', 'closed'].includes(item.status) && !response) issues.push('не указана дата ответа');
    if (['received', 'closed'].includes(item.status) && !item.response_source) issues.push('не указан источник ответа');
    if (followUp && sent && followUp < sent) issues.push('повторный контакт раньше отправки');
    if (response && sent && response < sent) issues.push('ответ раньше отправки');
    return issues;
  }

  function isOverdue(item) {
    if (!item.follow_up_date || ['received', 'closed'].includes(item.status)) return false;
    const deadline = new Date(`${item.follow_up_date}T23:59:59`);
    return !Number.isNaN(deadline.getTime()) && deadline < new Date();
  }

  function visibleRows() {
    return rows.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return isOverdue(item);
      if (filter === 'invalid') return validationIssues(item).length > 0;
      if (filter === 'active') return !['received', 'closed'].includes(item.status);
      return item.request_group === filter || item.status === filter;
    });
  }

  function renderStats() {
    const root = document.querySelector('#outreach-stats');
    if (!root) return;
    const sent = rows.filter((item) => item.sent_date).length;
    const received = rows.filter((item) => item.response_date || item.status === 'received' || item.status === 'closed').length;
    const overdue = rows.filter(isOverdue).length;
    const invalid = rows.filter((item) => validationIssues(item).length).length;
    const values = [
      ['Всего задач', rows.length],
      ['Черновики', rows.filter((item) => item.status === 'draft').length],
      ['Отправлено', sent],
      ['Ответы', received],
      ['Повторный контакт', overdue],
      ['Ошибки данных', invalid]
    ];
    root.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function renderTable() {
    const root = document.querySelector('#outreach-list');
    if (!root) return;
    const items = visibleRows();
    if (!items.length) {
      root.innerHTML = '<div class="empty">По выбранному фильтру задач нет.</div>';
      return;
    }
    root.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Задача</th><th>Группа</th><th>Статус</th><th>Канал</th><th>Даты</th><th>Контроль</th></tr></thead><tbody>${items.map((item) => {
      const overdue = isOverdue(item);
      const issues = validationIssues(item);
      const dates = [
        item.sent_date ? `отправлено: ${item.sent_date}` : '',
        item.follow_up_date ? `повтор: ${item.follow_up_date}` : '',
        item.response_date ? `ответ: ${item.response_date}` : ''
      ].filter(Boolean).join('<br>') || 'не указаны';
      const validation = issues.length
        ? `<div class="meta"><span class="tag warn">Ошибка данных</span></div><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : '<div class="tiny">структура строки корректна</div>';
      return `<tr><td><b>${esc(item.subject)}</b><div class="tiny">${esc(item.outreach_id)} · ${esc(item.source_request_id)}</div></td><td>${esc(groupLabels[item.request_group] || item.request_group)}</td><td><span class="tag ${overdue || item.status === 'follow_up' ? 'warn' : ''}">${esc(overdue ? 'Просрочен повтор' : (statusLabels[item.status] || item.status))}</span></td><td>${esc(item.channel || 'не определён')}<div class="tiny">${esc(item.contact || '')}</div></td><td>${dates}</td><td>${validation}<b>${esc(item.blocker || 'нет блокера')}</b><div class="tiny">${esc(item.next_step || '')}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function render() {
    renderStats();
    renderTable();
  }

  document.querySelectorAll('[data-outreach-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.outreachFilter || 'all';
      document.querySelectorAll('[data-outreach-filter]').forEach((item) => item.classList.toggle('primary', item === button));
      renderTable();
    });
  });

  fetch('/data/outreach_register.csv', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('CSV unavailable');
      return response.text();
    })
    .then((text) => {
      rows = parseCsv(text.replace(/^\ufeff/, ''));
      render();
    })
    .catch(() => {
      const stats = document.querySelector('#outreach-stats');
      const list = document.querySelector('#outreach-list');
      if (stats) stats.innerHTML = '<article class="stat"><b>Ошибка</b><span>CSV не загружен</span></article>';
      if (list) list.innerHTML = '<div class="empty">Не удалось загрузить журнал. Откройте CSV напрямую.</div>';
    });
});
