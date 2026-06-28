const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'news', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/contacts/',
  '/done/',
  '/update-tos/'
];

const requiredPhrases = [
  'Новость ТОС — как оформить публикацию и фотоотчёт',
  'Новость ТОС — как оформить публикацию',
  'Как оформить новость или фотоотчёт ТОС',
  'Хорошая новость показывает не только событие, но и пользу для жителей',
  'Публичность ТОС',
  'Прислать новость',
  'Истории результата',
  'Шаблоны',
  'Шаблон новости',
  'ТОС:',
  'Дата и место:',
  'Что произошло:',
  'Кто участвовал:',
  'Что сделали:',
  'Что изменилось для жителей:',
  'Кого поблагодарить:',
  'Нужна ли помощь:',
  'Фото / видео / ссылка:',
  'Какие фото нужны',
  'Общий план места',
  'Люди в работе или на событии',
  'Детали результата',
  'Фото до и после, если есть изменения территории',
  'Фото без лишних персональных данных и спорных ситуаций',
  'Первый абзац',
  'Сразу напишите главное: где, когда, что сделали и почему это важно для жителей',
  'Участники',
  'Назовите ТОС, активистов, жителей, партнёров, организации и тех, кого нужно поблагодарить',
  'Что изменилось',
  'Покажите конкретный итог: убрали мусор, высадили цветы, провели праздник, подготовили проект, закрыли потребность',
  'не ждите большого проекта',
  'Даже короткая новость о встрече, уборке, подготовке документов или сборе идей показывает, что ТОС живой'
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

  checkContains(errors, html, 'chairperson/news/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/news/index.html', '<title>Новость ТОС — как оформить публикацию и фотоотчёт</title>');
  checkContains(errors, html, 'chairperson/news/index.html', 'https://tosborisoglebsk.ru/chairperson/news/');
  checkContains(errors, html, 'chairperson/news/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/news/"');
  checkContains(errors, html, 'chairperson/news/index.html', '<meta property="og:type" content="article"');
  checkContains(errors, html, 'chairperson/news/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/news/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/news/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/news/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/news/index.html: missing linked local page ${link}`);
    }
  });

  ['Коротко', 'Люди', 'Результат'].forEach((tag) => {
    if (!html.includes(`>${tag}</span>`)) {
      errors.push(`chairperson/news/index.html: missing publication card tag ${tag}`);
    }
  });

  ['ТОС:', 'Дата и место:', 'Что произошло:', 'Кто участвовал:', 'Что сделали:', 'Что изменилось для жителей:', 'Кого поблагодарить:', 'Нужна ли помощь:', 'Фото / видео / ссылка:'].forEach((field) => {
    if (!html.includes(field)) {
      errors.push(`chairperson/news/index.html: missing news template field ${field}`);
    }
  });

  if (errors.length) {
    throw new Error(`Chairperson news content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson news content OK');
}

main();