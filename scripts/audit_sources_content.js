const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'sources', 'index.html');

const requiredInternalLinks = [
  '/update-tos/?type=card#message-builder',
  '/source-watch/',
  '/data/source_watchlist.csv',
  '/verification-guide/',
  '/open-data/',
  '/content-intake/',
  '/verification-tasks/',
  '/publication-queue/',
  '/publication-consent/',
  '/data-quality/'
];

const requiredPhrases = [
  'Источники данных портала ТОС БГО',
  'Как формируются карточки ТОС, новости, проекты, потребности и справочные страницы портала ТОС Борисоглебского городского округа',
  'Прозрачность данных',
  'откуда берутся сведения для карточек ТОС, как они проверяются и как можно сообщить об ошибке',
  'Сообщить исправление',
  'Мониторинг источников',
  'Реестр CSV',
  'Порядок проверки',
  'Открытые данные',
  'Основные источники',
  'данные, переданные председателями и уполномоченными представителями ТОС',
  'официальные муниципальные и региональные документы',
  'материалы Ассоциации «Совет муниципальных образований Воронежской области»',
  'региональные и местные публикации о проектах, конкурсах и мероприятиях',
  'входящие материалы портала, прошедшие проверку источника и разрешений',
  'автоматические аудиты файлов сайта',
  'Иерархия доверия',
  'Официальный документ и прямое подтверждение уполномоченного представителя используются как первичные источники',
  'СМИ и социальные сети помогают найти событие или первоисточник, но сами по себе не подтверждают актуального председателя, границы, контакты или официальный статус ТОС',
  'Рабочий список каналов, частота проверки и ограничения использования',
  'Что считается подтверждённым',
  'дата проверки, понятный источник, ссылка или сохранённое подтверждение',
  'разрешение на открытое размещение персональных данных и медиа',
  'Как фиксировать источник после ответа',
  'Записать источник',
  'Разделить публичное и непубличное',
  'Собрать черновик',
  'Проверить перед публикацией',
  'Провести через очередь',
  'Обновить статус карточки',
  'Статус ready устанавливать только после закрытия обязательных проверок',
  'Переводить карточку в verified только по полной матрице готовности',
  'Что требует осторожности',
  'Телефоны, email, личные ссылки, фотографии людей, данные о детях, финансовые документы и внутренние материалы',
  'Полезные страницы проверки',
  'Задачи проверки',
  'Очередь публикаций',
  'Разрешения на публикацию',
  'Качество данных каталога',
  'Как исправить ошибку',
  'Укажите название ТОС, ошибочное поле, актуальный вариант, дату и источник подтверждения',
  'Рабочая запись не означает, что сведения подтверждены или готовы к публикации'
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

  checkContains(errors, html, 'sources/index.html', '<html lang="ru"');
  checkContains(errors, html, 'sources/index.html', '<title>Источники данных портала ТОС БГО</title>');
  checkContains(errors, html, 'sources/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/sources/"');
  checkContains(errors, html, 'sources/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/sources/"');
  checkContains(errors, html, 'sources/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'sources/index.html', '<main id="main">');
  checkContains(errors, html, 'sources/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'sources/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'sources/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`sources/index.html: missing linked local page ${localPath}`);
    }
  });

  ['ready', 'verified'].forEach((status) => {
    if (!html.includes(`<code>${status}</code>`)) {
      errors.push(`sources/index.html: missing workflow status ${status}`);
    }
  });

  ['Записать источник', 'Разделить публичное и непубличное', 'Собрать черновик', 'Проверить перед публикацией', 'Провести через очередь', 'Обновить статус карточки'].forEach((step) => {
    if (!html.includes(`<strong>${step}.</strong>`)) {
      errors.push(`sources/index.html: missing source handling step ${step}`);
    }
  });

  if (errors.length) {
    throw new Error(`Sources content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Sources content OK');
}

main();