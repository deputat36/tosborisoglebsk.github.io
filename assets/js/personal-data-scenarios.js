document.addEventListener('DOMContentLoaded', () => {
  const validation = window.PersonalDataScenarioValidation;
  const statsRoot = document.querySelector('#personal-data-scenario-stats');
  const listRoot = document.querySelector('#personal-data-scenario-list');
  if (!validation || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const labels = {
    public_tos_card: 'Публичная карточка ТОС',
    update_request: 'Запрос на обновление карточки',
    media_submission: 'Передача и публикация медиа',
    correction_deletion_request: 'Исправление или удаление публикации'
  };

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

  function codeList(value) {
    const items = validation.list(value);
    return items.length ? items.map((item) => `<code>${esc(item)}</code>`).join(' ') : '<span class="tiny">не указано</span>';
  }

  function render(rows) {
    const summary = validation.summarize(rows);
    const stats = [
      ['Сценариев', summary.total],
      ['Черновиков', summary.draft],
      ['С публичным результатом', summary.withPublicOutput],
      ['Без выбранного основания', summary.missingBasis],
      ['Без срока хранения', summary.missingRetention],
      ['Ошибки структуры', summary.invalid]
    ];
    statsRoot.innerHTML = stats.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');

    listRoot.innerHTML = `<div class="grid">${rows.map((row, index) => {
      const issues = validation.validationIssues(row, index);
      const state = issues.length
        ? `<span class="tag warn">Ошибка структуры</span><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : '<span class="tag">Черновик для проверки</span>';
      return `<article class="card"><div class="card-inner">
        <div class="meta"><span class="tag">${esc(row.sequence)}</span>${state}</div>
        <h3>${esc(labels[row.scenario_id] || row.scenario_title)}</h3>
        <p>${esc(row.draft_purpose)}</p>
        <p><b>Участники:</b> ${codeList(row.actor_codes)}</p>
        <p><b>Источники:</b> ${codeList(row.source_codes)}</p>
        <p><b>Группы полей:</b> ${codeList(row.field_group_codes)}</p>
        <p><b>Публичный результат:</b> ${codeList(row.public_output_codes)}</p>
        <p><b>Внутренний след:</b> ${codeList(row.internal_record_codes)}</p>
        <p><b>Действия:</b> ${codeList(row.action_codes)}</p>
        <p><b>Вопросы для проверки:</b> ${codeList(row.review_question_codes)}</p>
        <div class="notice"><b>Блокер:</b> ${esc(row.blocker)}<br><span class="tiny">${esc(row.next_step)}</span></div>
      </div></article>`;
    }).join('')}</div>`;
  }

  fetch('/data/personal_data_scenario_matrix.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => render(parseCsv(text.replace(/^\ufeff/, ''))))
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>матрица не загружена</span></article>';
      listRoot.innerHTML = '<div class="empty">Не удалось загрузить матрицу сценариев. Откройте CSV напрямую.</div>';
    });
});
