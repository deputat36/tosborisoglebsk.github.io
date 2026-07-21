const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CALENDAR_PATH = path.join(ROOT, 'calendar', 'index.html');
const VERSION = '2026-07-21';
const MARKER = `data-calendar-filter-version="${VERSION}"`;

const FILTER_SECTION_RE = /    <section class="section"><div class="container section-head"><div><h2>Фильтр событий и дедлайнов<\/h2>[\s\S]*?<\/div><\/section>\n\n    <section class="section"><div class="container list" id="events-list">/;
const EVENTS_SCRIPT_RE = /  <script src="\/assets\/js\/events\.js"><\/script>/;

const FILTER_SECTION = `    <section class="section" id="calendar-browser" ${MARKER}><div class="container section-head"><div><h2>Фильтр событий и дедлайнов</h2><p id="event-filter-help">По умолчанию показаны сегодняшние и будущие записи. Архив, рабочие даты редакции и записи с внешними источниками можно открыть отдельными фильтрами; выбранные условия сохраняются в ссылке.</p></div><a class="btn" href="/update-tos/?type=event#message-builder">Добавить событие</a></div><div class="container" id="events-summary" aria-label="Сводка календаря"></div><div class="container toolbar"><input class="input" id="event-search" type="search" placeholder="Поиск: конкурс, субботник, отчёт, обучение, собрание..." aria-label="Поиск событий и дедлайнов" aria-describedby="event-filter-help event-filter-status"/><select class="select" id="event-period-filter" aria-label="Фильтр событий по периоду"><option value="upcoming">Предстоящие и сегодня</option><option value="all">Все даты</option><option value="today">Только сегодня</option><option value="future">Только будущие</option><option value="past">Архив прошедших</option><option value="undated">Дата уточняется</option></select><select class="select" id="event-source-filter" aria-label="Фильтр событий по происхождению даты"><option value="">Все источники</option><option value="external">Есть внешний источник</option><option value="editorial">Рабочая дата редакции</option><option value="unconfirmed">Источник нужно уточнить</option></select><select class="select" id="event-type-filter" aria-label="Фильтр событий по типу"><option value="">Все типы</option></select><select class="select" id="event-tos-filter" aria-label="Фильтр событий по ТОС"><option value="">Все ТОС</option></select><button class="btn" id="event-reset-filters" type="button">Сбросить</button></div><p class="container tiny" id="event-filter-status" role="status" aria-live="polite">Загрузка календаря и подсчёт записей...</p></section>

    <section class="section"><div class="container list" id="events-list">`;

function patchCalendarHtml(current) {
  if (current.includes(MARKER)) return { content: current, changed: false };
  if (!FILTER_SECTION_RE.test(current)) throw new Error('Calendar filter section marker not found');
  if (!EVENTS_SCRIPT_RE.test(current)) throw new Error('Calendar events script marker not found');

  let content = current.replace(FILTER_SECTION_RE, FILTER_SECTION);
  content = content.replace(
    EVENTS_SCRIPT_RE,
    '  <script src="/assets/js/events-core.js"></script>\n  <script src="/assets/js/events.js"></script>'
  );
  return { content, changed: true };
}

function patchCalendarCurrentState() {
  if (!fs.existsSync(CALENDAR_PATH)) throw new Error(`Missing calendar page: ${CALENDAR_PATH}`);
  const current = fs.readFileSync(CALENDAR_PATH, 'utf8');
  const result = patchCalendarHtml(current);
  if (result.changed) fs.writeFileSync(CALENDAR_PATH, result.content, 'utf8');
  console.log(result.changed ? 'Calendar current-state filters applied' : 'Calendar current-state filters already applied');
  return result.changed;
}

if (require.main === module) patchCalendarCurrentState();

module.exports = { VERSION, MARKER, patchCalendarHtml, patchCalendarCurrentState };
