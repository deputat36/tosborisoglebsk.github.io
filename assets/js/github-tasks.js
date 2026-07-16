document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const summaryApi = window.ManualBlockerSummary;
  const statsRoot = document.querySelector('#manual-blocker-stats');
  if (!summaryApi || !statsRoot) return;

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const sources = [
    {
      issue: '34',
      url: '/data/verification_readiness_matrix.csv',
      summarize: (text) => summaryApi.summarizeVerification(summaryApi.parseCsv(text))
    },
    {
      issue: '164',
      url: '/data/github_pages_manual_check_template.csv',
      summarize: (text) => summaryApi.summarizePages(summaryApi.parseCsv(text))
    },
    {
      issue: '166',
      url: '/data/outreach_register.csv',
      summarize: (text) => summaryApi.summarizeOutreach(summaryApi.parseCsv(text), window.OutreachValidation)
    },
    {
      issue: '205',
      url: '/data/personal_data_decision_packet.csv',
      summarize: (text) => summaryApi.summarizePersonalData(summaryApi.parseCsv(text), window.PersonalDataDecisionValidation)
    },
    {
      issue: '254',
      url: '/data/publication_basis_confirmation_register.csv',
      summarize: (text) => summaryApi.summarizePublicationBasis(summaryApi.parseCsv(text), window.PublicationBasisValidation)
    }
  ];

  function statusLabel(summary) {
    if (summary.invalid > 0 || summary.failed > 0) return { text: 'Нужно исправить данные', warn: true };
    if (summary.total > 0 && summary.completed === summary.total) return { text: 'Критерий выполнен', warn: false };
    if (summary.ready > 0) return { text: 'Есть готовые действия', warn: false };
    return { text: 'Требуется ручное действие', warn: true };
  }

  function renderCard(summary) {
    const card = document.querySelector(`[data-manual-issue="${summary.issue}"]`);
    if (!card) return;
    const progress = card.querySelector('[data-manual-progress]');
    const headline = card.querySelector('[data-manual-headline]');
    const detail = card.querySelector('[data-manual-detail]');
    const status = card.querySelector('[data-manual-status]');
    const label = statusLabel(summary);

    if (progress) progress.textContent = summary.progress;
    if (headline) headline.textContent = summary.headline;
    if (detail) detail.textContent = summary.detail;
    if (status) {
      status.textContent = label.text;
      status.className = `tag${label.warn ? ' warn' : ''}`;
    }
    card.dataset.manualLoaded = 'true';
  }

  function renderCardError(issue) {
    const card = document.querySelector(`[data-manual-issue="${issue}"]`);
    if (!card) return;
    const progress = card.querySelector('[data-manual-progress]');
    const headline = card.querySelector('[data-manual-headline]');
    const detail = card.querySelector('[data-manual-detail]');
    const status = card.querySelector('[data-manual-status]');
    if (progress) progress.textContent = '—';
    if (headline) headline.textContent = 'Источник сводки не загружен';
    if (detail) detail.textContent = 'Откройте связанный CSV напрямую и проверьте доступность файла.';
    if (status) {
      status.textContent = 'Ошибка загрузки';
      status.className = 'tag warn';
    }
    card.dataset.manualLoaded = 'error';
  }

  function renderStats(results) {
    const summaries = results.filter((item) => item.status === 'fulfilled').map((item) => item.value);
    const errors = results.length - summaries.length;
    const completed = summaries.reduce((sum, item) => sum + Number(item.completed || 0), 0);
    const total = summaries.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const ready = summaries.reduce((sum, item) => sum + Number(item.ready || 0), 0);
    const invalid = summaries.reduce((sum, item) => sum + Number(item.invalid || item.failed || 0), 0);
    const values = [
      ['Открытых блокеров', sources.length],
      ['Источников загружено', `${summaries.length}/${sources.length}`],
      ['Завершённых строк', `${completed}/${total}`],
      ['Готовых следующих действий', ready],
      ['Ошибок данных или загрузки', invalid + errors]
    ];
    statsRoot.innerHTML = values.map(([label, value]) => `<article class="stat"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('');
  }

  Promise.allSettled(sources.map(async (source) => {
    const response = await fetch(source.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${source.url}: ${response.status}`);
    const summary = source.summarize(await response.text());
    renderCard(summary);
    return summary;
  })).then((results) => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') renderCardError(sources[index].issue);
    });
    renderStats(results);
  });
});
