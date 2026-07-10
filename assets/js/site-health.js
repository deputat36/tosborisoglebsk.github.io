function healthEsc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
  return response.json();
}

function fallbackReportFromTosAudit(audit) {
  const summary = audit.summary || {};
  const items = audit.items || [];
  const healthScore = Math.max(0, Math.min(100,
    100
    - (summary.high_priority || 0) * 3
    - (summary.needs_review_count || 0) * 4
    - (summary.without_phone || 0) * 2
    - (summary.without_social || 0) * 2
  ));

  const recommended = [];
  if (summary.high_priority) recommended.push(`Закрыть ${summary.high_priority} карточки ТОС с высоким приоритетом: контакты, соцсети, источники, логотипы.`);
  if (summary.verified_count === 0) recommended.push('Повысить доверие к каталогу: выбрать 3-5 карточек и довести их до статуса «подтверждено».');
  if (summary.without_phone) recommended.push(`Уточнить телефоны или публичные контакты для ${summary.without_phone} карточек.`);
  if (summary.without_social) recommended.push(`Добавить открытые страницы или сообщества для ${summary.without_social} карточек, если они существуют.`);
  recommended.push('После ручного запуска Generate TOS pages проверить, сформировался ли data/site_health.json.');

  return {
    generated_at: audit.generated_at || null,
    fallback: true,
    health_score: healthScore,
    catalog: summary,
    pages: {},
    priority_tos: items.filter((item) => item.priority === 'Высокий').map((item) => ({
      slug: item.slug,
      name: item.name,
      location: item.location,
      score: item.score,
      missing: item.missing || [],
      verification: item.verification?.label || item.verification?.status || item.verification_label || ''
    })),
    seo_warnings: [],
    broken_internal_links: [],
    recommended_actions: recommended,
    findings: [
      { level: 'risk', area: 'Доверие к данным', finding: `Подтверждённых карточек ТОС: ${summary.verified_count || 0}.` },
      { level: 'next', area: 'Следующий шаг', finding: 'Основной отчёт не найден, поэтому нужно пересобрать сайт через workflow.' }
    ],
    self_work_plan: [],
    blocked_actions: ['Не публиковать неподтверждённые контакты, ФИО, фото и логотипы без источника или разрешения.']
  };
}

async function loadReport() {
  try {
    return await fetchJson('/data/site_health.json');
  } catch (error) {
    const audit = await fetchJson('/data/tos_content_audit.json');
    return fallbackReportFromTosAudit(audit);
  }
}

async function loadContentOriginReport() {
  try {
    return await fetchJson('/data/content_origin_report.json');
  } catch {
    return null;
  }
}

function penaltyList(breakdown) {
  const penalties = breakdown?.penalties || {};
  const labels = {
    high_priority_tos: 'Приоритетные карточки ТОС',
    needs_review_tos: 'Карточки требуют проверки',
    missing_public_phone: 'Нет публичного телефона',
    seo_warnings: 'SEO-предупреждения',
    broken_internal_links: 'Битые внутренние ссылки'
  };
  return Object.entries(penalties).map(([key, value]) => `<li>${healthEsc(labels[key] || key)}: −${healthEsc(value)}</li>`).join('');
}

function renderFindings(report) {
  const findings = report.findings || [];
  if (!findings.length) return '';
  return `<div class="section-head" style="margin:22px 0 12px"><div><h3>Ключевые выводы аудита</h3><p>Что уже хорошо и где главный риск</p></div></div><div class="grid">${findings.map((item) => `<article class="card"><div class="card-inner"><span class="tag ${item.level === 'risk' ? 'warn' : item.level === 'good' ? 'ok' : ''}">${healthEsc(item.area)}</span><p>${healthEsc(item.finding)}</p></div></article>`).join('')}</div>`;
}

