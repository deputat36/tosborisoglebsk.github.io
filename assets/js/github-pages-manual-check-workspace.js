(() => {
  'use strict';

  const section = document.querySelector('[data-pages-manual-check]');
  if (!section || section.querySelector('[data-pages-manual-workspace]')) return;

  const root = document.createElement('div');
  root.className = 'container update-builder';
  root.dataset.pagesManualWorkspace = '';
  root.innerHTML = `
    <section class="update-panel" aria-labelledby="pages-manual-form-title">
      <div class="update-panel-head"><div><h3 id="pages-manual-form-title">Заполните восемь пунктов</h3><p class="tiny">Черновик сохраняется только в localStorage этого браузера.</p></div><span class="tag warn" id="pages-manual-progress">0 из 8</span></div>
      <form id="pages-manual-form" novalidate><div class="grid" id="pages-manual-items" aria-live="polite"><article class="card"><div class="card-inner"><p>Загрузка шаблона...</p></div></article></div></form>
    </section>
    <section class="update-panel update-preview" aria-labelledby="pages-manual-result-title">
      <h3 id="pages-manual-result-title">Экспорт результата</h3>
      <div class="notice" id="pages-manual-summary" aria-live="polite">Шаблон ещё не загружен.</div>
      <label class="field-group field-wide"><span>Строка actions-013</span><textarea class="input" id="pages-manual-actions-row" rows="8" readonly></textarea></label>
      <div class="card-actions"><button class="btn primary" id="pages-manual-download-csv" type="button" disabled>Скачать заполненный CSV</button><button class="btn" id="pages-manual-download-diagnostic" type="button" disabled>Скачать actions-013</button><button class="btn" id="pages-manual-copy-diagnostic" type="button" disabled>Скопировать actions-013</button><button class="btn" id="pages-manual-reset" type="button">Сбросить черновик</button></div>
      <p class="tiny" id="pages-manual-status">Мастер не отправляет данные и не меняет репозиторий.</p>
    </section>`;

  const notice = Array.from(section.children).find((element) => element.classList && element.classList.contains('notice'));
  section.insertBefore(root, notice || null);

  if (window.GitHubPagesManualCheck && typeof window.GitHubPagesManualCheck.mount === 'function') {
    window.GitHubPagesManualCheck.mount(document);
  }
})();
