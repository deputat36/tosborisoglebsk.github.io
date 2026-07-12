const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'residents', 'index.html');
const patchPath = path.join(process.cwd(), 'scripts', 'patch_residents_quick_start.js');

const requiredInternalLinks = [
  '/residents/action-routes/',
  '/tos/',
  '/needs/',
  '/update-tos/',
  '/contacts/'
];

const requiredPhrases = [
  'Жителям — как пользоваться ТОС и участвовать в жизни территории',
  'Как участвовать в жизни своей территории через ТОС',
  'ТОС помогает жителям объединяться вокруг конкретных дел',
  'Жителю достаточно начать с трёх шагов',
  'Главный маршрут',
  'Найдите свой ТОС',
  'Проверьте контакты',
  'Выберите действие',
  'Что ТОС может делать',
  'Что ТОС не заменяет',
  'Куда обращаться в разных случаях',
  'Как предложить идею',
  'Как помочь без денег',
  'Частые вопросы',
  'Сайт официальный?',
  'Это информационный и рабочий портал'
];

const requiredQuickStartPhrases = [
  'resident-quick-start',
  'Жителю достаточно начать с трёх шагов',
  'Найдите свой ТОС',
  'Проверьте контакты',
  'Выберите действие',
  '/residents/action-routes/',
  '/update-tos/?type=card#message-builder'
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
  const patch = read(patchPath);
  const errors = [];

  checkContains(errors, html, 'residents/index.html', '<html lang="ru"');
  checkContains(errors, html, 'residents/index.html', '<title>Жителям — как пользоваться ТОС и участвовать в жизни территории</title>');
  checkContains(errors, html, 'residents/index.html', 'https://tosborisoglebsk.ru/residents/');
  checkContains(errors, html, 'residents/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/residents/"');
  checkContains(errors, html, 'residents/index.html', '<main id="main">');
  checkContains(errors, html, 'residents/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'residents/index.html', 'href="https://vk.ru/tosbgo"');
  checkContains(errors, html, 'residents/index.html', 'target="_blank" rel="noopener"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'residents/index.html', phrase);
  });

  requiredQuickStartPhrases.forEach((phrase) => {
    checkContains(errors, patch, 'patch_residents_quick_start.js', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'residents/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`residents/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('type=need#message-builder')) {
    errors.push('residents/index.html: missing need message builder link');
  }

  if (!html.includes('type=project#message-builder')) {
    errors.push('residents/index.html: missing project message builder link');
  }

  if (!html.includes('Адрес или место:')) {
    errors.push('residents/index.html: missing idea template field Адрес или место');
  }

  if (!html.includes('Что предлагаете сделать:')) {
    errors.push('residents/index.html: missing idea template field Что предлагаете сделать');
  }

  if (!html.includes('Ваш контакт для уточнения:')) {
    errors.push('residents/index.html: missing idea template field Ваш контакт для уточнения');
  }

  if (html.includes('href="/map/"')) {
    errors.push('residents/index.html: empty geodata map must not be promoted as a resident action');
  }

  if (html.includes('<h2>Что можно сделать на сайте</h2>')) {
    errors.push('residents/index.html: duplicate action section must be removed after focused quick start');
  }

  if (errors.length) {
    throw new Error(`Residents page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Residents page content OK');
}

main();