function renderSummary(report, summaryBox) {
  const catalog = report.catalog || {};
  const pages = report.pages || {};
  const scope = report.audit_scope || [];
  const penalties = penaltyList(report.score_breakdown);
  summaryBox.innerHTML = `
    <div class="grid">
      <article class="card"><div class="card-inner"><span class="tag">Оценка</span><h3>${healthEsc(report.health_score ?? '—')} / 100</h3><p>Сводная техническая и редакционная оценка состояния портала.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">ТОС</span><h3>${healthEsc(catalog.total_tos ?? '—')}</h3><p>Карточек в каталоге. Высокий приоритет: ${healthEsc(catalog.high_priority ?? 0)}.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Доверие</span><h3>${healthEsc(catalog.verified_count ?? 0)}</h3><p>Карточек со статусом «подтверждено». Частично проверено: ${healthEsc(catalog.partial_count ?? 0)}.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Страницы</span><h3>${healthEsc(pages.public ?? '—')}</h3><p>Публичных страниц. SEO-предупреждений: ${healthEsc(pages.seo_warnings_count ?? '—')}.</p></div></article>
    </div>
    ${penalties ? `<div class="notice"><b>Расчёт оценки:</b><ul>${penalties}</ul><p class="tiny">${healthEsc(report.score_breakdown?.note || '')}</p></div>` : ''}
    ${scope.length ? `<div class="notice"><b>Что проверяется:</b> ${scope.map(healthEsc).join('; ')}.</div>` : ''}
    ${renderFindings(report)}
    ${report.fallback ? '<div class="notice"><b>Временный режим:</b> основной отчёт <code>/data/site_health.json</code> не найден, поэтому показана сводка на основе аудита карточек ТОС. После ручного запуска <code>Generate TOS pages</code> здесь появится полный технический отчёт.</div>' : ''}
    <p class="tiny">Отчёт сформирован: ${report.generated_at ? new Date(report.generated_at).toLocaleString('ru-RU') : '—'}.</p>
  `;
}

function originCollectionRows(report) {
  const labels = {
    news: 'Новости',
    projects: 'Проекты',
    needs: 'Потребности',
    done: 'Истории результата'
  };
  return Object.entries(report.collections || {}).map(([key, item]) => `<tr><td>${healthEsc(labels[key] || key)}</td><td>${healthEsc(item.total || 0)}</td><td>${healthEsc(item.verified || 0)}</td><td>${healthEsc(item.editorial || 0)}</td><td>${healthEsc(item.starter || 0)}</td><td>${healthEsc(item.request || 0)}</td></tr>`).join('');
}

function renderContentOrigins(report, root) {
  if (!root) return;
  if (!report) {
    root.innerHTML = '<div class="notice">Отчёт происхождения контента ещё не сформирован. Запустите workflow <code>Generate TOS pages</code>.</div>';
    return;
  }

  const totals = report.totals || {};
  const coverage = report.tos_coverage || {};
  const definitions = report.definitions || {};
  root.innerHTML = `
    <div class="grid">
      <article class="card"><div class="card-inner"><span class="tag ok">Подтверждено</span><h3>${healthEsc(totals.verified || 0)}</h3><p>Материалы с явным проверяемым источником.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Редакционные</span><h3>${healthEsc(totals.editorial || 0)}</h3><p>Материалы редакции, которые не считаются автоматически подтверждёнными.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Стартовые идеи</span><h3>${healthEsc(totals.starter || 0)}</h3><p>Идеи для обсуждения, а не утверждённые проекты.</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag warn">Запросы</span><h3>${healthEsc(totals.request || 0)}</h3><p>Запросы сведений и заготовки, а не подтверждение события или результата.</p></div></article>
    </div>
    <div class="notice"><b>Охват ТОСов:</b> с подтверждённым контентом — ${healthEsc(coverage.with_verified_content || 0)}; с редакционным — ${healthEsc(coverage.with_editorial_content || 0)}; только со стартовыми идеями или запросами — ${healthEsc(coverage.with_only_starter_or_request || 0)}; без контента — ${healthEsc(coverage.without_any_content || 0)}.</div>
    <div class="table"><table><thead><tr><th>Раздел</th><th>Всего</th><th>Подтверждено</th><th>Редакционные</th><th>Стартовые</th><th>Запросы</th></tr></thead><tbody>${originCollectionRows(report)}</tbody></table></div>
    <div class="notice"><b>Определения:</b><ul>${Object.entries(definitions).map(([key, value]) => `<li><code>${healthEsc(key)}</code> — ${healthEsc(value)}</li>`).join('')}</ul></div>
    <p class="tiny">Отчёт сформирован: ${report.generated_at ? new Date(report.generated_at).toLocaleString('ru-RU') : '—'}.</p>
  `;
}

