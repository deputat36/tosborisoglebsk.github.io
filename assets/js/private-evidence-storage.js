document.addEventListener('DOMContentLoaded', () => {
  const validation = window.PrivateEvidenceStorageValidation;
  const statsRoot = document.querySelector('#private-evidence-storage-stats');
  const listRoot = document.querySelector('#private-evidence-storage-list');
  if (!validation || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const groupLabels = {
    access: 'Доступ', accountability: 'Подотчётность', security: 'Защита', resilience: 'Устойчивость',
    portability: 'Переносимость', lifecycle: 'Жизненный цикл', incident: 'Инциденты', legal: 'Условия обработки', governance: 'Управление'
  };
  const resultLabels = { not_assessed: 'не оценён' };

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

  function render(rows) {
    const summary = validation.summarize(rows);
    const stats = [
      ['Критериев', summary.total],
      ['Обязательных', summary.mandatory],
      ['Слотов сравнения', summary.candidateSlots],
      ['Не оценено', summary.notAssessed],
      ['Выбранных вариантов', summary.selected],
      ['Назначенных ролей', summary.withRoles],
      ['Ошибки структуры', summary.invalid]
    ];
    statsRoot.innerHTML = stats.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');

    listRoot.innerHTML = `<div class="grid">${rows.map((row, index) => {
      const issues = validation.validationIssues(row, index);
      const state = issues.length
        ? `<span class="tag warn">Ошибка структуры</span><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : '<span class="tag">Черновик критериев</span>';
      const candidates = ['a', 'b', 'c'].map((code) => {
        const result = row[`candidate_${code}_result`];
        return `<span class="tag warn">Кандидат ${code.toUpperCase()}: ${esc(resultLabels[result] || result)}</span>`;
      }).join(' ');
      return `<article class="card"><div class="card-inner">
        <div class="meta"><span class="tag">${esc(row.sequence)}</span><span class="tag">${esc(groupLabels[row.requirement_group] || row.requirement_group)}</span><span class="tag ${row.criticality === 'mandatory' ? 'warn' : ''}">${row.criticality === 'mandatory' ? 'обязательно' : 'важно'}</span>${state}</div>
        <h3>${esc(row.requirement_title)}</h3>
        <p><b>Минимальное требование:</b> ${esc(row.minimum_requirement)}</p>
        <p><b>Как проверять:</b> ${esc(row.verification_method)}</p>
        <div class="meta">${candidates}</div>
        <div class="notice"><b>Блокер:</b> ${esc(row.blocker)}<br><span class="tiny">${esc(row.next_step)}</span></div>
      </div></article>`;
    }).join('')}</div>`;
  }

  fetch('/data/private_evidence_storage_requirements.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => render(parseCsv(text.replace(/^\ufeff/, ''))))
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>матрица не загружена</span></article>';
      listRoot.innerHTML = '<div class="empty">Не удалось загрузить требования к закрытому хранилищу. Откройте CSV напрямую.</div>';
    });
});