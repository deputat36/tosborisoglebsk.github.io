const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'chairperson', 'index.html');
const quickStartPatchPath = path.join(process.cwd(), 'scripts', 'patch_residents_quick_start.js');

const requiredInternalLinks = [
  '/chairperson/action-routes/',
  '/chairperson/first-30-days/',
  '/chairperson/verify-card/',
  '/update-tos/',
  '/documents/',
  '/communication-kit/',
  '/chairperson/meeting/',
  '/chairperson/project/',
  '/chairperson/news/',
  '/chairperson/documents/',
  '/chairperson/conflicts/',
  '/legal/',
  '/tos/',
  '/residents/',
  '/needs/',
  '/done/',
  '/grants/',
  '/partners/',
  '/contacts/'
];

const requiredPhrases = [
  'Председателю ТОС — практический кабинет, чек-листы и документы',
  'Рабочий кабинет председателя и актива ТОС',
  'Практический навигатор',
  'раздел не заменяет официальные правовые акты и юридическую консультацию',
  'Практические инструкции председателю',
  '6 рабочих действий председателя ТОС',
  'Первые 30 дней председателя ТОС',
  'Как подтвердить карточку ТОС',
  'Собрание или конференция ТОС',
  'Как подготовить проект ТОС',
  'Как оформить новость или фотоотчёт',
  'Что хранить в архиве ТОС',
  'Как работать с конфликтами',
  'Правовая основа простыми словами',
  'ТОС — это самоорганизация жителей',
  'Собрания, конференции и органы ТОС',
  'Регистрация устава учреждает ТОС',
  'Органы ТОС представляют жителей',
  'Фиксируйте вопросы письменно',
  'Следить за изменениями законодательства',
  'Коротко: что председатель делает постоянно',
  'Вести карточку ТОС',
  'Слышать территорию',
  'Показывать работу',
  'Готовить заявки заранее',
  'Формулировать помощь конкретно',
  'Сохранять доказательства',
  'Рабочий цикл председателя',
  'Данные → жители → решение → проект → публичность → архив',
  'Связь и отправка материалов'
];

const requiredQuickStartPhrases = [
  'chairperson-quick-start',
  'Председателю достаточно начать с трёх действий',
  'Проверьте карточку ТОС',
  'Соберите вопросы жителей',
  'Выберите рабочий маршрут',
  '/chairperson/verify-card/',
  '/chairperson/action-routes/',
  '/update-tos/?type=need#message-builder'
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
  const quickStartPatch = read(quickStartPatchPath);
  const errors = [];

  checkContains(errors, html, 'chairperson/index.html', '<html lang="ru"');
  checkContains(errors, html, 'chairperson/index.html', '<title>Председателю ТОС — практический кабинет, чек-листы и документы</title>');
  checkContains(errors, html, 'chairperson/index.html', 'https://tosborisoglebsk.ru/chairperson/');
  checkContains(errors, html, 'chairperson/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/chairperson/"');
  checkContains(errors, html, 'chairperson/index.html', '<main id="main">');
  checkContains(errors, html, 'chairperson/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'chairperson/index.html', phrase);
  });

  requiredQuickStartPhrases.forEach((phrase) => {
    checkContains(errors, quickStartPatch, 'patch_residents_quick_start.js', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'chairperson/index.html', `href="${link}`);
    if (!repoPathExists(link)) {
      errors.push(`chairperson/index.html: missing linked local page ${link}`);
    }
  });

  ['type=card#message-builder', 'type=need#message-builder'].forEach((route) => {
    if (!html.includes(route)) {
      errors.push(`chairperson/index.html: missing ${route}`);
    }
  });

  ['маршрут действий', 'чек-листы', 'собрания', 'проекты', 'архив', 'публичность'].forEach((tag) => {
    if (!html.includes(`>${tag}<`)) {
      errors.push(`chairperson/index.html: missing hero tag ${tag}`);
    }
  });

  ['Данные', 'Жители', 'Решение', 'Проект', 'Публичность', 'Архив'].forEach((step) => {
    if (!html.includes(`>${step}<`)) {
      errors.push(`chairperson/index.html: missing working-cycle step ${step}`);
    }
  });

  if (!html.includes('https://vk.ru/tosbgo')) {
    errors.push('chairperson/index.html: missing VK community link');
  }

  if (!html.includes('Федеральное регулирование местного самоуправления обновилось в 2025 году')) {
    errors.push('chairperson/index.html: missing legal transition warning');
  }

  if (errors.length) {
    throw new Error(`Chairperson page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Chairperson page content OK');
}

main();
