const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'calendar', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/calendar/',
  '/update-tos/',
  '/chairperson/action-routes/',
  '/residents/action-routes/',
  '/communication-kit/',
  '/needs/action-routes/',
  '/chairperson/meeting/',
  '/field-checklist/',
  '/done/action-routes/',
  '/projects/action-routes/'
];

const requiredPhrases = [
  'Маршрут события ТОС — от анонса до фотоотчёта',
  'Как подготовить событие ТОС и довести его до результата',
  'Событие ТОС — это не только дата в календаре',
  'Главный принцип',
  'Маршрут события',
  'Понять, зачем событие',
  'Добавить событие в календарь',
  'Понять, что нужно',
  'Зафиксировать ход события',
  'Прислать новость или фотоотчёт',
  'Связать с проектом или результатом',
  'Какие события бывают у ТОС',
  'Собрание',
  'Субботник',
  'Праздник',
  'Проектная встреча',
  'Обучение',
  'Акция',
  'Шаблон события',
  'После события сразу сохраните итог'
];

const requiredTemplateFields = [
  'Название события:',
  'ТОС:',
  'Тип события: собрание / субботник / праздник / обучение / проектная встреча / акция / другое',
  'Дата:',
  'Время:',
  'Место:',
  'Кто может участвовать:',
  'Что взять с собой:',
  'Что нужно подготовить:',
  'Ответственный:',
  'Контакт:',
  'Нужна ли помощь партнёров:',
  'Какой результат ожидается:',
  'Нужно ли опубликовать анонс: да / нет'
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

  checkContains(errors, html, 'calendar/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'calendar/action-routes/index.html', '<title>Маршрут события ТОС — от анонса до фотоотчёта</title>');
  checkContains(errors, html, 'calendar/action-routes/index.html', 'https://tosborisoglebsk.ru/calendar/action-routes/');
  checkContains(errors, html, 'calendar/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/calendar/action-routes/"');
  checkContains(errors, html, 'calendar/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'calendar/action-routes/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'calendar/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'calendar/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'calendar/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`calendar/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=event#message-builder', 'type=photo#message-builder', 'type=news#message-builder', 'type=need#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`calendar/action-routes/index.html: missing ${route}`);
    }
  });

  if (!html.includes('где, когда, зачем, кто может прийти')) {
    errors.push('calendar/action-routes/index.html: missing pre-event clarity principle');
  }

  if (!html.includes('До, процесс и после') && !html.includes('фото до/после')) {
    errors.push('calendar/action-routes/index.html: missing photo report guidance');
  }

  if (errors.length) {
    throw new Error(`Calendar action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Calendar action routes content OK');
}

main();
