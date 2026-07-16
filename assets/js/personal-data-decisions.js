document.addEventListener('DOMContentLoaded', () => {
  const validation = window.PersonalDataDecisionValidation;
  const statsRoot = document.querySelector('#personal-data-decision-stats');
  const listRoot = document.querySelector('#personal-data-decision-list');
  if (!validation || !statsRoot || !listRoot) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const decisionLabels = {
    operator_assignment: 'Назначение оператора',
    purposes_and_data_categories: 'Цели и категории данных',
    processing_and_distribution_basis: 'Основания обработки и распространения',
    distribution_consent_form: 'Согласие на распространение',
    media_permission_form: 'Разрешение на фотографии и медиа',
    withdrawal_correction_and_deletion_process: 'Отзыв, исправление и удаление',
    private_evidence_storage: 'Закрытое хранилище доказательств',
    retention_access_and_incident_rules: 'Хранение, доступ и инциденты'
  };

  const statusLabels = {
    pending: 'Ожидает решения',
    in_review: 'На проверке',
    blocked: 'Заблокировано',
    approved: 'Утверждено'
  };

  const implementationLabels = {
    not_started: 'Не начато',
    blocked: 'Заблокировано',
    ready: 'Готово к реализации',
    in_progress: 'Выполняется',
    completed: 'Реализовано'
  };

  let rows = [];
  let canonicalById = new Map();
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

  function issuesFor(row) {
    return validation.validationIssues(row, canonicalById.get(row.decision_id), rows);
  }

  function visibleRows() {
    return rows.filter((row) => {
      const issues = issuesFor(row);
      if (filter === 'all') return true;
      if (filter === 'needs_owner') return !row.decision_owner_role;
      if (filter === 'needs_legal_reviewer') return !row.legal_reviewer_role;
      if (filter === 'ready_for_review') return validation.isReadyForReview(row, rows);
      if (filter === 'implementation_pending') return row.decision_status === 'approved' && row.implementation_status !== 'completed';
      if (filter === 'invalid') return issues.length > 0;
      return row.decision_status === filter;
    });
  }

  function renderStats() {
    const values = [
      ['Всего решений', rows.length],
      ['Ожидают', rows.filter((row) => row.decision_status === 'pending').length],
      ['На проверке', rows.filter((row) => row.decision_status === 'in_review').length],
      ['Заблокированы', rows.filter((row) => row.decision_status === 'blocked').length],
      ['Утверждены', rows.filter((row) => row.decision_status === 'approved').length],
      ['Готовы к передаче', rows.filter((row) => validation.isReadyForReview(row, rows)).length],
      ['Без владельца', rows.filter((row) => !row.decision_owner_role).length],
      ['Ошибки данных', rows.filter((row) => issuesFor(row).length > 0).length]
    ];
    statsRoot.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function renderTable() {
    const items = visibleRows();
    if (!items.length) {
      listRoot.innerHTML = '<div class="empty">По выбранному фильтру решений нет.</div>';
      return;
    }

    listRoot.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Решение</th><th>Статус</th><th>Требуется до</th><th>Роли</th><th>Зависимости</th><th>Утверждение</th><th>Реализация</th><th>Следующий шаг</th></tr></thead><tbody>${items.map((row) => {
      const canonical = canonicalById.get(row.decision_id) || {};
      const issues = issuesFor(row);
      const roles = [
        row.decision_owner_role ? `владелец: ${row.decision_owner_role}` : 'владелец не назначен',
        row.legal_reviewer_role ? `проверяющий: ${row.legal_reviewer_role}` : 'юридический проверяющий не назначен'
      ].map(esc).join('<br>');
      const prerequisites = validation.prerequisiteIds(row);
      const approval = row.decision_status === 'approved'
        ? [row.selected_option_code, row.decision_ref, row.legal_review_ref, row.approved_at, row.approved_by_role].filter(Boolean).map(esc).join('<br>')
        : 'доказательства утверждения отсутствуют';
      const implementation = `<b>${esc(implementationLabels[row.implementation_status] || row.implementation_status)}</b>${row.implementation_ref ? `<div class="tiny">${esc(row.implementation_ref)}</div>` : ''}`;
      const control = issues.length
        ? `<span class="tag warn">Ошибка данных</span><div class="tiny">${issues.map(esc).join('; ')}</div>`
        : `<span class="tag">Структура корректна</span><div class="tiny">${esc(validation.readinessReason(row, rows))}</div>`;
      const statusClass = ['blocked'].includes(row.decision_status) ? ' warn' : '';
      return `<tr><td><b>${esc(row.sequence)}. ${esc(decisionLabels[row.decision_id] || row.decision_id)}</b><div class="tiny">${esc(row.decision_id)}</div></td><td><span class="tag${statusClass}">${esc(statusLabels[row.decision_status] || row.decision_status)}</span><div class="tiny">${control}</div></td><td>${esc(canonical.required_before || 'не указано')}<div class="tiny">${esc(canonical.notes || '')}</div></td><td>${roles}</td><td>${prerequisites.length ? prerequisites.map(esc).join('<br>') : 'нет'}</td><td>${approval}</td><td>${implementation}</td><td>${esc(row.blocker || '')}<div class="tiny">${esc(row.next_step || '')}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function render() {
    renderStats();
    renderTable();
  }

  document.querySelectorAll('[data-personal-data-decision-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.personalDataDecisionFilter || 'all';
      document.querySelectorAll('[data-personal-data-decision-filter]').forEach((item) => item.classList.toggle('primary', item === button));
      renderTable();
    });
  });

  Promise.all([
    fetch('/data/personal_data_decision_packet.csv', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('CSV unavailable'); return response.text(); }),
    fetch('/data/personal_data_readiness.json', { cache: 'no-store' }).then((response) => { if (!response.ok) throw new Error('JSON unavailable'); return response.json(); })
  ]).then(([csvText, readiness]) => {
    rows = parseCsv(csvText.replace(/^\ufeff/, ''));
    canonicalById = new Map((readiness.decisions || []).map((item) => [item.id, item]));
    render();
  }).catch(() => {
    statsRoot.innerHTML = '<article class="stat"><b>Ошибка</b><span>данные не загружены</span></article>';
    listRoot.innerHTML = '<div class="empty">Не удалось загрузить пакет решений. Откройте CSV и JSON напрямую.</div>';
  });
});
