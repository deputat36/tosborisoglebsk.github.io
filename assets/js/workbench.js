document.addEventListener('DOMContentLoaded', () => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  async function getJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
    return response.json();
  }

  function renderAuditSummary(audit) {
    const root = document.querySelector('#workbench-audit-summary');
    if (!root) return;
    const summary = audit.summary || audit;
    const values = [
      ['Всего ТОС', summary.total_tos || 0],
      ['Средняя заполненность', `${summary.average_score || 0}%`],
      ['Высокий приоритет', summary.high_priority || 0],
      ['Без телефона', summary.without_phone || 0],
      ['Без соцсетей', summary.without_social || 0],
      ['Требует проверки', summary.needs_review_count || 0]
    ];
    root.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  function renderNextActions(audit) {
    const root = document.querySelector('#workbench-next-actions');
    if (!root) return;
    const actions = audit.next_actions || [];
    if (!actions.length) {
      root.innerHTML = '<div class="empty">Следующие действия не сформированы. Дождитесь обновления аудита.</div>';
      return;
    }
    root.innerHTML = actions.slice(0, 8).map((action) => `<li>${esc(action)}</li>`).join('');
  }

  function renderPriorityItems(contentAudit) {
    const root = document.querySelector('#workbench-priority-list');
    if (!root) return;
    const items = (contentAudit.items || [])
      .filter((item) => item.priority === 'Высокий' || (item.missing || []).length)
      .sort((a, b) => {
        const ap = a.priority === 'Высокий' ? 0 : 1;
        const bp = b.priority === 'Высокий' ? 0 : 1;
        return ap - bp || (b.missing || []).length - (a.missing || []).length || String(a.name).localeCompare(String(b.name), 'ru');
      })
      .slice(0, 8);

    if (!items.length) {
      root.innerHTML = '<div class="empty">Критичных карточек для уточнения сейчас нет.</div>';
      return;
    }

    root.innerHTML = items.map((item) => {
      const missing = (item.missing || []).slice(0, 5).map((value) => `<span class="tag warn">${esc(value)}</span>`).join(' ');
      return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : ''}">${esc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${esc(item.score || 0)}%</span><span class="tag">${esc(item.location || '')}</span></div><h3>ТОС «${esc(item.name)}»</h3><p>${missing || 'Нужна проверка актуальности сведений.'}</p><div class="card-actions"><a class="btn" href="/tos/${esc(item.slug)}/">Карточка</a><a class="btn" href="/data-requests/">Сообщение</a><a class="btn" href="/update-tos/?tos=${encodeURIComponent(item.slug || '')}">Обновить</a></div></article>`;
    }).join('');
  }

  Promise.all([
    getJson('/data/site_audit.json').catch(() => null),
    getJson('/data/tos_content_audit.json').catch(() => null)
  ]).then(([siteAudit, contentAudit]) => {
    if (siteAudit) {
      renderAuditSummary(siteAudit);
      renderNextActions(siteAudit);
    }
    if (contentAudit) renderPriorityItems(contentAudit);
  }).catch(() => {
    const summary = document.querySelector('#workbench-audit-summary');
    if (summary) summary.innerHTML = '<article class="stat"><b>—</b><span>аудит не загрузился</span></article>';
  });
});
