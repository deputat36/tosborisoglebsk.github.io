const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/chairperson/verify-card/',
  '/update-tos/',
  '/documents/',
  '/communication-kit/',
  '/check-tos/',
  '/residents/',
  '/needs/',
  '/chairperson/meeting/',
  '/chairperson/project/',
  '/projects/',
  '/chairperson/news/',
  '/partners/',
  '/grants/',
  '/chairperson/first-30-days/',
  '/data-requests/',
  '/tos/',
  '/contacts/'
];

const requiredPhrases = [
  'Маршрут председателя ТОС — 6 рабочих действий',
  '6 рабочих действий председателя ТОС',
  'сначала подтвердить основу, затем услышать жителей, оформить решение, подготовить проект, показать результат и найти поддержку',
  'Как пользоваться:',
  'Быстрый выбор задачи',
  'Подтвердить карточку ТОС',
  'Собрать вопросы территории',
  'Провести собрание или обсуждение',
  'Оформить идею в проект',
  'Показать работу и результат',
  'Найти помощь и партнёров',
  'Рабочий цикл без лишней бюрократии',
  'Зафиксировать проблему',
  'Понять поддержку',
  'Выбрать формат',
  'Оценить, что нужно',
  'Сделать и показать',
  'Сохранить след',
  'Минимальный еженедельный ритм председателя',
  'Понедельник:',
  'Вторник:',
  'Среда:',
  'Четверг:',
  'Пятница:',
  'Сообщение жителям',
  'Сообщение активу',
  'Сообщение партнёру',
  'С чего начать прямо сейчас'
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

  checkContains(errors, html, 'chairperson/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/action-routes/index.html', '<title>Маршрут председателя ТОС — 6 рабочих действий</title>');
  checkContains(errors, html, 'chairperson/action-routes/index.html', 'https://tosborisoglebsk.ru/chairperson/action-routes/');
  checkContains(errors, html, 'chairperson/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/action-routes/"');
  checkContains(errors, html, 'chairperson/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/action-routes/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/action-routes/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=card#message-builder', 'type=need#message-builder', 'type=event#message-builder', 'type=project#message-builder', 'type=news#message-builder', 'type=photo#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`chairperson/action-routes/index.html: missing ${route}`);
    }
  });

  ['данные', 'жители', 'собрание', 'проект', 'публичность', 'партнёры'].forEach((tag) => {
    if (!html.includes(`>${tag}<`)) {
      errors.push(`chairperson/action-routes/index.html: missing hero tag ${tag}`);
    }
  });

  if (!html.includes('лучше регулярно фиксировать маленькие шаги, чем ждать большого проекта')) {
    errors.push('chairperson/action-routes/index.html: missing weekly rhythm principle');
  }

  if (!html.includes('Самый полезный первый шаг — подтвердить карточку своего ТОС')) {
    errors.push('chairperson/action-routes/index.html: missing first-step guidance');
  }

  if (errors.length) {
    throw new Error(`Chairperson action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson action routes content OK');
}

main();