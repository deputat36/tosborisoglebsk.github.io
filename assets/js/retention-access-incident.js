document.addEventListener('DOMContentLoaded', () => {
  const api = window.RetentionAccessIncidentValidation;
  const statsRoot = document.querySelector('#retention-access-incident-stats');
  const listRoot = document.querySelector('#retention-access-incident-list');
  if (!api || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const labels = { retention: 'Сроки хранения', access: 'Доступ', backup: 'Резервирование', deletion: 'Удаление', continuity: 'Передача реестра', incident: 'Инциденты' };

  function parseCsv(text) {
    const table = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(value); value = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(value);
        if (row.some((cell) => cell !== '')) table.push(row);
        row = [];
        value = '';
      } else value += char;
    }
    if (value || row.length) { row.push(value); table.push(row); }
    const headers = table.shift() || [];
    return table.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  }

  const codes = (value) => {
    const items = api.list(value);
    return items.length ? items.map((item) => `<code>${esc(item)}</code>`).join(' ') : '<span class="tiny">не указано</span>';
  };

  function render(rows) {
    const summary = api.summarize(rows);
    const stats = [
      ['Контрольных областей', summary.total], ['Черновиков', summary.draft],
      ['Тематических групп', summary.domains], ['Без принятого правила', summary.undecided],
      ['Реализация не начата', summary.notStarted], ['Ошибки структуры', summary.invalid]
    ];
    statsRoot.innerHTML = stats.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
    listRoot.innerHTML = `<div class="grid">${rows.map((row, index) => {
      const issues = api.validationIssues(row, index);
      const state = issues.length ? `<span class="tag warn">Ошибка структуры</span><div class="tiny">${issues.map(esc).join('; ')}</div>` : '<span class="tag">Черновик для проверки</span>';
      return `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(row.sequence)}</span><span class="tag">${esc(labels[row.domain_code] || row.domain_code)}</span>${state}</div><h3>${esc(row.rule_title)}</h3><p><b>Предлагаемые контроли:</b> ${codes(row.draft_requirement_codes)}</p><p><b>Вопросы проверки:</b> ${codes(row.verification_question_codes)}</p><p><b>Принятое правило:</b> <span class="tiny">не выбрано</span></p><p><b>Реализация:</b> <code>${esc(row.implementation_status)}</code></p><div class="notice"><b>Блокер:</b> ${esc(row.blocker)}<br><span class="tiny">${esc(row.next_step)}</span></div></div></article>`;
    }).join('')}</div>`;
  }

  fetch('/data/retention_access_incident_rules.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => render(parseCsv(text.replace(/^\ufeff/, ''))))
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>матрица не загружена</span></article>';
      listRoot.innerHTML = '<div class="empty">Не удалось загрузить матрицу. Откройте CSV напрямую.</div>';
    });
});
