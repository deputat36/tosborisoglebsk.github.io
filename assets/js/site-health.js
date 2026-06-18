async function loadSiteHealth() {
  const summaryBox = document.getElementById('site-health-summary');
  const actionsBox = document.getElementById('site-health-actions');
  const priorityBox = document.getElementById('site-health-priority');
  const technicalBox = document.getElementById('site-health-technical');

  try {
    const response = await fetch('/data/site_health.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('report not found');
    const report = await response.json();
    const catalog = report.catalog || {};
    const pages = report.pages || {};

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="grid">
          <article class="card"><div class="card-inner"><span class="tag">Оценка</span><h3>${report.health_score ?? '—'} / 100</h3><p>Сводная техническая и редакционная оценка состояния портала.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">ТОС</span><h3>${catalog.total_tos ?? '—'}</h3><p>Карточек в каталоге. Высокий приоритет: ${catalog.high_priority ?? 0}.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">Доверие</span><h3>${catalog.verified_count ?? 0}</h3><p>Карточек со статусом «подтверждено». Частично проверено: ${catalog.partial_count ?? 0}.</p></div></article>
          <article class="card"><div class="card-inner"><span class="tag">Страницы</span><h3>${pages.public ?? '—'}</h3><p>Публичных страниц. SEO-предупреждений: ${pages.seo_warnings_count ?? 0}.</p></div></article>
        </div>
        <p class="tiny">Отчёт сформирован: ${report.generated_at ? new Date(report.generated_at).toLocaleString('ru-RU') : '—'}.</p>
      `;
    }

    if (actionsBox) {
      const actions = report.recommended_actions || [];
      actionsBox.innerHTML = actions.length
        ? `<ol>${actions.map((item) => `<li>${item}</li>`).join('')}</ol>`
        : '<p>Срочных действий в отчёте нет.</p>';
    }

    if (priorityBox) {
      const items = report.priority_tos || [];
      priorityBox.innerHTML = items.length
        ? `<div class="grid">${items.map((item) => `<article class="card"><div class="card-inner"><span class="tag">${item.verification || 'Проверка'}</span><h3>${item.name}</h3><p>${item.location || ''}</p><p>Заполненность: ${item.score ?? '—'}%. Нужно уточнить: ${(item.missing || []).join(', ') || '—'}.</p><a class="btn" href="/tos/${item.slug}/">Открыть карточку</a></div></article>`).join('')}</div>`
        : '<p>Карточек высокого приоритета нет.</p>';
    }

    if (technicalBox) {
      const links = report.broken_internal_links || [];
      const seo = report.seo_warnings || [];
      const linkHtml = links.length
        ? `<h3>Битые внутренние ссылки</h3><ul>${links.slice(0, 10).map((item) => `<li>${item.page}: ${item.link}</li>`).join('')}</ul>`
        : '<p>Битые внутренние ссылки в отчёте не найдены.</p>';
      const seoHtml = seo.length
        ? `<h3>SEO-предупреждения</h3><ul>${seo.slice(0, 10).map((item) => `<li>${item.page}: ${item.warnings.join(', ')}</li>`).join('')}</ul>`
        : '<p>SEO-предупреждений в отчёте нет.</p>';
      technicalBox.innerHTML = `${linkHtml}${seoHtml}`;
    }
  } catch (error) {
    if (summaryBox) summaryBox.innerHTML = '<div class="notice">Отчёт ещё не сформирован. Он появится после ближайшей автогенерации сайта.</div>';
  }
}

loadSiteHealth();
