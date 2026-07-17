document.addEventListener('DOMContentLoaded', () => {
  const api = window.MediaPermissionScenarioValidation;
  const statsRoot = document.querySelector('#media-permission-scenario-stats');
  const listRoot = document.querySelector('#media-permission-scenario-list');
  if (!api || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  const labels = { people: 'Люди', public_space: 'Пространство', identity: 'Символика', documents: 'Документы', third_party: 'Сторонние материалы', audiovisual: 'Видео и аудио' };

  function parseCsv(text) {
    const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
    const headers = (lines.shift() || '').split(',');
    return lines.map((line) => {
      const cells = line.split(',');
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
    });
  }

  const codes = (value) => api.list(value).map((item) => `<code>${esc(item)}</code>`).join(' ');

  function render(rows) {
    const summary = api.summarize(rows);
    const stats = [
      ['Сценариев', summary.total], ['Черновиков', summary.draft], ['Групп', summary.groups],
      ['Без решения', summary.undecided], ['Без доказательства', summary.withoutEvidence], ['Ошибки', summary.invalid]
    ];
    statsRoot.innerHTML = stats.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
    listRoot.innerHTML = `<div class="grid">${rows.map((row, index) => {
      const issues = api.validationIssues(row, index);
      const state = issues.length ? '<span class="tag warn">Ошибка структуры</span>' : '<span class="tag">Черновик</span>';
      const decision = row.selected_permission_scope_code ? `<code>${esc(row.selected_permission_scope_code)}</code>` : '<span class="tiny">не выбрано</span>';
      return `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(row.sequence)}</span><span class="tag">${esc(labels[row.scenario_group] || row.scenario_group)}</span>${state}</div><h3>${esc(row.scenario_title)}</h3><p><b>Типы:</b> ${codes(row.media_type_codes)}</p><p><b>Контекст:</b> ${codes(row.participant_context_codes)}</p><p><b>Поверхности:</b> ${codes(row.publication_surface_codes)}</p><p><b>Вопросы:</b> ${codes(row.verification_question_codes)}</p><p><b>Решение:</b> ${decision}</p><div class="notice"><b>Блокер:</b> ${esc(row.blocker)}<br><span class="tiny">${esc(row.next_step)}</span></div></div></article>`;
    }).join('')}</div>`;
  }

  fetch('/data/media_permission_scenarios.csv', { cache: 'no-store' })
    .then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); })
    .then((text) => render(parseCsv(text)))
    .catch(() => {
      statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>данные не загружены</span></article>';
      listRoot.innerHTML = '<div class="empty">Откройте CSV напрямую.</div>';
    });
});
