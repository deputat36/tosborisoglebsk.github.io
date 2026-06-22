document.addEventListener('DOMContentLoaded', () => {
  const DRAFTS_KEY = 'tos-workbench-drafts-v1';
  const STATUS_LABELS = {
    new: 'Новые',
    contacted: 'Ждём ответ',
    received: 'Получены',
    ready: 'Готовы',
    blocked: 'Допроверка'
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function readDrafts() {
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
      return Object.entries(drafts).filter(([slug, draft]) => slug && draft);
    } catch (error) {
      return [];
    }
  }

  function ensureSummaryRoot() {
    const priorityList = document.querySelector('#workbench-priority-list');
    if (!priorityList) return null;

    let root = document.querySelector('#workbench-draft-summary');
    if (!root) {
      priorityList.insertAdjacentHTML('beforebegin', '<div class="container stats" id="workbench-draft-summary" aria-live="polite"></div>');
      root = document.querySelector('#workbench-draft-summary');
    }
    return root;
  }

  function buildCounts(entries) {
    return entries.reduce((acc, [, draft]) => {
      const status = draft && draft.status ? draft.status : 'new';
      acc.total += 1;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { total: 0 });
  }

  function renderDraftSummary() {
    const root = ensureSummaryRoot();
    if (!root) return;

    const entries = readDrafts();
    const counts = buildCounts(entries);
    const values = [
      ['Черновики', counts.total],
      ['Новые', counts.new || 0],
      ['Ждём ответ', counts.contacted || 0],
      ['Получены', counts.received || 0],
      ['Готовы', counts.ready || 0],
      ['Допроверка', counts.blocked || 0]
    ];

    root.innerHTML = values.map(([label, value]) => {
      const className = label === 'Допроверка' && value ? 'stat warn' : 'stat';
      return `<article class="${className}"><b>${esc(value)}</b><span>${esc(label)}</span></article>`;
    }).join('');
  }

  function queueRender() {
    window.setTimeout(renderDraftSummary, 0);
    window.setTimeout(renderDraftSummary, 120);
  }

  renderDraftSummary();

  document.addEventListener('click', (event) => {
    if (event.target.closest('#workbench-save-draft, #workbench-clear-draft')) {
      queueRender();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.closest('#workbench-draft-select')) {
      queueRender();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === DRAFTS_KEY) renderDraftSummary();
  });
});
