const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'needs', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/needs/',
  '/update-tos/',
  '/partners/action-routes/',
  '/field-checklist/',
  '/chairperson/action-routes/',
  '/residents/action-routes/',
  '/projects/action-routes/',
  '/contacts/',
  '/done/',
  '/communication-kit/'
];

const requiredPhrases = [
  'Маршрут потребности ТОС — от просьбы до результата',
  'Как оформить потребность ТОС, чтобы её реально закрыли',
  'Потребность работает, когда она конкретная',
  'Главный принцип',
  'потребность — это не жалоба',
  'Маршрут потребности',
  'Что именно нужно',
  'Количество, место и срок',
  'Объяснить результат',
  'Передать конкретный запрос',
  'Зафиксировать помощь',
  'Согласовать публикацию',
  'Что лучше публиковать как потребность',
  'Нужен конкретный ресурс',
  'Есть понятный срок',
  'Есть ответственный',
  'Это жалоба или спор',
  'Нет конкретики',
  'Нужен результат',
  'Шаблон хорошей потребности',
  'Начните с конкретной просьбы'
];

const requiredTemplateFields = [
  'ТОС:',
  'Что нужно:',
  'Тип помощи: материалы / техника / транспорт / волонтёры / фото / текст / партнёры / другое',
  'Количество / объём:',
  'Для чего нужно:',
  'Где будет использоваться:',
  'Срок:',
  'Приоритет: высокий / средний / низкий',
  'Кто ответственный:',
  'Контакт:',
  'Как именно можно помочь:',
  'Когда снять потребность с сайта:',
  'Фото / ссылка:'
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

  checkContains(errors, html, 'needs/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'needs/action-routes/index.html', '<title>Маршрут потребности ТОС — от просьбы до результата</title>');
  checkContains(errors, html, 'needs/action-routes/index.html', 'https://tosborisoglebsk.ru/needs/action-routes/');
  checkContains(errors, html, 'needs/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/needs/action-routes/"');
  checkContains(errors, html, 'needs/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'needs/action-routes/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'needs/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'needs/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'needs/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`needs/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=need#message-builder', 'type=photo#message-builder', 'type=news#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`needs/action-routes/index.html: missing ${route}`);
    }
  });

  if (!html.includes('без публичного имени')) {
    errors.push('needs/action-routes/index.html: missing no-public-name guidance');
  }

  if (!html.includes('ресурс, количество, место, срок и ответственный')) {
    errors.push('needs/action-routes/index.html: missing concrete request formula');
  }

  if (errors.length) {
    throw new Error(`Needs action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Needs action routes content OK');
}

main();
