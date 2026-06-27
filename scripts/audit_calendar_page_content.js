const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'calendar', 'index.html');

const requiredInternalLinks = [
  '/calendar/action-routes/',
  '/update-tos/',
  '/grants/',
  '/chairperson/action-routes/',
  '/residents/action-routes/',
  '/partners/action-routes/'
];

const requiredPhrases = [
  'Календарь ТОС БГО — события, дедлайны и рабочий план председателя',
  'События, дедлайны и контрольные точки ТОС',
  'Календарь помогает председателям и активу',
  'Актуальность:',
  'даты грантов, форумов и внешних программ могут меняться',
  'С чего начать',
  'Как подготовить событие ТОС',
  'Как использовать календарь',
  'Председателю',
  'Активу ТОС',
  'Партнёрам',
  'Ежемесячный рабочий план председателя',
  'Сезонный ориентир для ТОС',
  'Фильтр событий и дедлайнов',
  'Список ниже загружается из data/events.json',
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
  'Какой результат ожидается:'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) {
    errors.push(`${label}: missing ${needle}`);
  }
}

function main() {
  const html = read(htmlPath);
  const errors = [];

  checkContains(errors, html, 'calendar/index.html', '<html lang="ru"');
  checkContains(errors, html, 'calendar/index.html', '<title>Календарь ТОС БГО — события, дедлайны и рабочий план председателя</title>');
  checkContains(errors, html, 'calendar/index.html', 'https://tosborisoglebsk.ru/calendar/');
  checkContains(errors, html, 'calendar/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/calendar/"');
  checkContains(errors, html, 'calendar/index.html', '<main id="main">');
  checkContains(errors, html, 'calendar/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'calendar/index.html', '/assets/js/events.js');
  checkContains(errors, html, 'calendar/index.html', 'id="events-list"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-search"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-type-filter"');
  checkContains(errors, html, 'calendar/index.html', 'id="event-tos-filter"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'calendar/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'calendar/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'calendar/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`calendar/index.html: missing linked local page ${link}`);
    }
  });

  ['type=event#message-builder', 'type=photo#message-builder', 'type=need#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`calendar/index.html: missing ${route}`);
    }
  });

  if (!html.includes('1–5 число') || !html.includes('26–31 число')) {
    errors.push('calendar/index.html: missing monthly plan ranges');
  }

  if (!html.includes('Январь — февраль') || !html.includes('Ноябрь — декабрь')) {
    errors.push('calendar/index.html: missing seasonal planning ranges');
  }

  if (errors.length) {
    throw new Error(`Calendar page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Calendar page content OK');
}

main();
