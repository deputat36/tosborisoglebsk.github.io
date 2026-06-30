const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'registry-type-check', 'index.html');

const requiredInternalLinks = [
  '/data/tos_type_reconciliation.csv',
  '/candidate-check/',
  '/registry-check/',
  '/data-requests/tos-registry-request/',
  '/new-tos-card/',
  '/workbench/',
  '/data/tos_candidate_verification.csv',
  '/reply-review/'
];

const requiredPhrases = [
  'Сверка городских и сельских ТОС БГО',
  'Рабочая сверка городских и сельских ТОС Борисоглебского городского округа',
  '25 городских и 21 сельский',
  'Полнота реестра',
  'Сверка городских и сельских ТОС',
  'Открытая публикация от 3 июня 2024 года сообщает о 46 ТОС в БГО: 25 городских и 21 сельский',
  'В текущем каталоге портала есть 24 карточки: 8 городских и 16 сельских',
  'эта страница фиксирует разрыв и помогает не смешивать типы при пополнении каталога',
  'CSV сверки',
  'Проверка кандидатов',
  'Проверка полноты',
  'Запросить реестр',
  'Черновик новой карточки',
  'Рабочая панель',
  'Сводка разрыва',
  '25 / 8',
  'городских: цель / каталог',
  '17',
  'городских нужно подтвердить',
  '21 / 16',
  'сельских: цель / каталог',
  '5',
  'сельских нужно подтвердить',
  'эти разрывы рассчитаны от открытой публикации, а не от официального реестра',
  'После получения реестра цифры нужно пересчитать и заменить рабочий статус на подтверждённый',
  'Текущие городские карточки',
  '8 карточек в каталоге портала',
  'Восточный',
  'Дзержинского',
  'Знамение',
  'Победа',
  'Просторный',
  'Северный 39',
  'Уютный',
  'Чкаловец',
  'Текущие сельские карточки',
  '16 карточек в каталоге портала',
  'Богана',
  'Губари',
  'Ивановка',
  'Миролюбие',
  'Подстёпки',
  'Танцырей',
  'Кандидаты без подтверждённого типа',
  'Горелка',
  'Хоперский берег',
  'Тюковка',
  'Ручей',
  'Эти названия нельзя автоматически распределять в городские или сельские',
  'официальный реестр, документ администрации или ответ председателя/координатора',
  'Как сверять тип',
  'Не считать тип только по названию',
  'тип требует проверки',
  'Источник чисел:',
  'Страница предназначена для рабочей сверки до получения официального актуального реестра',
  'Рабочая сверка городских и сельских ТОС'
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

  checkContains(errors, html, 'registry-type-check/index.html', '<html lang="ru"');
  checkContains(errors, html, 'registry-type-check/index.html', '<title>Сверка городских и сельских ТОС БГО</title>');
  checkContains(errors, html, 'registry-type-check/index.html', '<meta name="robots" content="noindex,nofollow"');
  checkContains(errors, html, 'registry-type-check/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/registry-type-check/"');
  checkContains(errors, html, 'registry-type-check/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/registry-type-check/"');
  checkContains(errors, html, 'registry-type-check/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'registry-type-check/index.html', '<main id="main">');
  checkContains(errors, html, 'registry-type-check/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'registry-type-check/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'registry-type-check/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`registry-type-check/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Registry type check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Registry type check content OK');
}

main();
