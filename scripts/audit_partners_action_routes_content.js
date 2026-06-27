const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'partners', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/partners/',
  '/needs/',
  '/projects/',
  '/done/',
  '/contacts/',
  '/calendar/',
  '/media-guide/',
  '/grants/',
  '/update-tos/'
];

const requiredPhrases = [
  'Маршрут партнёра — как помочь ТОСам Борисоглебского округа',
  'Как партнёру помочь ТОСам конкретным делом',
  'Помощь территории должна быть понятной',
  'Главный принцип',
  'Выберите формат помощи',
  'Материалы',
  'Транспорт и техника',
  'Волонтёры',
  'Информация',
  'Площадка',
  'Экспертиза',
  'Маршрут партнёра',
  'Найти конкретную задачу',
  'Понять объём и сроки',
  'Помочь ресурсом',
  'Получить фотоотчёт',
  'Согласовать публикацию',
  'Готовый текст предложения помощи',
  'Как выглядит хорошая благодарность',
  'Начните с выбора понятной потребности'
];

const requiredTemplateFields = [
  'Организация / человек:',
  'Чем готовы помочь:',
  'Количество / объём:',
  'Для какого ТОСа или любой территории:',
  'Когда удобно передать помощь:',
  'Нужна ли публичная благодарность: да / нет',
  'Как можно указать партнёра в публикации:',
  'Контакт для связи:',
  'Комментарий:'
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

  checkContains(errors, html, 'partners/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'partners/action-routes/index.html', '<title>Маршрут партнёра — как помочь ТОСам Борисоглебского округа</title>');
  checkContains(errors, html, 'partners/action-routes/index.html', 'https://tosborisoglebsk.ru/partners/action-routes/');
  checkContains(errors, html, 'partners/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/partners/action-routes/"');
  checkContains(errors, html, 'partners/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'partners/action-routes/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'partners/action-routes/index.html', 'href="https://vk.ru/tosbgo"');
  checkContains(errors, html, 'partners/action-routes/index.html', 'target="_blank" rel="noopener"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'partners/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'partners/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'partners/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`partners/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=photo#message-builder', 'type=event#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`partners/action-routes/index.html: missing ${route}`);
    }
  });

  if (!html.includes('без публичности')) {
    errors.push('partners/action-routes/index.html: missing no-publicity option');
  }

  if (errors.length) {
    throw new Error(`Partners action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Partners action routes content OK');
}

main();
