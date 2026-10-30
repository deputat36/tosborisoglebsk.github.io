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
  'Сверка каталога ТОС БГО',
  '24 карточки на сайте',
  'историческая оценка 46 ТОС на 3 июня 2024 года',
  'Качество данных',
  'На портале опубликованы 24 карточки',
  'Число ТОС на 2026 год пока не подтверждено',
  'разница служит ориентиром для сверки',
  'Открыть каталог',
  'Запросить актуальный реестр',
  'Проверить кандидатов',
  'Сверить город/село',
  'Черновик новой карточки',
  'ТОС БГО в цифрах',
  'JSON проверки',
  'CSV кандидатов',
  'Прислать уточнение',
  '46',
  'историческая оценка на 03.06.2024',
  '24',
  'карточки сейчас на сайте',
  '22',
  'условная разница с оценкой 2024 года',
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
  'Первый практический шаг — запросить официальный актуальный реестр ТОС БГО',
  'только после подтверждения создавать новые карточки',
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
