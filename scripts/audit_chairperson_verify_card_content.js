const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'verify-card', 'index.html');

const requiredInternalLinks = [
  '/chairperson/',
  '/update-tos/',
  '/field-checklist/',
  '/data-quality/',
  '/tos/',
  '/sources/'
];

const requiredPhrases = [
  'Как подтвердить карточку ТОС — памятка председателю',
  'Как подтвердить карточку ТОС на портале',
  'Короткая инструкция для председателя и актива',
  'Откройте свою карточку',
  'Пройдите чек-лист',
  'Отправьте уточнение одним сообщением',
  'Минимальный набор для подтверждения',
  'Паспорт ТОС',
  'Открытые контакты',
  'Содержание карточки',
  'Готовый текст для отправки',
  'Текст сообщения',
  'Можно публиковать',
  'Открытые данные',
  'Не публикуем автоматически',
  'Данные для редакции',
  'После проверки',
  'Что изменится на сайте'
];

const requiredStatusGuidance = [
  'проверено частично',
  'сведения подтверждены',
  'Редакция сверит источник',
  'открытость сведений',
  'статус «Сведения подтверждены»'
];

const requiredChecklistItems = [
  'точное название ТОС;',
  'тип: городской или сельский;',
  'населённый пункт или район;',
  'границы территории;',
  'год создания;',
  'примерная численность жителей.',
  'ФИО председателя;',
  'телефон, который можно публиковать;',
  'email, если можно публиковать;',
  'ссылка на группу, чат или страницу;',
  'удобный контакт для редакции, если он не должен публиковаться.',
  'краткое описание территории;',
  '3–5 фотографий, если есть;',
  'логотип или эмблема ТОС;',
  '2–3 выполненных дела;',
  '1–3 текущие потребности или проектные идеи.'
];

const requiredTemplateFields = [
  'Прошу проверить и обновить карточку ТОС',
  'Данные можно публиковать открыто.',
  'Название ТОС:',
  'Населённый пункт/территория:',
  'Границы:',
  'Год создания:',
  'Председатель:',
  'Публичный телефон:',
  'Email:',
  'Ссылка на группу/страницу:',
  'Краткое описание ТОС:',
  'Выполненные дела:',
  'Актуальные потребности:',
  'Проектные идеи:',
  'Фото/логотип готов(ы) передать отдельно.',
  'Контакт для уточнения редакцией:'
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

  checkContains(errors, html, 'chairperson/verify-card/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/verify-card/index.html', '<title>Как подтвердить карточку ТОС — памятка председателю</title>');
  checkContains(errors, html, 'chairperson/verify-card/index.html', 'https://tosborisoglebsk.ru/chairperson/verify-card/');
  checkContains(errors, html, 'chairperson/verify-card/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/verify-card/"');
  checkContains(errors, html, 'chairperson/verify-card/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/verify-card/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/verify-card/index.html', phrase);
  });

  requiredStatusGuidance.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/verify-card/index.html', phrase);
  });

  requiredChecklistItems.forEach((item) => {
    checkContains(errors, html, 'chairperson/verify-card/index.html', item);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'chairperson/verify-card/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/verify-card/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/verify-card/index.html: missing linked local page ${link}`);
    }
  });

  if (!html.includes('type=card#message-builder')) {
    errors.push('chairperson/verify-card/index.html: missing type=card#message-builder');
  }

  if (!html.includes('перевести из «проверено частично» в «сведения подтверждены»')) {
    errors.push('chairperson/verify-card/index.html: missing confirmed-status guidance');
  }

  if (!html.includes('персональные данные жителей и материалы, по которым нет согласия на публикацию')) {
    errors.push('chairperson/verify-card/index.html: missing personal-data warning');
  }

  if (errors.length) {
    throw new Error(`Chairperson verify card content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson verify card content OK');
}

main();