function renderWorkPlan(report) {
  const plan = report.self_work_plan || [];
  if (!plan.length) return '';
  return `<h3>Что можно делать самостоятельно</h3><div class="grid">${plan.map((stage) => `<article class="card"><div class="card-inner"><span class="tag">${healthEsc(stage.owner || 'assistant')}</span><h3>${healthEsc(stage.stage)}</h3><p class="tiny">Статус: ${healthEsc(stage.status || 'active')}</p><ul>${(stage.actions || []).map((item) => `<li>${healthEsc(item)}</li>`).join('')}</ul></div></article>`).join('')}</div>`;
}

function renderBlocked(report) {
  const blocked = report.blocked_actions || [];
  if (!blocked.length) return '';
  return `<h3>Что заблокировано без подтверждения</h3><div class="notice"><ul>${blocked.map((item) => `<li>${healthEsc(item)}</li>`).join('')}</ul></div>`;
}

function renderActions(report, actionsBox) {
  const actions = report.recommended_actions || [];
  const actionHtml = actions.length
    ? `<h3>Приоритетные действия</h3><ol>${actions.map((item) => `<li>${healthEsc(item)}</li>`).join('')}</ol>`
    : '<p>Срочных действий в отчёте нет.</p>';
  actionsBox.innerHTML = `${actionHtml}${renderWorkPlan(report)}${renderBlocked(report)}`;
}

function renderPriority(report, priorityBox) {
  const items = report.priority_tos || [];
  priorityBox.innerHTML = items.length
    ? `<div class="grid">${items.map((item) => {
      const slug = encodeURIComponent(item.slug || '');
      const missing = (item.missing || []).join(', ') || '—';
      return `<article class="card"><div class="card-inner"><span class="tag">${healthEsc(item.verification || 'Проверка')}</span><h3>${healthEsc(item.name)}</h3><p>${healthEsc(item.location || '')}</p><p>Заполненность: ${healthEsc(item.score ?? '—')}%. Нужно уточнить: ${healthEsc(missing)}.</p><div class="card-actions"><a class="btn" href="/tos/${slug}/">Открыть карточку</a><a class="btn primary" href="/update-tos/?tos=${slug}&type=card#message-builder">Уточнить</a></div></div></article>`;
    }).join('')}</div>`
    : '<p>Карточек высокого приоритета нет.</p>';
}

function renderTechnical(report, technicalBox) {
  const links = report.broken_internal_links || [];
  const seo = report.seo_warnings || [];
  const linkHtml = links.length
    ? `<h3>Битые внутренние ссылки</h3><ul>${links.slice(0, 10).map((item) => `<li>${healthEsc(item.page)}: ${healthEsc(item.link)}${item.reason ? ` — ${healthEsc(item.reason)}` : ''}</li>`).join('')}</ul>`
    : '<p>Битые внутренние ссылки в отчёте не найдены.</p>';
  const seoHtml = seo.length
    ? `<h3>SEO-предупреждения</h3><ul>${seo.slice(0, 10).map((item) => `<li>${healthEsc(item.page)}: ${(item.warnings || []).map(healthEsc).join(', ')}</li>`).join('')}</ul>`
    : report.fallback
      ? '<p>Полные SEO-предупреждения появятся после формирования <code>/data/site_health.json</code>.</p>'
      : '<p>SEO-предупреждений в отчёте нет.</p>';
  technicalBox.innerHTML = `${linkHtml}${seoHtml}`;
}

async function loadSiteHealth() {
  const summaryBox = document.getElementById('site-health-summary');
  const contentOriginBox = document.getElementById('site-health-content-origin');
  const actionsBox = document.getElementById('site-health-actions');
  const priorityBox = document.getElementById('site-health-priority');
  const technicalBox = document.getElementById('site-health-technical');

  try {
    const [report, contentOriginReport] = await Promise.all([loadReport(), loadContentOriginReport()]);
    if (summaryBox) renderSummary(report, summaryBox);
    renderContentOrigins(contentOriginReport, contentOriginBox);
    if (actionsBox) renderActions(report, actionsBox);
    if (priorityBox) renderPriority(report, priorityBox);
    if (technicalBox) renderTechnical(report, technicalBox);
  } catch (error) {
    if (summaryBox) summaryBox.innerHTML = '<div class="notice">Отчёты ещё не сформированы. Запустите workflow <code>Generate TOS pages</code> на ветке <code>release-2025-12-22</code>.</div>';
    if (contentOriginBox) contentOriginBox.innerHTML = '<div class="notice">Отчёт происхождения контента ещё не сформирован.</div>';
  }
}

loadSiteHealth();
