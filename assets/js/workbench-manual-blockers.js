(() => {
  'use strict';

  const DEPENDENCIES = [
    ['/assets/js/outreach-validation.js', 'OutreachValidation'],
    ['/assets/js/publication-basis-validation.js', 'PublicationBasisValidation'],
    ['/assets/js/personal-data-decision-validation.js', 'PersonalDataDecisionValidation'],
    ['/assets/js/manual-blocker-summary.js', 'ManualBlockerSummary']
  ];

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      const done = () => window[globalName]
        ? resolve()
        : reject(new Error(`Не инициализирован ${globalName}`));
      if (existing) {
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Не загружен ${src}`)), { once: true });
        window.setTimeout(() => { if (window[globalName]) resolve(); }, 0);
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.workbenchManualDependency = globalName;
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error(`Не загружен ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function ensureSection() {
    let root = document.querySelector('#workbench-manual-blockers');
    if (root) return root;
    const main = document.querySelector('#main');
    const hero = main?.querySelector('.hero');
    if (!main || !hero) return null;

    hero.insertAdjacentHTML('afterend', `
      <section class="section tight" id="workbench-manual-blockers" data-workbench-manual-blockers>
        <div class="container section-head">
          <div>
            <h2>Ручные блокеры и внешние действия</h2>
            <p>Актуальная сводка пяти задач, которые нельзя завершить автоматическим аудитом.</p>
          </div>
          <div class="card-actions">
            <a class="btn primary" href="/github-tasks/">Полный центр блокеров</a>
            <a class="btn" href="/docs/WORKBENCH-MANUAL-BLOCKERS.md">Как работать</a>
          </div>
        </div>
        <div class="container notice"><b>Граница доверия:</b> эта сводка только читает канонические CSV. Она не отправляет сообщения, не подтверждает данные, не назначает роли и не меняет статусы.</div>
        <div class="container stats" id="workbench-manual-blocker-stats" aria-live="polite"><article class="stat"><b>...</b><span>загрузка источников</span></article></div>
        <div class="container grid">
          <article class="card" data-workbench-manual-issue="34"><div class="card-inner"><div class="card-actions"><span class="tag warn" data-workbench-manual-status>Загрузка</span><span class="tag" data-workbench-manual-progress>—</span></div><h3>#34 — 4 приоритетные карточки</h3><p data-workbench-manual-headline>Загрузка готовности...</p><p class="tiny" data-workbench-manual-detail>Источник не загружен</p><div class="card-actions"><a class="btn" href="/verification-readiness/">Матрица</a><a class="btn" href="/verification-evidence/">Материалы</a></div></div></article>
          <article class="card" data-workbench-manual-issue="164"><div class="card-inner"><div class="card-actions"><span class="tag warn" data-workbench-manual-status>Загрузка</span><span class="tag" data-workbench-manual-progress>—</span></div><h3>#164 — GitHub Pages</h3><p data-workbench-manual-headline>Загрузка ручной проверки...</p><p class="tiny" data-workbench-manual-detail>Источник не загружен</p><div class="card-actions"><a class="btn" href="/actions-check/">Мастер Pages</a><a class="btn" href="/docs/GITHUB-PAGES-MANUAL-CHECK.md">Инструкция</a></div></div></article>
          <article class="card" data-workbench-manual-issue="166"><div class="card-inner"><div class="card-actions"><span class="tag warn" data-workbench-manual-status>Загрузка</span><span class="tag" data-workbench-manual-progress>—</span></div><h3>#166 — 15 исходящих запросов</h3><p data-workbench-manual-headline>Загрузка журнала...</p><p class="tiny" data-workbench-manual-detail>Источник не загружен</p><div class="card-actions"><a class="btn" href="/outreach-register/#outreach-execution-root">Пакет отправки</a><a class="btn" href="/data/outreach_register.csv">CSV</a></div></div></article>
          <article class="card" data-workbench-manual-issue="205"><div class="card-inner"><div class="card-actions"><span class="tag warn" data-workbench-manual-status>Загрузка</span><span class="tag" data-workbench-manual-progress>—</span></div><h3>#205 — 8 решений</h3><p data-workbench-manual-headline>Загрузка пакета решений...</p><p class="tiny" data-workbench-manual-detail>Источник не загружен</p><div class="card-actions"><a class="btn" href="/personal-data-decisions/">Панель решений</a><a class="btn" href="/docs/PERSONAL-DATA-SCENARIO-MATRIX.md">Матрица сценариев</a></div></div></article>
          <article class="card" data-workbench-manual-issue="254"><div class="card-inner"><div class="card-actions"><span class="tag warn" data-workbench-manual-status>Загрузка</span><span class="tag" data-workbench-manual-progress>—</span></div><h3>#254 — 24 основания публикации</h3><p data-workbench-manual-headline>Загрузка журнала 13 / 9 / 2...</p><p class="tiny" data-workbench-manual-detail>Источник не загружен</p><div class="card-actions"><a class="btn" href="/publication-basis-review/#publication-basis-execution-root">Пакет проверки</a><a class="btn" href="/docs/PUBLICATION-BASIS-EXECUTION-WORKSPACE.md">Инструкция</a></div></div></article>
        </div>
      </section>`);
    return document.querySelector('#workbench-manual-blockers');
  }

  function statusLabel(summary) {
    if (Number(summary.invalid || summary.failed || 0) > 0) return { text: 'Нужно исправить данные', warn: true };
    if (summary.total > 0 && summary.completed === summary.total) return { text: 'Критерий выполнен', warn: false };
    if (Number(summary.ready || 0) > 0) return { text: 'Есть готовые действия', warn: false };
    return { text: 'Требуется ручное действие', warn: true };
  }

  function renderCard(summary) {
    const card = document.querySelector(`[data-workbench-manual-issue="${summary.issue}"]`);
    if (!card) return;
    const label = statusLabel(summary);
    const status = card.querySelector('[data-workbench-manual-status]');
    const progress = card.querySelector('[data-workbench-manual-progress]');
    const headline = card.querySelector('[data-workbench-manual-headline]');
    const detail = card.querySelector('[data-workbench-manual-detail]');
    if (status) {
      status.textContent = label.text;
      status.className = `tag${label.warn ? ' warn' : ''}`;
    }
    if (progress) progress.textContent = summary.progress;
    if (headline) headline.textContent = summary.headline;
    if (detail) detail.textContent = summary.detail;
    card.dataset.workbenchManualLoaded = 'true';
  }

  function renderCardError(issue) {
    const card = document.querySelector(`[data-workbench-manual-issue="${issue}"]`);
    if (!card) return;
    const status = card.querySelector('[data-workbench-manual-status]');
    const headline = card.querySelector('[data-workbench-manual-headline]');
    const detail = card.querySelector('[data-workbench-manual-detail]');
    if (status) { status.textContent = 'Ошибка загрузки'; status.className = 'tag warn'; }
    if (headline) headline.textContent = 'Источник сводки не загружен';
    if (detail) detail.textContent = 'Откройте полный центр блокеров и связанный CSV.';
    card.dataset.workbenchManualLoaded = 'error';
  }

  async function loadText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.text();
  }

  async function renderSummaries() {
    const api = window.ManualBlockerSummary;
    const sources = [
      { issue: '34', url: '/data/verification_readiness_matrix.csv', summarize: (text) => api.summarizeVerification(api.parseCsv(text)) },
      { issue: '164', url: '/data/github_pages_manual_check_template.csv', summarize: (text) => api.summarizePages(api.parseCsv(text)) },
      { issue: '166', url: '/data/outreach_register.csv', summarize: (text) => api.summarizeOutreach(api.parseCsv(text), window.OutreachValidation) },
      { issue: '205', url: '/data/personal_data_decision_packet.csv', summarize: (text) => api.summarizePersonalData(api.parseCsv(text), window.PersonalDataDecisionValidation) },
      { issue: '254', url: '/data/publication_basis_confirmation_register.csv', summarize: (text) => api.summarizePublicationBasis(api.parseCsv(text), window.PublicationBasisValidation) }
    ];

    const results = await Promise.allSettled(sources.map(async (source) => {
      const summary = source.summarize(await loadText(source.url));
      renderCard(summary);
      return summary;
    }));

    results.forEach((result, index) => {
      if (result.status === 'rejected') renderCardError(sources[index].issue);
    });

    const loaded = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const completed = loaded.reduce((sum, item) => sum + Number(item.completed || 0), 0);
    const total = loaded.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const ready = loaded.reduce((sum, item) => sum + Number(item.ready || 0), 0);
    const errors = results.length - loaded.length + loaded.reduce((sum, item) => sum + Number(item.invalid || item.failed || 0), 0);
    const stats = document.querySelector('#workbench-manual-blocker-stats');
    if (stats) {
      const values = [
        ['Открытых блокеров', sources.length],
        ['Источников загружено', `${loaded.length}/${sources.length}`],
        ['Завершённых строк', `${completed}/${total}`],
        ['Готовых следующих действий', ready],
        ['Ошибок данных или загрузки', errors]
      ];
      stats.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
    }
    const root = document.querySelector('#workbench-manual-blockers');
    if (root) root.dataset.workbenchManualReady = errors ? 'with-errors' : 'true';
  }

  async function init() {
    const root = ensureSection();
    if (!root) return;
    try {
      await Promise.all(DEPENDENCIES.map(([src, globalName]) => loadScript(src, globalName)));
      await renderSummaries();
    } catch (error) {
      const stats = document.querySelector('#workbench-manual-blocker-stats');
      if (stats) stats.innerHTML = `<article class="stat warn"><b>Ошибка</b><span>${esc(error.message)}</span></article>`;
      root.dataset.workbenchManualReady = 'error';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
