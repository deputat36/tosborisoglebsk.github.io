const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'outreach-register', 'index.html');
const validationPath = path.join(process.cwd(), 'assets', 'js', 'outreach-validation.js');
const registerScriptPath = path.join(process.cwd(), 'assets', 'js', 'outreach-register.js');

const requiredInternalLinks = [
  '/data/outreach_register.csv',
  '/collection-board/',
  '/reply-review/',
  '/data-requests/'
];

const requiredPhrases = [
  'Журнал исходящих запросов ТОС БГО',
  'Единый журнал запросов с контролем готовности, статусов, сроков и целостности данных',
  'Что готово к отправке, где нужен канал, кто отвечает и когда делать повторный контакт',
  'Контроль обращений',
  'Журнал исходящих запросов',
  'Панель отделяет готовые к отправке запросы',
  'Статус не меняется без реального действия',
  'Открыть CSV',
  'Доска сбора',
  'Разбор ответа',
  'Все запросы',
  'загрузка журнала',
  'Очередь выполнения',
  'Готово к отправке',
  'Нужен канал или получатель',
  'Нужен ответственный',
  'Порядок выполнения одной отправки',
  'Указать фактического получателя или организацию и назначить ответственного',
  'Только после этого записать',
  'follow_up_date',
  'Запрещено:',
  'Статусы и проверка',
  'draft',
  'даты отправки, повтора и ответа должны быть пустыми',
  'sent',
  'waiting',
  'follow_up',
  'received',
  'closed',
  'требуют реального канала, фактического получателя, ответственного и даты отправки',
  'resolved',
  'дата отправки недопустима',
  'Страница только читает CSV, рассчитывает готовность и показывает противоречия',
  'Она не меняет статусы автоматически',
  'Рабочий журнал исходящих запросов'
];

const requiredFilters = [
  'all',
  'ready',
  'needs_channel',
  'needs_owner',
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
  const validation = read(validationPath);
  const registerScript = read(registerScriptPath);
  const errors = [];

  checkContains(errors, html, 'outreach-register/index.html', '<html lang="ru"');
  checkContains(errors, html, 'outreach-register/index.html', '<title>Журнал исходящих запросов ТОС БГО</title>');
  checkContains(errors, html, 'outreach-register/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'outreach-register/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/outreach-register/"');
  checkContains(errors, html, 'outreach-register/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/outreach-register/"');
  checkContains(errors, html, 'outreach-register/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'outreach-register/index.html', '<main id="main">');
  checkContains(errors, html, 'outreach-register/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'outreach-register/index.html', '/assets/js/outreach-validation.js');
  checkContains(errors, html, 'outreach-register/index.html', '/assets/js/outreach-register.js');
  checkContains(errors, html, 'outreach-register/index.html', 'id="outreach-stats"');
  checkContains(errors, html, 'outreach-register/index.html', 'id="outreach-list"');

  const validationIndex = html.indexOf('/assets/js/outreach-validation.js');
  const registerIndex = html.indexOf('/assets/js/outreach-register.js');
  if (validationIndex < 0 || registerIndex < 0 || validationIndex > registerIndex) {
    errors.push('outreach-register/index.html: outreach-validation.js must load before outreach-register.js');
  }

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

  for (const token of [
    "new Set(['sent', 'waiting', 'follow_up', 'received', 'closed'])",
    "new Set(['sent', 'waiting', 'follow_up'])",
    'для статуса нужен фактический получатель или организация',
    'для статуса нужен ответственный',
    'черновик не может иметь дату отправки',
    'resolved не может иметь дату отправки',
    'function readiness(item)',
    'function isOverdue(item'
  ]) {
    checkContains(errors, validation, 'assets/js/outreach-validation.js', token);
  }

  for (const token of [
    'window.OutreachValidation',
    "filter === 'ready'",
    "filter === 'needs_channel'",
    "filter === 'needs_owner'",
    'Готово к отправке',
    'получатель не указан',
    'не назначен'
  ]) {
    checkContains(errors, registerScript, 'assets/js/outreach-register.js', token);
  }

  if (errors.length) {
    throw new Error(`Outreach register content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Outreach register content OK: execution readiness and shared validation enabled');
}

main();
