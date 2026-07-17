document.addEventListener('DOMContentLoaded', () => {
  const validation = window.WithdrawalCorrectionDeletionValidation;
  const statsRoot = document.querySelector('#withdrawal-correction-deletion-stats');
  const listRoot = document.querySelector('#withdrawal-correction-deletion-list');
  if (!validation || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

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
      ['Этапов', summary.total],
      ['Черновиков', summary.draft],
      ['Без владельца', summary.withoutOwner],
      ['Без канала', summary.withoutChannel],
      ['Без срока', summary.withoutTargetTime],
      ['Без доказательства', summary.withoutEvidence],
      ['Ошибки структуры', summary.invalid]
    ];
    statsRoot.innerHTML = stats.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');

    listRoot.innerHTML = `<div class="grid">${rows.map((row, index) => {
      const issues = validation.validationIssues(row, index);
      const state = issues.length
        ? `<span class="tag warn">Ошибка структуры</span><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : '<span class="tag">Черновик процесса</span>';
      return `<article class="card"><div class="card-inner">
        <div class="meta"><span class="tag">${esc(row.sequence)}</span>${state}</div>
        <h3>${esc(row.stage_title)}</h3>
        <p>${esc(row.draft_purpose)}</p>
        <p><b>Типы запросов:</b> ${codeList(row.request_type_codes)}</p>
        <p><b>Входы:</b> ${codeList(row.input_codes)}</p>
        <p><b>Действия:</b> ${codeList(row.action_codes)}</p>
        <p><b>Результаты:</b> ${codeList(row.output_codes)}</p>
        <p class="tiny"><b>Владелец:</b> не назначен · <b>Канал:</b> не выбран · <b>Срок:</b> не установлен</p>
        <div class="notice"><b>Блокер:</b> ${esc(row.blocker)}<br><span class="tiny">${esc(row.next_step)}</span></div>
      </div></article>`;
    }).join('')}</div>`;
  }

  fetch('/data/withdrawal_correction_deletion_process.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => render(parseCsv(text.replace(/^\ufeff/, ''))))
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>процесс не загружен</span></article>';
      listRoot.innerHTML = '<div class="empty">Не удалось загрузить черновой процесс. Откройте CSV напрямую.</div>';
    });
});
