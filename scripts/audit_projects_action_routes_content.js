const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'projects', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/projects/',
  '/update-tos/',
  '/grants/',
  '/documents/',
  '/field-checklist/',
  '/chairperson/meeting/',
  '/residents/action-routes/',
  '/partners/action-routes/',
  '/chairperson/project/',
  '/done/',
  '/chairperson/documents/',
  '/communication-kit/',
  '/needs/'
];

const requiredPhrases = [
  'Маршрут проекта ТОС — от проблемы до результата',
  'Как превратить проблему территории в проект ТОС',
  'Проект начинается не со сметы',
  'Главный принцип',
  'хороший проект ТОС должен быть понятен любому жителю',
  'Маршрут проекта',
  'Описать место и боль',
  'Проверить поддержку',
  'Выбрать формат проекта',
  'Разложить на ресурсы',
  'Оформить паспорт проекта',
  'Сделать и зафиксировать',
  'Сохранить опыт',
  'Как понять, какой формат выбрать',
  'Своими силами',
  'Партнёры',
  'Конкурс',
  'Обращение',
  'Поэтапно',
  'Отложить',
  'Шаблон паспорта проекта',
  'Начните с одной понятной проблемы'
];

const requiredTemplateFields = [
  'Название проекта:',
  'ТОС / территория:',
  'Адрес или место:',
  'Проблема:',
  'Кому это мешает или кого касается:',
  'Что предлагаем сделать:',
  'Ожидаемый результат:',
  'Что уже есть: фото / актив / партнёры / материалы:',
  'Что нужно: материалы / деньги / волонтёры / техника / консультация:',
  'Примерная смета:',
  'Сроки:',
  'Кто будет отвечать:',
  'Как будет поддерживаться результат после реализации:'
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

  checkContains(errors, html, 'projects/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'projects/action-routes/index.html', '<title>Маршрут проекта ТОС — от проблемы до результата</title>');
  checkContains(errors, html, 'projects/action-routes/index.html', 'https://tosborisoglebsk.ru/projects/action-routes/');
  checkContains(errors, html, 'projects/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/projects/action-routes/"');
  checkContains(errors, html, 'projects/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'projects/action-routes/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'projects/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'projects/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'projects/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`projects/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=project#message-builder', 'type=need#message-builder', 'type=photo#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`projects/action-routes/index.html: missing ${route}`);
    }
  });

  if (!html.includes('0</b><span>обещаний финансирования')) {
    errors.push('projects/action-routes/index.html: missing no-funding-promise guidance');
  }

  if (!html.includes('одно место, одну проблему, один ожидаемый результат и один ближайший шаг')) {
    errors.push('projects/action-routes/index.html: missing one-problem guidance');
  }

  if (errors.length) {
    throw new Error(`Projects action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Projects action routes content OK');
}

main();