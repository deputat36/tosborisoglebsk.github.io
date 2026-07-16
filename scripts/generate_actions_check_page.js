const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const DIAGNOSTICS_PATH = path.join(ROOT, 'data', 'actions_diagnostics.csv');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const OUTPUT_PATH = path.join(ROOT, 'actions-check', 'index.html');

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} года`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date-time: ${value}`);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(value)}, ${hours}:${minutes} UTC`;
}

function diagnosticsRows(csvText) {
  const rows = parseCsv(csvText);
  const [headers, ...items] = rows;
  if (!headers) throw new Error('actions_diagnostics.csv is empty');
  return items.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function latestIsoDate(rows) {
  const values = rows.map((row) => row.checked_at).filter(Boolean).sort();
  if (!values.length) throw new Error('actions_diagnostics.csv has no checked_at values');
  return values[values.length - 1];
}

function countStatuses(rows) {
  const result = { passed: 0, warning: 0, pending: 0, failed: 0, blocked: 0 };
  for (const row of rows) {
    if (!Object.prototype.hasOwnProperty.call(result, row.status)) result[row.status] = 0;
    result[row.status] += 1;
  }
  return result;
}

function detectTriggers(workflow) {
  const candidates = [
    ['workflow_dispatch', 'ручной запуск'],
    ['pull_request', 'pull request'],
    ['push', 'push в рабочую ветку'],
    ['schedule', 'расписание']
  ];
  return candidates
    .filter(([key]) => new RegExp(`^\\s{2}${key}:`, 'm').test(workflow))
    .map(([key, label]) => ({ key, label }));
}

function buildPage({ health, diagnostics, workflow }) {
  if (!health || typeof health !== 'object') throw new Error('site_health.json must contain an object');
  if (!health.pages || typeof health.pages !== 'object') throw new Error('site_health.json is missing pages');
  if (!health.generated_at) throw new Error('site_health.json is missing generated_at');

  const rows = diagnosticsRows(diagnostics);
  const statuses = countStatuses(rows);
  const latestCheckedAt = latestIsoDate(rows);
  const triggers = detectTriggers(workflow);
  if (!triggers.length) throw new Error('No workflow triggers detected');

  const pages = health.pages;
  for (const field of ['total', 'public', 'noindex', 'seo_warnings_count', 'broken_internal_links_count']) {
    if (!Number.isInteger(pages[field]) || pages[field] < 0) throw new Error(`site_health.pages.${field} must be a non-negative integer`);
  }

  const triggerLabels = triggers.map((item) => item.label);
  const triggerText = triggerLabels.join(', ');
  const warnings = (statuses.warning || 0) + (statuses.pending || 0) + (statuses.failed || 0) + (statuses.blocked || 0);

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Проверка GitHub Actions — портал ТОС БГО</title>
  <meta name="description" content="Служебная диагностика GitHub Actions, генерации страниц, RSS, sitemap и GitHub Pages портала ТОС БГО."/>
  <meta name="robots" content="noindex,nofollow"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="https://tosborisoglebsk.ru/actions-check/"/>
  <meta property="og:title" content="Проверка GitHub Actions портала ТОС БГО"/>
  <meta property="og:description" content="Диагностика workflow, генерации и ручного контроля деплоя."/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="https://tosborisoglebsk.ru/actions-check/"/>
  <meta property="og:image" content="https://tosborisoglebsk.ru/assets/img/og-cover.svg"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="stylesheet" href="/assets/css/styles.css"/>
</head>
<body>
<a class="skip-link" href="#main">Перейти к содержимому</a>
<header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>
<main id="main">
  <!-- Generated from data/site_health.json and data/actions_diagnostics.csv by scripts/generate_actions_check_page.js -->
  <section class="hero"><div class="container hero-card"><div class="eyebrow">Диагностика workflow и Pages</div><h1>Проверка GitHub Actions</h1><p class="lead">Страница разделяет текущий снимок производных данных и исторический журнал проверок. Текущие метрики берутся из <code>data/site_health.json</code>, а CSV не выдаётся за состояние последнего запуска.</p><div class="hero-actions"><a class="btn primary" href="/data/actions_diagnostics.csv">Исторический CSV</a><a class="btn" href="/data/github_pages_manual_check_template.csv">Шаблон Pages</a><a class="btn" href="/data/site_health.json">Текущий JSON</a><a class="btn" href="/site-health/">Общая сводка</a><a class="btn" href="/github-tasks/">Ручные задачи</a></div></div></section>

  <section class="section tight"><div class="container notice"><b>Роль страницы:</b> служебная диагностика GitHub Actions и автоматической генерации. Она не подтверждает GitHub Pages deployment и не заменяет проверку Actions UI.</div></section>

  <section class="section" data-actions-current-snapshot data-actions-health-generated-at="${escapeHtml(health.generated_at)}"><div class="container section-head"><div><h2>Текущий снимок производных данных</h2><p>Сформирован ${escapeHtml(formatDateTime(health.generated_at))}</p></div><a class="btn" href="/data/site_health.json">Открыть источник</a></div><div class="container stats-grid">
    <div class="stat"><b data-actions-pages-total>${pages.total}</b><span>HTML-страниц</span></div>
    <div class="stat"><b data-actions-pages-public>${pages.public}</b><span>публичных</span></div>
    <div class="stat"><b data-actions-pages-noindex>${pages.noindex}</b><span>noindex</span></div>
    <div class="stat"><b data-actions-seo-warnings>${pages.seo_warnings_count}</b><span>SEO-предупреждений</span></div>
    <div class="stat"><b data-actions-broken-links>${pages.broken_internal_links_count}</b><span>битых внутренних ссылок</span></div>
  </div></section>

  <section class="section"><div class="container grid">
    <article class="card"><div class="card-inner"><h2>Основной workflow</h2><p><code>.github/workflows/generate-tos-pages.yml</code></p><p>Фактически обнаруженные триггеры: <span data-actions-triggers>${escapeHtml(triggerText)}</span>.</p><div class="notice"><b>Важно:</b> описание триггеров строится из текущего YAML. Страница не утверждает наличие расписания, если ключ <code>schedule</code> отсутствует.</div></div></article>
    <article class="card"><div class="card-inner"><h2>Исторический журнал</h2><p>В CSV находится <b data-actions-diagnostics-total>${rows.length}</b> записей. Последняя дата ручной фиксации: <b data-actions-diagnostics-latest>${escapeHtml(formatDate(latestCheckedAt))}</b>.</p><p>Статусы: passed — <span data-actions-status-passed>${statuses.passed || 0}</span>, warning — <span data-actions-status-warning>${statuses.warning || 0}</span>, pending — <span data-actions-status-pending>${statuses.pending || 0}</span>, failed — <span data-actions-status-failed>${statuses.failed || 0}</span>, blocked — <span data-actions-status-blocked>${statuses.blocked || 0}</span>.</p><p>Записей, требующих внимания: <b data-actions-status-attention>${warnings}</b>.</p></div></article>
    <article class="card"><div class="card-inner"><h2>Что требует ручного контроля</h2><ul class="check-list"><li>открыть <code>Settings → Pages</code>;</li><li>зафиксировать source branch и папку либо GitHub Actions;</li><li>проверить custom domain и HTTPS enforcement;</li><li>открыть последний Pages deployment и опубликованный URL;</li><li>добавить новый результат в исторический CSV только после реальной проверки.</li></ul></div></article>
  </div></section>

  <section class="section" data-pages-manual-check><div class="container section-head"><div><h2>Ручная проверка Settings → Pages</h2><p>Локальный мастер для закрытия issue #164 без подмены ручного просмотра автоматическим smoke-тестом.</p></div><a class="btn primary" href="/data/github_pages_manual_check_template.csv">Скачать исходный CSV</a></div><div class="container grid">
    <article class="card"><div class="card-inner"><h3>1. Настройки публикации</h3><ul class="check-list"><li>source branch или GitHub Actions;</li><li>папка публикации;</li><li>custom domain <code>tosborisoglebsk.ru</code>;</li><li>включённый HTTPS enforcement.</li></ul></div></article>
    <article class="card"><div class="card-inner"><h3>2. Deployment и evidence</h3><ul class="check-list"><li>последний Pages deployment имеет статус success;</li><li>опубликованный URL открыт из интерфейса Pages;</li><li>сохранена публичная или обезличенная ссылка на evidence;</li><li>приватные скриншоты и данные аккаунта не коммитятся.</li></ul></div></article>
    <article class="card"><div class="card-inner"><h3>3. Фиксация результата</h3><p>Мастер формирует заполненный шаблон и строку <code>actions-013</code>. Статус <code>passed</code> появляется только после восьми положительно заполненных пунктов.</p><p><a class="btn" href="/docs/GITHUB-PAGES-MANUAL-CHECK.md">Полная инструкция</a></p></div></article>
  </div>
  <noscript><div class="container notice"><b>Для мастера нужен JavaScript.</b> Исходный CSV остаётся доступен для ручного заполнения.</div></noscript>
  <div class="container update-builder" data-pages-manual-workspace>
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
    </section>
  </div>
  <div class="container notice"><b>Важно:</b> незаполненный шаблон со статусами <code>not_checked</code> не является evidence, не переводит <code>actions-011</code> в <code>passed</code> и не закрывает issue #164.</div></section>

  <section class="section"><div class="container prose">
    <h2>Граница между текущим состоянием и историей</h2>
    <p>Счётчики страниц, SEO и ссылок отображаются только из актуального <code>site_health.json</code>. Записи <code>actions_diagnostics.csv</code> являются историей конкретных проверок и могут содержать старые даты или ссылки на ранее проверенные коммиты.</p>
    <p>Страница намеренно не выводит commit SHA из исторического CSV как «текущий». Пустой ответ commit endpoint также не считается доказательством падения workflow.</p>
    <div class="notice">Корректная формулировка: «производные данные подтверждены текущим отчётом здоровья; фактический запуск workflow и Pages deployment проверяются по Actions UI и deployment logs».</div>
    <p><a class="btn" href="/site-health/">Вернуться к общей сводке</a> <a class="btn" href="/github-tasks/">Открыть ручные задачи</a></p>
  </div></section>
</main>
<footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Служебная диагностика автоматической генерации.</div></div></footer>
<script src="/assets/js/site.js"></script>
<script src="/assets/js/github-pages-manual-check.js"></script>
</body>
</html>
`;
}

function loadInputs() {
  return {
    health: JSON.parse(read(HEALTH_PATH)),
    diagnostics: read(DIAGNOSTICS_PATH),
    workflow: read(WORKFLOW_PATH)
  };
}

function main() {
  const html = buildPage(loadInputs());
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`Actions check page generated: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

module.exports = {
  buildPage,
  countStatuses,
  detectTriggers,
  diagnosticsRows,
  formatDate,
  formatDateTime,
  latestIsoDate,
  loadInputs,
  OUTPUT_PATH
};

if (require.main === module) main();
