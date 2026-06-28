const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'outreach-register', 'index.html');

const requiredInternalLinks = [
  '/data/outreach_register.csv',
  '/collection-board/',
  '/reply-review/',
  '/data-requests/'
];

const requiredPhrases = [
  'Журнал исходящих запросов ТОС БГО',
  'Единый журнал запросов с контролем статусов, сроков и целостности данных',
  'Что подготовлено, отправлено, решено найденным источником или ожидает ответа',
  'Контроль обращений',
  'Журнал исходящих запросов',
  'Панель показывает запросы, сроки и ошибки данных',
  'Задача может быть закрыта найденным официальным источником без имитации исходящего обращения',
  'Открыть CSV',
  'Доска сбора',
  'Разбор ответа',
  'Все запросы',
  'загрузка журнала',
  'Задачи обращения',
  'Фильтры применяются к единому CSV',
  'Все',
  'Активные',
  'Просрочен повтор',
  'Ошибки данных',
  'Решено без обращения',
  'Реестр',
  'Карточки',
  'Кандидаты',
  'Проекты',
  'Ответы',
  'Статусы и проверка',
  'draft',
  'обращение подготовлено, но не отправлено',
  'sent',
  'waiting',
  'follow_up',
  'received',
  'closed',
  'требуют реального канала и даты отправки',
  'resolved',
  'задача решена найденным официальным источником без обращения; обязательны дата и ссылка на источник',
  'waiting',
  'follow_up',
  'требуют даты повторного контакта',
  'received',
  'closed',
  'требуют даты и источника ответа',
  'Страница только читает CSV и показывает противоречия',
  'Она не меняет статусы автоматически',
  'Рабочий журнал исходящих запросов'
];

const requiredFilters = [
  'all',
  'active',
  'overdue',
  'invalid',
  'resolved',
  'registry',
  'priority_card',
  'candidate_registry',
  'project_result',
  'received'
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

  checkContains(errors, html, 'outreach-register/index.html', '<html lang="ru"');
  checkContains(errors, html, 'outreach-register/index.html', '<title>Журнал исходящих запросов ТОС БГО</title>');
  checkContains(errors, html, 'outreach-register/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'outreach-register/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/outreach-register/"');
  checkContains(errors, html, 'outreach-register/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/outreach-register/"');
  checkContains(errors, html, 'outreach-register/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'outreach-register/index.html', '<main id="main">');
  checkContains(errors, html, 'outreach-register/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'outreach-register/index.html', '/assets/js/outreach-register.js');
  checkContains(errors, html, 'outreach-register/index.html', 'id="outreach-stats"');
  checkContains(errors, html, 'outreach-register/index.html', 'id="outreach-list"');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'outreach-register/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'outreach-register/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`outreach-register/index.html: missing linked local page ${localPath}`);
    }
  });

  requiredFilters.forEach((filter) => {
    checkContains(errors, html, 'outreach-register/index.html', `data-outreach-filter="${filter}"`);
  });

  ['draft', 'sent', 'waiting', 'follow_up', 'received', 'closed', 'resolved'].forEach((status) => {
    if (!html.includes(`<code>${status}</code>`)) {
      errors.push(`outreach-register/index.html: missing status ${status}`);
    }
  });

  if (!repoPathExists('/assets/js/outreach-register.js')) {
    errors.push('outreach-register/index.html: missing script /assets/js/outreach-register.js');
  }

  if (errors.length) {
    throw new Error(`Outreach register content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Outreach register content OK');
}

main();