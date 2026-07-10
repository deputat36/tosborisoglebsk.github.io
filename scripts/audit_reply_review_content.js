const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'reply-review', 'index.html');
const csvPath = path.join(process.cwd(), 'data', 'reply_review_checklist.csv');

const requiredInternalLinks = [
  '/data/reply_review_checklist.csv',
  '/data-requests/',
  '/collection-board/',
  '/update-tos/?type=card#message-builder',
  '/privacy/',
  '/workbench/',
  '/verification-control/',
  '/verification-levels/',
  '/verification-guide/'
];

const requiredPhrases = [
  'Разбор ответа по карточке ТОС',
  'Внутренняя рабочая инструкция для разбора ответа председателя или актива ТОС перед безопасным обновлением карточки',
  'Для редактора — этап 2 из 3',
  'Разбор полученного ответа',
  'Когда председатель, активист или житель прислал сведения, их нельзя сразу переносить на сайт',
  'сохранить источник, отделить открытые данные от непубличных и понять, что ещё требуется уточнить',
  'Предыдущий этап: запросы',
  'Следующий этап: обновление',
  'Вернуться в рабочую панель',
  'Эта страница не является публичной формой передачи сведений',
  'Быстрый порядок разбора',
  'Сохранить исходный ответ: кто прислал, когда, через какой канал',
  'Выписать все полученные сведения по полям: телефон, email, группа, фото, логотип, границы, проекты',
  'Напротив каждого поля отметить: можно публиковать, нельзя публиковать, нужно уточнить',
  'Проверить, есть ли источник подтверждения и дата',
  'Подготовить обновление только по тем сведениям, которые можно размещать открыто',
  'Непубличные контакты оставить в рабочей заметке, но не переносить в карточку',
  'если есть сомнение, поле не публикуется',
  'Таблица решения',
  'Проверяйте каждое полученное поле отдельно',
  'Можно публиковать',
  'Нельзя публиковать',
  'Нужно уточнить',
  'Телефон',
  'Email',
  'ФИО председателя',
  'Фото',
  'Проекты и суммы',
  'Что можно перенести в карточку',
  'Что оставить в черновике',
  'Если нужно уточнить повторно',
  'Перед публикацией хотим уточнить несколько моментов',
  'Какие контакты можно разместить открыто на сайте',
  'Можно ли публиковать присланные фото',
  'Кто подтверждает актуальность данных и на какую дату',
  'Есть ли сведения, которые нужно оставить только для внутренней связи и не размещать публично',
  'Итоговый статус после разбора',
  'Требует проверки',
  'Проверено частично',
  'Подтверждено'
];

const requiredCsvColumns = [
  'field',
  'value_received',
  'can_publish',
  'needs_followup',
  'source_confirmed',
  'action',
  'notes'
];

const requiredCsvRows = [
  'Название ТОС',
  'Территория и границы',
  'Председатель',
  'Публичный телефон',
  'Email',
  'Сообщество ВК/ОК',
  'Фото территории',
  'Проекты и результаты',
  'Источник подтверждения'
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
  const csv = read(csvPath);
  const errors = [];

  checkContains(errors, html, 'reply-review/index.html', '<html lang="ru"');
  checkContains(errors, html, 'reply-review/index.html', '<title>Разбор ответа по карточке ТОС</title>');
  checkContains(errors, html, 'reply-review/index.html', '<meta name="robots" content="noindex,nofollow"');
  checkContains(errors, html, 'reply-review/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/reply-review/"');
  checkContains(errors, html, 'reply-review/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/reply-review/"');
  checkContains(errors, html, 'reply-review/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'reply-review/index.html', '<main id="main">');
  checkContains(errors, html, 'reply-review/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'reply-review/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'reply-review/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`reply-review/index.html: missing linked local page ${localPath}`);
    }
  });

  requiredCsvColumns.forEach((column) => {
    checkContains(errors, csv, 'data/reply_review_checklist.csv', column);
  });

  requiredCsvRows.forEach((row) => {
    checkContains(errors, csv, 'data/reply_review_checklist.csv', row);
  });

  ['Телефон', 'Email', 'ФИО председателя', 'Фото', 'Проекты и суммы'].forEach((field) => {
    if (!html.includes(`<td>${field}</td>`)) {
      errors.push(`reply-review/index.html: missing decision-table field ${field}`);
    }
  });

  ['можно публиковать', 'нельзя публиковать', 'нужно уточнить'].forEach((decision) => {
    if (!html.toLowerCase().includes(decision)) {
      errors.push(`reply-review/index.html: missing decision state ${decision}`);
    }
  });

  ['Требует проверки', 'Проверено частично', 'Подтверждено'].forEach((status) => {
    if (!html.includes(`<b>${status}:</b>`)) {
      errors.push(`reply-review/index.html: missing final status ${status}`);
    }
  });

  if (html.includes('href="/data-requests/"') && !html.includes('Предыдущий этап: запросы')) {
    errors.push('reply-review/index.html: data requests link must be labeled as previous workflow stage');
  }

  if (errors.length) {
    throw new Error(`Reply review content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Reply review content OK: internal workflow role and decision checklist protected');
}

main();
