const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const eventsCore = require('../assets/js/events-core');

const ROOT = process.cwd();
const htmlPath = path.join(ROOT, 'calendar', 'index.html');
const scriptPath = path.join(ROOT, 'assets', 'js', 'events.js');
const corePath = path.join(ROOT, 'assets', 'js', 'events-core.js');
const calendarPatcherPath = path.join(ROOT, 'scripts', 'patch_calendar_current_state.js');
const pipelinePatcherPath = path.join(ROOT, 'scripts', 'patch_tos_detail_responsive_styles.js');

const requiredInternalLinks = [
  '/calendar/action-routes/',
  '/update-tos/',
  '/grants/',
  '/chairperson/action-routes/',
  '/residents/action-routes/',
  '/partners/action-routes/',
  '/faq/'
];

const requiredPhrases = [
  'Календарь ТОС БГО — события, дедлайны и рабочий план председателя',
  'События, дедлайны и контрольные точки ТОС',
  'Календарь помогает председателям и активу',
  'Актуальность:',
  'даты грантов, форумов и внешних программ могут меняться',
  'Как читать даты и источники',
  'Есть внешний источник',
  'Рабочая дата редакции',
  'Дата впереди / дата прошла',
  'Источник нужно уточнить',
  'календарь не принимает оплаты и не подтверждает регистрацию',
  'С чего начать',
  'Как подготовить событие ТОС',
  'Как использовать календарь',
  'Председателю',
  'Активу ТОС',
  'Партнёрам',
  'Ежемесячный рабочий план председателя',
  'Сезонный ориентир для ТОС',
  'Фильтр событий и дедлайнов',
  'По умолчанию показаны сегодняшние и будущие записи',
  'выбранные условия сохраняются в ссылке',
  'Шаблон события для календаря'
];

const requiredTemplateFields = [
  'Название события:',
  'ТОС:',
  'Тип события: собрание / субботник / праздник / обучение / проектная встреча / акция / другое',
  'Дата:',
  'Время:',
  'Место:',
  'Кто может участвовать:',
  'Что нужно взять с собой:',
  'Что нужно подготовить:',
  'Ответственный:',
  'Телефон / ссылка для связи:',
  'Нужна ли помощь партнёров:',
  'Какой результат ожидается:',
  'Первичный источник даты:',
  'Когда дата проверена:'
];

