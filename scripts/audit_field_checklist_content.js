const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'field-checklist', 'index.html');

const requiredInternalLinks = [
  '/reply-review/',
  '/data-requests/',
  '/collection-board/',
  '/workbench/',
  '/update-tos/?type=card#message-builder',
  '/data-quality/'
];

const requiredPhrases = [
  'Чек-лист проверки карточки ТОС БГО',
  'Печатный чек-лист для проверки карточки ТОС БГО',
  'Проверка на месте',
  'Чек-лист проверки карточки ТОС',
  'Короткий список для председателя, актива или редактора портала',
  'Распечатать',
  'Разбор ответа',
  'Запросы данных',
  'Доска сбора',
  'Рабочая панель',
  'Обновить карточку',
  'Название ТОС',
  'Кто проверил',
  'Дата проверки',
  'Источник сведений',
  'председатель / актив / открытая публикация / анкета / другое',
  '1. Основные сведения',
  'Название ТОС написано правильно',
  'Тип территории указан верно',
  'Населённый пункт указан верно',
  'Границы территории описаны понятно',
  'Год создания указан или подтверждено, что он неизвестен',
  'Примерная численность жителей указана или требует уточнения',
  '2. Контакты',
  'ФИО председателя актуально',
  'Телефон можно публиковать открыто',
  'Если телефон нельзя публиковать, это зафиксировано',
  'Email указан при наличии',
  'Ссылка на группу, страницу или чат указана при наличии',
  '3. Визуальные материалы',
  'Есть логотип ТОС',
  'Есть 3–5 фото территории',
  'Есть фото мероприятий или результатов',
  'Фото можно публиковать открыто',
  'Подписано, где и когда сделаны фото',
  '4. Содержание карточки',
  'Есть краткое описание деятельности',
  'Есть хотя бы одна новость',
  'Есть хотя бы одна история результата',
  'Есть актуальная потребность',
  'Есть проектная идея или план',
  'Что не собирать для открытой публикации',
  'паспортные данные',
  'адреса проживания',
  'банковские реквизиты и внутренние финансовые документы',
  'личные телефоны без согласия на публикацию',
  'фото людей крупным планом без понимания, что их можно размещать',
  'сведения, которые могут навредить человеку или вызвать спор без проверки фактов',
  'После проверки',
  'Зафиксируйте отправку, ответ и оставшиеся вопросы на доске сбора',
  'отделите сведения для открытой публикации от того, что требует уточнения или не должно публиковаться',
  'внесите только подтверждённые сведения',
  'лучше написать «требует проверки», чем публиковать сомнительную информацию'
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

function localPathFor(link) {
  return link.split('?')[0].split('#')[0];
}

function main() {
  const html = read(htmlPath);
  const errors = [];

  checkContains(errors, html, 'field-checklist/index.html', '<html lang="ru"');
  checkContains(errors, html, 'field-checklist/index.html', '<title>Чек-лист проверки карточки ТОС БГО</title>');
  checkContains(errors, html, 'field-checklist/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/field-checklist/"');
  checkContains(errors, html, 'field-checklist/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/field-checklist/"');
  checkContains(errors, html, 'field-checklist/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'field-checklist/index.html', '<main id="main">');
  checkContains(errors, html, 'field-checklist/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'field-checklist/index.html', 'onclick="window.print()"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'field-checklist/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'field-checklist/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`field-checklist/index.html: missing linked local page ${localPath}`);
    }
  });

  ['1. Основные сведения', '2. Контакты', '3. Визуальные материалы', '4. Содержание карточки'].forEach((sectionName) => {
    if (!html.includes(`<h3>${sectionName}</h3>`)) {
      errors.push(`field-checklist/index.html: missing checklist section ${sectionName}`);
    }
  });

  const checkboxCount = (html.match(/☐/g) || []).length;
  if (checkboxCount < 20) {
    errors.push(`field-checklist/index.html: expected at least 20 checklist marks, found ${checkboxCount}`);
  }

  ['паспортные данные', 'адреса проживания', 'банковские реквизиты', 'личные телефоны без согласия'].forEach((restrictedItem) => {
    if (!html.includes(restrictedItem)) {
      errors.push(`field-checklist/index.html: missing restricted publication item ${restrictedItem}`);
    }
  });

  if (errors.length) {
    throw new Error(`Field checklist content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Field checklist content OK');
}

main();