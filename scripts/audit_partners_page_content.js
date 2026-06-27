const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'partners', 'index.html');

const requiredInternalLinks = [
  '/partners/action-routes/',
  '/needs/',
  '/projects/',
  '/done/',
  '/contacts/'
];

const requiredPhrases = [
  'Партнёрам ТОС БГО — как помочь территориям и проектам',
  'Помочь ТОСам можно конкретным делом',
  'ТОСам часто нужна не только финансовая помощь',
  'Смысл партнёрства',
  'Как начать',
  'Как партнёру помочь ТОСам',
  'Кто может стать партнёром',
  'Чем можно помочь',
  'Почему это полезно партнёру',
  'Как выглядит помощь',
  'Примеры простой помощи',
  'Куда смотреть перед предложением помощи',
  'Шаблон предложения помощи',
  'Публичная благодарность',
  'Фотоотчёт результата'
];

const requiredTemplateFields = [
  'Организация / человек:',
  'Чем готовы помочь:',
  'Количество / объём:',
  'Для какого ТОСа или любой территории:',
  'Сроки:',
  'Нужна ли публичная благодарность: да / нет',
  'Как можно указать партнёра в публикации:',
  'Контакт:',
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

  checkContains(errors, html, 'partners/index.html', '<html lang="ru"');
  checkContains(errors, html, 'partners/index.html', '<title>Партнёрам ТОС БГО — как помочь территориям и проектам</title>');
  checkContains(errors, html, 'partners/index.html', 'https://tosborisoglebsk.ru/partners/');
  checkContains(errors, html, 'partners/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/partners/"');
  checkContains(errors, html, 'partners/index.html', '<main id="main">');
  checkContains(errors, html, 'partners/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'partners/index.html', 'href="https://vk.ru/tosbgo" target="_blank" rel="noopener"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'partners/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'partners/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'partners/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`partners/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('материалы') || !html.includes('транспорт') || !html.includes('волонтёры')) {
    errors.push('partners/index.html: missing core help formats');
  }

  if (errors.length) {
    throw new Error(`Partners page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Partners page content OK');
}

main();
