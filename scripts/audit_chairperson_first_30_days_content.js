const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'first-30-days', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/update-tos/',
  '/audit/',
  '/documents/'
];

const requiredPhrases = [
  'Первые 30 дней председателя ТОС — чек-лист и порядок работы',
  'Первые 30 дней председателя ТОС',
  'Цель первого месяца — не сделать всё сразу, а навести порядок',
  'План на 4 недели',
  'Рабочая схема без лишней бюрократии',
  'Проверить основу',
  'Собрать проблемы',
  'Создать архив',
  'Выбрать 1–2 проекта',
  'Опубликовать первую новость',
  'Назначить следующий шаг',
  'Минимальный чек-лист первого месяца',
  'Данные ТОС',
  'Люди и связь',
  'Проблемы и идеи',
  'Публичность',
  'Главное правило:',
  'председателю не нужно пытаться решить всё одному'
];

const requiredChecklistItems = [
  'Проверить название, границы и населённый пункт.',
  'Проверить ФИО председателя и контакты.',
  'Добавить соцсети и email, если есть.',
  'Обновить описание территории.',
  'Собрать список активистов.',
  'Определить основной канал связи.',
  'Собрать 10–20 проблем территории.',
  'Сделать фото ключевых мест.',
  'Прислать новость о работе ТОС.',
  'Добавить хотя бы одну потребность.',
  'Подготовить первую историю результата.'
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

  checkContains(errors, html, 'chairperson/first-30-days/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', '<title>Первые 30 дней председателя ТОС — чек-лист и порядок работы</title>');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', 'https://tosborisoglebsk.ru/chairperson/first-30-days/');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/first-30-days/"');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/first-30-days/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/first-30-days/index.html', phrase);
  });

  requiredChecklistItems.forEach((item) => {
    checkContains(errors, html, 'chairperson/first-30-days/index.html', item);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/first-30-days/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/first-30-days/index.html: missing linked local page ${link}`);
    }
  });

  ['type=card#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`chairperson/first-30-days/index.html: missing ${route}`);
    }
  });

  ['1 неделя', '2 неделя', '3 неделя', '4 неделя', 'Публичность', 'Контроль'].forEach((step) => {
    if (!html.includes(`>${step}<`)) {
      errors.push(`chairperson/first-30-days/index.html: missing plan step ${step}`);
    }
  });

  if (!html.includes('У каждой задачи должен быть ответственный, срок, статус и место')) {
    errors.push('chairperson/first-30-days/index.html: missing task ownership rule');
  }

  if (errors.length) {
    throw new Error(`Chairperson first 30 days content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson first 30 days content OK');
}

main();