const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'done', 'action-routes', 'index.html');

const requiredInternalLinks = [
  '/done/',
  '/update-tos/',
  '/communication-kit/',
  '/needs/action-routes/',
  '/field-checklist/',
  '/projects/action-routes/',
  '/partners/action-routes/',
  '/chairperson/documents/',
  '/documents/',
  '/needs/'
];

const requiredPhrases = [
  'Маршрут результата ТОС — как показать сделанное дело',
  'Как показать результат ТОС так, чтобы он работал дальше',
  'История результата нужна не только для отчёта',
  'Главный принцип',
  'какая была задача, что сделали, кто помог, что изменилось и что можно повторить',
  'Маршрут результата',
  'Описать исходную проблему',
  'Зафиксировать действия',
  'Назвать людей и команды',
  'Показать изменение',
  'Понять, что ещё нужно',
  'Сохранить опыт',
  'Минимальный фотоотчёт',
  'Проблема',
  'Работа',
  'Итог',
  'Участники',
  'Крупный план',
  'Где это',
  'Шаблон истории результата',
  'Начните с фото до и после'
];

const requiredTemplateFields = [
  'ТОС:',
  'Название истории:',
  'Место:',
  'Год / дата:',
  'Что было до:',
  'Что сделали:',
  'Кто участвовал:',
  'Кто помог:',
  'Что получилось:',
  'Фото до:',
  'Фото процесса:',
  'Фото после:',
  'Кого можно публично поблагодарить:',
  'Что ещё нужно дальше:',
  'Контакт для уточнения:'
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

  checkContains(errors, html, 'done/action-routes/index.html', '<html lang="ru"');
  checkContains(errors, html, 'done/action-routes/index.html', '<title>Маршрут результата ТОС — как показать сделанное дело</title>');
  checkContains(errors, html, 'done/action-routes/index.html', 'https://tosborisoglebsk.ru/done/action-routes/');
  checkContains(errors, html, 'done/action-routes/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/done/action-routes/"');
  checkContains(errors, html, 'done/action-routes/index.html', '<main id="main">');
  checkContains(errors, html, 'done/action-routes/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'done/action-routes/index.html', phrase);
  });

  requiredTemplateFields.forEach((field) => {
    checkContains(errors, html, 'done/action-routes/index.html', field);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'done/action-routes/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`done/action-routes/index.html: missing linked local page ${link}`);
    }
  });

  ['type=photo#message-builder', 'type=news#message-builder', 'type=need#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`done/action-routes/index.html: missing ${route}`);
    }
  });

  if (!html.includes('До') || !html.includes('Процесс') || !html.includes('После')) {
    errors.push('done/action-routes/index.html: missing before-process-after photo structure');
  }

  if (!html.includes('Фото до/после, дата, место, смета, участники, партнёры')) {
    errors.push('done/action-routes/index.html: missing archive guidance');
  }

  if (errors.length) {
    throw new Error(`Done action routes content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Done action routes content OK');
}

main();