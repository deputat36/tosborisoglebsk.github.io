const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const MARKER = "const TOS_CONTENT_ACTIONS_VERSION = '2026-07-31';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS content actions patch marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (
    current.includes(MARKER) &&
    current.includes('data-tos-content-action-plan') &&
    current.includes('Что полезно прислать следующим')
  ) {
    return { content: current, changed: false };
  }

  let source = current;

  if (!source.includes(MARKER)) {
    source = replaceOrFail(
      source,
      /(const TOS_ACTIVITY_SUMMARY_VERSION = '[^']+';)/,
      `$1\n${MARKER}`,
      'version marker'
    );
  }

  const helpers = `function contentActionCard(key, title, text, url, button, secondary = '') {
  return \`<article class="card" data-content-action="\${esc(key)}"><div class="card-inner"><span class="tag warn">Нужен материал</span><h3>\${esc(title)}</h3><p>\${esc(text)}</p><div class="card-actions"><a class="btn primary" href="\${esc(url)}">\${esc(button)}</a>\${secondary}</div></div></article>\`;
}
function contentActionPlan(tos, data) {
  const states = {
    news: coverageFor(data.news, tos.slug, 'news'),
    done: coverageFor(data.done, tos.slug, 'done'),
    needs: coverageFor(data.needs, tos.slug, 'needs')
  };
  const cards = [];
  const missing = [];

  if (states.news.substantive === 0) {
    missing.push('news');
    cards.push(contentActionCard(
      'news',
      'Прислать содержательную новость',
      'Подойдёт конкретное событие, выполненная работа или важное объявление с датой, местом, участниками и источником сведений.',
      updateUrl(tos, 'news'),
      'Подготовить новость',
      \`<a class="btn" href="\${esc(updateUrl(tos, 'photo'))}">Фотоотчёт</a>\`
    ));
  }

  if (states.done.substantive === 0) {
    missing.push('done');
    cards.push(contentActionCard(
      'done',
      'Показать завершённый результат',
      'Опишите исходную проблему, что сделали, кто участвовал и что изменилось. Для благоустройства особенно полезны фотографии до, в процессе и после.',
      updateUrl(tos, 'photo'),
      'Оформить результат'
    ));
  }

  if (states.needs.substantive === 0) {
    missing.push('needs');
    cards.push(contentActionCard(
      'needs',
      'Уточнить актуальную потребность',
      'Укажите, что действительно нужно территории сейчас, для чего, в каком объёме, до какого срока, кто отвечает и откуда получена информация.',
      updateUrl(tos, 'need'),
      'Оформить потребность'
    ));
  }

  const requests = states.news.requests + states.done.requests + states.needs.requests;
  const stateAttributes = [
    \`data-news-needed="\${states.news.substantive === 0}"\`,
    \`data-done-needed="\${states.done.substantive === 0}"\`,
    \`data-needs-needed="\${states.needs.substantive === 0}"\`,
    \`data-request-count="\${requests}"\`,
    \`data-action-count="\${missing.length}"\`
  ].join(' ');

  if (!cards.length) {
    return \`<section class="section tight" id="tos-content-actions" data-tos-content-action-plan data-tos-slug="\${esc(tos.slug)}" \${stateAttributes}><div class="container notice"><b>Основные виды материалов уже представлены.</b> Поддерживайте карточку актуальной и присылайте новые новости, события, результаты или проекты по мере появления.</div></section>\`;
  }

  const requestNote = requests > 0
    ? \` В карточке уже есть редакционных запросов: \${requests}; они помогают собрать сведения, но не заменяют конкретную публикацию.\`
    : '';

  return \`<section class="section" id="tos-content-actions" data-tos-content-action-plan data-tos-slug="\${esc(tos.slug)}" \${stateAttributes}><div class="container section-head"><div><h2>Что полезно прислать следующим</h2><p>Персональный план сформирован по содержательным публикациям, уже связанным с этой карточкой.</p></div><a class="btn" href="/submit-materials/">Как подготовить материал</a></div><div class="container grid">\${cards.join('')}</div><div class="container notice" data-content-action-boundary><b>Граница вывода:</b> отсутствие записи на портале не означает, что ТОС не ведёт такую работу. План показывает только пробелы в опубликованных материалах. После появления конкретной проверенной публикации соответствующий пункт исчезнет автоматически.\${esc(requestNote)}</div></section>\`;
}
`;

  source = replaceOrFail(
    source,
    /function block\(title, subtitle, linkText, linkUrl, content, layout = 'list', sectionId = ''\) \{/,
    `${helpers}\nfunction block(title, subtitle, linkText, linkUrl, content, layout = 'list', sectionId = '') {`,
    'content action helpers'
  );

  source = replaceOrFail(
    source,
    /(const activitySummaryHtml = activitySummary\(tos, data\);)/,
    `$1\n  const contentActionPlanHtml = contentActionPlan(tos, data);`,
    'content action plan materialization'
  );

  source = replaceOrFail(
    source,
    /  const actions = `<article class="card">[\s\S]*?<\/article>`;\n/,
    `  const actions = \`<article class="card"><div class="card-inner"><h3>Уточнить паспорт и контакты</h3><p>Исправьте председателя, открытые контакты, границы или описание и обязательно укажите источник сведений.</p><a class="btn primary" href="\${esc(updateUrl(tos, 'card'))}">Передать уточнение</a></div></article><article class="card"><div class="card-inner"><h3>Предложить проект или событие</h3><p>Опишите новую инициативу либо добавьте точные дату, место и организатора предстоящего события.</p><a class="btn" href="\${esc(updateUrl(tos, 'project'))}">Предложить проект</a><p class="tiny"><a href="\${esc(updateUrl(tos, 'event'))}">Добавить событие</a></p></div></article>\`;\n`,
    'generic action cards'
  );

  source = replaceOrFail(
    source,
    /(    \$\{activitySummaryHtml\}\n)\n\n    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Передать сведения или инициативу<\/h2><p>Выберите один подходящий сценарий и не отправляйте закрытые персональные данные\.<\/p><\/div><a class="btn" href="\/partners\/">Партнёрам<\/a><\/div><div class="container grid">\$\{actions\}<\/div><\/section>/,
    `$1\n    \${contentActionPlanHtml}\n\n    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Другие способы участия</h2><p>Уточните паспорт ТОС, предложите проект или добавьте событие. Не отправляйте закрытые персональные данные.</p></div><a class="btn" href="/partners/">Партнёрам</a></div><div class="container grid">\${actions}</div></section>`,
    'page insertion and secondary actions'
  );

  const required = [
    MARKER,
    'function contentActionPlan(tos, data)',
    'data-tos-content-action-plan',
    'Что полезно прислать следующим',
    'data-content-action="${esc(key)}"',
    'contentActionPlanHtml',
    'Другие способы участия',
    "updateUrl(tos, 'event')"
  ];
  required.forEach((fragment) => {
    if (!source.includes(fragment)) throw new Error(`Patched TOS generator is missing ${fragment}`);
  });

  return { content: source, changed: true };
}

function regeneratePagesWithoutChangingSitemap() {
  const hadSitemap = fs.existsSync(SITEMAP_PATH);
  const sitemapBefore = hadSitemap ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';

  try {
    execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });
  } finally {
    if (hadSitemap) fs.writeFileSync(SITEMAP_PATH, sitemapBefore, 'utf8');
    else fs.rmSync(SITEMAP_PATH, { force: true });
  }
}

function patchTosContentActions({ regenerate = true } = {}) {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);
  const current = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(GENERATOR_PATH, result.content, 'utf8');

  if (regenerate) regeneratePagesWithoutChangingSitemap();

  console.log(`TOS content actions patch ${result.changed ? 'applied' : 'already current'}${regenerate ? '; pages regenerated, sitemap preserved' : ''}`);
  return result.changed;
}

if (require.main === module) patchTosContentActions();

module.exports = { MARKER, patchSource, patchTosContentActions };