const requiredScriptPhrases = [
  'window.EventsCore',
  'eventsCore.stateFromSearch(location.search)',
  'eventsCore.stateToSearch(state)',
  'eventsCore.filterAndSort(events, state',
  'eventsCore.summary(events)',
  'eventsCore.activeFilterCount(state)',
  'data-event-id=',
  'data-event-date-state=',
  'data-event-source-kind=',
  'data-event-tos=',
  'Проверка даты',
  'Проверить связанный источник',
  'Уточнить или добавить событие',
  'history.replaceState',
  "period.value = 'upcoming'"
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

function checkEqual(errors, actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function auditCoreContracts(errors) {
  const now = new Date('2026-07-21T12:00:00');
  const fixtures = [
    { id: 'past', status: 'published', date: '2026-07-20', time: '10:00', title: 'Прошедшее', source: 'Редакция портала' },
    { id: 'today', status: 'published', date: '2026-07-21', time: '09:00', title: 'Сегодня', source: 'Без источника' },
    { id: 'future', status: 'published', date: '2026-07-22', time: '08:00', title: 'Будущее', source: 'Организатор', source_url: 'https://example.org/event' },
    { id: 'undated', status: 'published', date: '', title: 'Без даты', source: '' },
    { id: 'draft', status: 'draft', date: '2026-07-23', title: 'Черновик', source: 'Редакция портала' }
  ];

  checkEqual(errors, eventsCore.dateState(fixtures[0], now).key, 'past', 'events-core: past date state');
  checkEqual(errors, eventsCore.dateState(fixtures[1], now).key, 'today', 'events-core: today date state');
  checkEqual(errors, eventsCore.dateState(fixtures[2], now).key, 'future', 'events-core: future date state');
  checkEqual(errors, eventsCore.dateState(fixtures[3], now).key, 'undated', 'events-core: undated date state');
  checkEqual(errors, eventsCore.sourceKind(fixtures[0]), 'editorial', 'events-core: editorial source state');
  checkEqual(errors, eventsCore.sourceKind(fixtures[2]), 'external', 'events-core: external source state');
  checkEqual(errors, eventsCore.sourceKind(fixtures[3]), 'unconfirmed', 'events-core: unconfirmed source state');

  checkEqual(
    errors,
    eventsCore.stateFromSearch('?q=%D1%84%D0%BE%D1%80%D1%83%D0%BC&period=past&source=editorial&type=%D0%A4%D0%BE%D1%80%D1%83%D0%BC&tos=test'),
    { q: 'форум', type: 'Форум', tos: 'test', period: 'past', source: 'editorial' },
    'events-core: URL state parsing'
  );
  checkEqual(
    errors,
    eventsCore.stateFromSearch('?period=invalid&source=invalid'),
    { q: '', type: '', tos: '', period: 'upcoming', source: '' },
    'events-core: invalid URL state fallback'
  );
  checkEqual(
    errors,
    eventsCore.stateToSearch({ q: '', type: '', tos: '', period: 'upcoming', source: '' }),
    '',
    'events-core: default URL state'
  );

  const upcoming = eventsCore.filterAndSort(fixtures, { period: 'upcoming' }, { now });
  checkEqual(errors, upcoming.map((item) => item.id), ['today', 'future'], 'events-core: upcoming filter and sort');
  const archive = eventsCore.filterAndSort(fixtures, { period: 'past' }, { now });
  checkEqual(errors, archive.map((item) => item.id), ['past'], 'events-core: archive filter');
  const external = eventsCore.filterAndSort(fixtures, { period: 'all', source: 'external' }, { now });
  checkEqual(errors, external.map((item) => item.id), ['future'], 'events-core: source filter');
  const undated = eventsCore.filterAndSort(fixtures, { period: 'undated' }, { now });
  checkEqual(errors, undated.map((item) => item.id), ['undated'], 'events-core: undated filter');

  checkEqual(
    errors,
    eventsCore.summary(fixtures, now),
    { total: 4, upcoming: 2, today: 1, future: 1, past: 1, undated: 1, external: 1, editorial: 1, unconfirmed: 2 },
    'events-core: summary counts'
  );
}

function main() {
  const html = read(htmlPath);
  const script = read(scriptPath);
  const core = read(corePath);
  const calendarPatcher = read(calendarPatcherPath);
  const pipelinePatcher = read(pipelinePatcherPath);
  const errors = [];

  checkContains(errors, html, 'calendar/index.html', '<html lang="ru"');
  checkContains(errors, html, 'calendar/index.html', '<title>Календарь ТОС БГО — события, дедлайны и рабочий план председателя</title>');
  checkContains(errors, html, 'calendar/index.html', 'https://tosborisoglebsk.ru/calendar/');
  checkContains(errors, html, 'calendar/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/calendar/"');
  checkContains(errors, html, 'calendar/index.html', '<main id="main">');
  checkContains(errors, html, 'calendar/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'calendar/index.html', '/assets/js/events-core.js');
  checkContains(errors, html, 'calendar/index.html', '/assets/js/events.js');
  checkContains(errors, html, 'calendar/index.html', 'data-calendar-filter-version="2026-07-21"');
  checkContains(errors, html, 'calendar/index.html', 'id="calendar-statuses"');
  checkContains(errors, html, 'calendar/index.html', 'id="calendar-browser"');
  checkContains(errors, html, 'calendar/index.html', 'id="events-summary"');
  checkContains(errors, html, 'calendar/index.html', 'id="events-list"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-search" type="search"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-period-filter"');
  checkContains(errors, html, 'calendar/index.html', '<option value="upcoming">Предстоящие и сегодня</option>');
  checkContains(errors, html, 'calendar/index.html', '<option value="past">Архив прошедших</option>');
  checkContains(errors, html, 'calendar/index.html', '<option value="undated">Дата уточняется</option>');
  checkContains(errors, html, 'calendar/index.html', 'id="event-source-filter"');
  checkContains(errors, html, 'calendar/index.html', '<option value="editorial">Рабочая дата редакции</option>');
  checkContains(errors, html, 'calendar/index.html', '<option value="external">Есть внешний источник</option>');
  checkContains(errors, html, 'calendar/index.html', 'id="event-type-filter"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-tos-filter"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-reset-filters" type="button"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-filter-status" role="status" aria-live="polite"');
  checkContains(errors, html, 'calendar/index.html', 'aria-describedby="event-filter-help event-filter-status"');

  const coreIndex = html.indexOf('/assets/js/events-core.js');
  const scriptIndex = html.indexOf('/assets/js/events.js');
  if (coreIndex < 0 || scriptIndex < 0 || coreIndex > scriptIndex) {
    errors.push('calendar/index.html: events-core.js must load before events.js');
  }

  requiredPhrases.forEach((phrase) => checkContains(errors, html, 'calendar/index.html', phrase));
  requiredTemplateFields.forEach((field) => checkContains(errors, html, 'calendar/index.html', field));

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'calendar/index.html', `href="${link}`);
    if (!repoPathExists(link)) errors.push(`calendar/index.html: missing linked local page ${link}`);
  });

  ['type=event#message-builder', 'type=photo#message-builder', 'type=need#message-builder'].forEach((route) => {
    if (!html.includes(route)) errors.push(`calendar/index.html: missing ${route}`);
  });

  if (!html.includes('1–5 число') || !html.includes('26–31 число')) {
    errors.push('calendar/index.html: missing monthly plan ranges');
  }
  if (!html.includes('Январь — февраль') || !html.includes('Ноябрь — декабрь')) {
    errors.push('calendar/index.html: missing seasonal planning ranges');
  }

  requiredScriptPhrases.forEach((phrase) => checkContains(errors, script, 'assets/js/events.js', phrase));
  if (script.includes('function eventDateState') || script.includes('function eventSourceKind')) {
    errors.push('assets/js/events.js: date and source decisions must stay in events-core.js');
  }
  if (script.includes("${past ? 'прошло' : 'актуально'}") || script.includes("'актуально'")) {
    errors.push('assets/js/events.js: a future calendar date must not be labelled as confirmed актуально');
  }
  if (!script.includes('target="_blank" rel="noopener"')) {
    errors.push('assets/js/events.js: external source links must open safely');
  }

  [
    'function dateState',
    'function sourceKind',
    'function stateFromSearch',
    'function stateToSearch',
    'function filterAndSort',
    'function summary',
    "period !== 'upcoming'",
    "source.includes('редакция портала')"
  ].forEach((phrase) => checkContains(errors, core, 'assets/js/events-core.js', phrase));

  checkContains(errors, calendarPatcher, 'scripts/patch_calendar_current_state.js', "const VERSION = '2026-07-21';");
  checkContains(errors, calendarPatcher, 'scripts/patch_calendar_current_state.js', 'patchCalendarHtml');
  checkContains(errors, calendarPatcher, 'scripts/patch_calendar_current_state.js', '/assets/js/events-core.js');
  checkContains(errors, pipelinePatcher, 'scripts/patch_tos_detail_responsive_styles.js', "require('./patch_calendar_current_state')");
  checkContains(errors, pipelinePatcher, 'scripts/patch_tos_detail_responsive_styles.js', 'patchCalendarCurrentState();');

  auditCoreContracts(errors);

  if (errors.length) throw new Error(`Calendar page content audit failed:\n${errors.join('\n')}`);
  console.log('Calendar page content OK: current-state filters, URL state and deterministic date contracts checked');
}

main();
