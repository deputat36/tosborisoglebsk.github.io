const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'registry-check', 'index.html');

const requiredInternalLinks = [
  '/tos/',
  '/data-requests/tos-registry-request/',
  '/candidate-check/',
  '/registry-type-check/',
  '/new-tos-card/',
  '/materials/tos-bgo-in-numbers/',
  '/data/tos_registry_check.json',
  '/data/tos_registry_missing_candidates.csv',
  '/update-tos/',
  '/data-requests/',
  '/verification-tasks/',
  '/communication-kit/',
  '/data-quality/',
  '/site-health/'
];

const requiredPhrases = [
  'Проверка полноты каталога ТОС БГО',
  'Рабочая страница проверки полноты каталога ТОС Борисоглебского городского округа',
  '24 карточки на сайте',
  'публичная цифра 46 ТОС',
  'Качество данных',
  'На портале опубликованы 24 карточки',
  'действует 46 ТОС',
  'эта страница фиксирует разрыв',
  'Открыть каталог',
  'Запросить реестр 46 ТОС',
  'Проверить кандидатов',
  'Сверить город/село',
  'Черновик новой карточки',
  'ТОС БГО в цифрах',
  'JSON проверки',
  'CSV кандидатов',
  'Прислать уточнение',
  '46',
  'ТОС по открытой публикации',
  '24',
  'карточки сейчас на сайте',
  '22',
  'минимум нужно проверить и добавить',
  '4',
  'найденных кандидата на проверку',
  'Редакционный принцип:',
  'найденное название — ещё не готовая карточка',
  'Сначала нужно подтвердить территорию, председателя, статус регистрации и разрешённые к публикации контакты',
  'Кандидаты, которых пока нет в каталоге',
  'ТОС «Горелка»',
  'ТОС «Хоперский берег»',
  'ТОС «Тюковка»',
  'ТОС «Ручей»',
  'Требует подтверждения',
  'Нужна ручная проверка PDF',
  'Что проверять по каждому недостающему ТОС',
  'официальное название ТОС',
  'тип: городской или сельский',
  'границы ТОС',
  'публичные контакты с разрешением на публикацию',
  'источники подтверждения',
  'Что делать дальше',
  'Первый практический шаг — запросить официальный актуальный реестр 46 ТОС БГО',
  'опубликовать минимальную карточку с пометкой «требует проверки»',
  'Текущие 24 карточки на портале',
  'нет ни одной карточки со статусом полного подтверждения',
  '0 подтверждено',
  'Источники:',
  'Для окончательного пополнения каталога нужен официальный актуальный реестр или подтверждение от председателей/координаторов ТОС',
  'Рабочая страница проверки полноты каталога ТОС'
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

  checkContains(errors, html, 'registry-check/index.html', '<html lang="ru"');
  checkContains(errors, html, 'registry-check/index.html', '<title>Проверка полноты каталога ТОС БГО</title>');
  checkContains(errors, html, 'registry-check/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/registry-check/"');
  checkContains(errors, html, 'registry-check/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/registry-check/"');
  checkContains(errors, html, 'registry-check/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'registry-check/index.html', '<main id="main">');
  checkContains(errors, html, 'registry-check/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'registry-check/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'registry-check/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`registry-check/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Registry check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Registry check content OK');
}

main();
