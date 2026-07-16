document.addEventListener('DOMContentLoaded', () => {
  const validation = window.OutreachValidation;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const groupLabels = { registry: 'Полный реестр', priority_card: 'Приоритетная карточка', candidate_registry: 'Кандидат реестра', project_result: 'Проект 2026' };
  const statusLabels = { draft: 'Черновик', sent: 'Отправлено', waiting: 'Ждём ответ', follow_up: 'Повторный контакт', received: 'Ответ получен', closed: 'Закрыто после ответа', resolved: 'Решено без обращения' };
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

  function validationIssues(item) {
    const issues = [];
    if (!item.outreach_id) issues.push('нет outreach_id');
    if (!item.source_request_id) issues.push('нет source_request_id');
    if (!item.subject) issues.push('нет темы запроса');
    if (!groupLabels[item.request_group]) issues.push('неизвестная группа');
    if (!statusLabels[item.status]) issues.push('неизвестный статус');
    if (validation) issues.push(...validation.validationIssues(item));
    else issues.push('не загружен единый валидатор');
    return Array.from(new Set(issues));
  }

  function readiness(item) {
    return validation ? validation.readiness(item) : { state: 'blocked', missing: ['validator'] };
  }

  function isOverdue(item) {
    return validation ? validation.isOverdue(item) : false;
  }

  function needsChannel(item) {
    const result = readiness(item);
    return result.state === 'blocked' && (result.missing.includes('channel') || result.missing.includes('contact'));
  }

  function needsOwner(item) {
    const result = readiness(item);
    return result.state === 'blocked' && result.missing.includes('owner');
  }

  function isReady(item) {
    return readiness(item).state === 'ready';
  }

  function visibleRows() {
    return rows.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'ready') return isReady(item);
      if (filter === 'needs_channel') return needsChannel(item);
      if (filter === 'needs_owner') return needsOwner(item);
      if (filter === 'overdue') return isOverdue(item);
      if (filter === 'invalid') return validationIssues(item).length > 0;
      if (filter === 'active') return !['received', 'closed', 'resolved'].includes(item.status);
      return item.request_group === filter || item.status === filter;
    });
  }

  function renderStats() {
    const root = document.querySelector('#outreach-stats');
    if (!root) return;
    const values = [
      ['Всего задач', rows.length],
      ['Черновики', rows.filter((item) => item.status === 'draft').length],
      ['Готово к отправке', rows.filter(isReady).length],
      ['Нужен канал/получатель', rows.filter(needsChannel).length],
      ['Нужен ответственный', rows.filter(needsOwner).length],
      ['Отправлено', rows.filter((item) => item.sent_date).length],
      ['Ответы', rows.filter((item) => ['received', 'closed'].includes(item.status)).length],
      ['Решено без обращения', rows.filter((item) => item.status === 'resolved').length],
      ['Просрочен повтор', rows.filter(isOverdue).length],
      ['Ошибки данных', rows.filter((item) => validationIssues(item).length).length]
    ];
    root.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function readinessMarkup(item) {
    if (item.status !== 'draft') return '';
    const result = readiness(item);
    if (result.state === 'ready') return '<div class="meta"><span class="tag">Готово к отправке</span></div>';
    const labels = {
      channel: 'канал',
      contact: 'получатель',
      owner: 'ответственный',
      validator: 'валидатор'
    };
    return `<div class="meta"><span class="tag warn">Не готово</span></div><div class="tiny">нужно заполнить: ${result.missing.map((key) => esc(labels[key] || key)).join(', ')}</div>`;
  }

  function renderTable() {
    const root = document.querySelector('#outreach-list');
    if (!root) return;
    const items = visibleRows();
    if (!items.length) { root.innerHTML = '<div class="empty">По выбранному фильтру задач нет.</div>'; return; }
    root.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Задача</th><th>Группа</th><th>Статус</th><th>Канал и получатель</th><th>Ответственный</th><th>Даты</th><th>Контроль</th></tr></thead><tbody>${items.map((item) => {
      const overdue = isOverdue(item);
      const issues = validationIssues(item);
      const dates = [item.sent_date ? `отправлено: ${item.sent_date}` : '', item.follow_up_date ? `повтор: ${item.follow_up_date}` : '', item.response_date ? `результат: ${item.response_date}` : ''].filter(Boolean).join('<br>') || 'не указаны';
      const validationMarkup = issues.length ? `<div class="meta"><span class="tag warn">Ошибка данных</span></div><div class="tiny">${issues.map(esc).join('; ')}</div>` : '<div class="tiny">структура строки корректна</div>';
      return `<tr><td><b>${esc(item.subject)}</b><div class="tiny">${esc(item.outreach_id)} · ${esc(item.source_request_id)}</div></td><td>${esc(groupLabels[item.request_group] || item.request_group)}</td><td><span class="tag ${overdue || item.status === 'follow_up' ? 'warn' : ''}">${esc(overdue ? 'Просрочен повтор' : (statusLabels[item.status] || item.status))}</span>${readinessMarkup(item)}</td><td>${esc(item.channel || (item.status === 'resolved' ? 'обращение не потребовалось' : 'не определён'))}<div class="tiny">${esc(item.contact || 'получатель не указан')}</div></td><td>${esc(item.owner || 'не назначен')}</td><td>${dates}</td><td>${validationMarkup}<b>${esc(item.blocker || 'нет блокера')}</b><div class="tiny">${esc(item.next_step || '')}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function render() { renderStats(); renderTable(); }
  document.querySelectorAll('[data-outreach-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.outreachFilter || 'all';
      document.querySelectorAll('[data-outreach-filter]').forEach((item) => item.classList.toggle('primary', item === button));
      renderTable();
    });
  });
  fetch('/data/outreach_register.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => { rows = parseCsv(text.replace(/^\ufeff/, '')); render(); })
    .catch(() => {
      const stats = document.querySelector('#outreach-stats');
      const list = document.querySelector('#outreach-list');
      if (stats) stats.innerHTML = '<article class="stat"><b>Ошибка</b><span>CSV не загружен</span></article>';
      if (list) list.innerHTML = '<div class="empty">Не удалось загрузить журнал. Откройте CSV напрямую.</div>';
    });
});
