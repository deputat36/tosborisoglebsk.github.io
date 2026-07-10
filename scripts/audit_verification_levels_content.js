const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'verification-levels', 'index.html');

const requiredLinks = [
  '/verification-guide/',
  '/chairperson/verify-card/',
  '/data-quality/',
  '/sources/',
  '/update-tos/?type=card#message-builder',
  '/field-checklist/'
];

const forbiddenInternalLinks = [
  '/workbench/',
  '/verification-tasks/',
  '/verification-control/'
];

const requiredPhrases = [
  'Статусы проверки данных ТОС БГО',
  'Доверие к данным',
  'Статусы проверки данных ТОС',
  'Зачем нужны статусы',
  'Открытый справочник должен быть честным',
  'Что нужно для повышения статуса',
  'Безопасная позиция портала',
  'Роль страницы:',
  'публичное объяснение уровней достоверности',
  'не является рабочим журналом'
];

const requiredStatuses = [
  'Подтверждено',
  'Частично подтверждено',
  'Требует проверки',
  'Уточняется',
  'Устарело'
];

const requiredUpgradeConditions = [
  'Источник',
  'Дата',
  'Публичность',
  'Полнота'
];

const requiredSafetyRules = [
  'Не выдумывать недостающие контакты',
  'Не публиковать личные данные',
  'Сомнительные сведения отмечать как требующие проверки',
  'Сохранять ссылку на источник или дату проверки',
  'Исправлять карточки по обращениям'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, html, needle) {
  if (!html.includes(needle)) errors.push(`missing ${needle}`);
}

function localPathFor(link) {
  return link.split('?')[0].split('#')[0];
}

function main() {
  const html = read(htmlPath);
  const errors = [];

  checkContains(errors, html, '<html lang="ru"');
  checkContains(errors, html, '<title>Статусы проверки данных ТОС БГО</title>');
  checkContains(errors, html, 'https://tosborisoglebsk.ru/verification-levels/');
  checkContains(errors, html, '<main id="main">');
  checkContains(errors, html, '/assets/js/site.js');

  requiredPhrases.forEach((item) => checkContains(errors, html, item));
  requiredStatuses.forEach((item) => checkContains(errors, html, item));
  requiredUpgradeConditions.forEach((item) => checkContains(errors, html, item));
  requiredSafetyRules.forEach((item) => checkContains(errors, html, item));

  requiredLinks.forEach((link) => {
    checkContains(errors, html, `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) errors.push(`missing linked page ${localPath}`);
  });

  forbiddenInternalLinks.forEach((link) => {
    if (html.includes(`href="${link}`)) errors.push(`public verification levels page must not link to internal route ${link}`);
  });

  if (!html.includes('нельзя использовать как окончательно подтверждённые')) {
    errors.push('missing warning about non-final data');
  }

  if (errors.length) {
    throw new Error(`Verification levels content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Verification levels content OK');
}

main();
