const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'residents', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/residents/',
  '/tos/',
  '/places/',
  '/map/',
  '/needs/',
  '/projects/',
  '/partners/',
  '/calendar/',
  '/done/',
  '/contacts/',
  '/field-checklist/',
  '/update-tos/'
];

const requiredPhrases = [
  'Маршрут жителя — как участвовать в жизни территории через ТОС',
  'Как жителю включиться в работу ТОС',
  'Не нужно знать все законы и документы',
  'ТОС не заменяет администрацию',
  'Выберите, что хотите сделать',
  'Понять, какой ТОС рядом',
  'Передать проблему территории',
  'Оформить идею в проект',
  'Закрыть конкретную потребность',
  'Участвовать в событии',
  'Показать результат',
  'Как описать проблему, чтобы её было проще решить',
  'Готовый текст для сообщения',
  'Чем можно помочь без денег',
  'Начните с простого действия'
];

const requiredTemplateFields = [
  'ТОС или территория:',
  'Адрес / место:',
  'Что нужно исправить или сделать:',
  'Почему это важно:',
  'Кому это поможет:',
  'Есть ли фото:',
  'Кто готов участвовать:',
  'Какая помощь нужна:',
  'Контакт для уточнения:'
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

  checkContains(errors, html, 'residents/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'residents/action-routes/index.html', '<title>Маршрут жителя — как участвовать в жизни территории через ТОС</title>');
  checkContains(errors, html, 'residents/action-routes/index.html', 'https://tosborisoglebsk.ru/residents/action-routes/');
  checkContains(errors, html, 'residents/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/residents/action-routes/"');
  checkContains(errors, html, 'residents/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'residents/action-routes/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'residents/action-routes/index.html', 'href="https://vk.ru/tosbgo" target="_blank" rel="noopener"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'residents/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'residents/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'residents/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`residents/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=need#message-builder', 'type=project#message-builder', 'type=event#message-builder', 'type=news#message-builder', 'type=photo#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`residents/action-routes/index.html: missing ${route}`);
    }
  });

  if (errors.length) {
    throw new Error(`Residents action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Residents action routes content OK');
}

main();
