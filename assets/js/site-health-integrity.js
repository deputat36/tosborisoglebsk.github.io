(() => {
  'use strict';

  const root = document.querySelector('#site-health-integrity');
  if (!root) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  const list = (items) => (Array.isArray(items) ? items : [])
    .map((item) => `<li>${esc(item)}</li>`)
    .join('');

  function render(data) {
    const integrity = data?.technical_integrity;
    if (!integrity) {
      root.innerHTML = '<div class="notice"><b>Отчёт ещё не включён в опубликованную сборку.</b><br>Он появится после успешного запуска основного генерационного workflow.</div>';
      return;
    }

    const automation = integrity.automation || {};
    const context = integrity.validation_context || {};
    const runLabel = context.run_number
      ? `GitHub Actions run №${esc(context.run_number)}`
      : context.source === 'local' ? 'локальная проверка' : 'контекст запуска не указан';
    const commitLabel = context.commit_sha ? ` · commit ${esc(context.commit_sha.slice(0, 12))}` : '';
    const checkedAt = integrity.generated_at
      ? new Date(integrity.generated_at).toLocaleString('ru-RU')
      : 'дата не указана';

    root.innerHTML = `
      <div class="grid" data-integrity-metrics>
        <article class="card"><div class="card-inner"><span class="tag ${integrity.failed === 0 ? 'ok' : 'warn'}">${esc(integrity.status_label || 'Статус')}</span><h3>${esc(integrity.failed ?? '—')} ошибок</h3><p>${esc(integrity.method || 'Технический обход текущей сборки')}.</p></div></article>
        <article class="card"><div class="card-inner"><span class="tag">Страницы</span><h3>${esc(integrity.pages_checked ?? '—')}</h3><p>Индексируемых страниц открыто по локальному HTTP. В индексе: ${esc(integrity.pages_indexed ?? '—')}.</p></div></article>
        <article class="card"><div class="card-inner"><span class="tag">Переходы</span><h3>${esc(integrity.internal_links_checked ?? '—')}</h3><p>Уникальных сочетаний источник → цель → якорь проверено.</p></div></article>
        <article class="card"><div class="card-inner"><span class="tag">Цели</span><h3>${esc(integrity.unique_internal_targets ?? '—')}</h3><p>Уникальных внутренних адресов открыто и проверено.</p></div></article>
        <article class="card"><div class="card-inner"><span class="tag">Браузерные тесты</span><h3>${esc(automation.browser_suites_enabled ?? '—')}</h3><p>Наборов пользовательских сценариев подключено к pull request CI.</p></div></article>
        <article class="card"><div class="card-inner"><span class="tag">Визуальная матрица</span><h3>${esc(automation.visual_cases ?? '—')}</h3><p>Контрольных desktop, mobile, light, dark и print-сценариев.</p></div></article>
      </div>
      <div class="notice"><b>Что подтверждает проверка:</b><ul>${list(integrity.confirms)}</ul></div>
      <div class="notice"><b>Что она не подтверждает:</b><ul>${list(integrity.does_not_confirm)}</ul></div>
      <details class="card"><summary class="card-inner"><b>Какие браузерные сценарии подключены</b></summary><div class="card-inner"><ul>${(automation.browser_suites || []).map((suite) => `<li>${esc(suite.label || suite.id)} — ${suite.enabled ? 'подключён' : 'не подключён'}</li>`).join('')}</ul><p class="tiny">${esc(automation.visual_baseline_scope || '')}</p></div></details>
      <div class="card-actions"><a class="btn" href="${esc(integrity.report_url || '/data/public_link_integrity.json')}">Открыть JSON проверки</a><a class="btn" href="/actions-check/">Проверка Actions и Pages</a></div>
      <p class="tiny">Проверено: ${esc(checkedAt)} · ${runLabel}${commitLabel}.</p>
    `;
  }

  fetch('/data/site_health.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(render)
    .catch(() => {
      root.innerHTML = '<div class="notice"><b>Не удалось загрузить технический отчёт.</b><br>Откройте машиночитаемую сводку или повторите попытку позже.</div>';
    });
})();
