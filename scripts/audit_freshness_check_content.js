const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'freshness-check', 'index.html');

const requiredInternalLinks = [
  '/data/content_freshness_check.csv',
  '/editorial-calendar/',
  '/open-data/',
  '/post-publish-check/',
  '/registry-intake/',
  '/media-intake/',
  '/verification-readiness/'
];

const requiredPhrases = [
  'Контроль свежести контента',
  'Рабочая проверка актуальности разделов портала ТОС БГО: каталог, новости, проекты, потребности, медиа, реестр и открытые данные',
  'Актуальность',
  'Эта проверка показывает, какие разделы сайта требуют регулярного обновления, где нужен официальный источник, а где публикация заблокирована до подтверждения',
  'Скачать CSV',
  'Редакционный календарь',
  'Открытые данные',
  'QA публикации',
  'Зачем это нужно',
  'Даже технически исправная страница теряет доверие, если данные устарели или не имеют источника',
  'Контроль свежести отделяет разделы, которые можно обновлять сейчас, от разделов, где нужен реестр, ответ председателя или разрешение на публикацию',
  'Если источник не указан или дата актуальности неизвестна, материал нельзя подавать как подтверждённый факт',
  'Высокий риск',
  'Каталог, статус `verified`, потребности, медиа и официальный реестр',
  'Эти разделы нельзя обновлять предположениями',
  'Средний риск',
  'Новости, проекты, истории сделанного, домен и открытые данные',
  'Нужны источник, дата и QA после публикации',
  'Частота',
  'Новости проверяются еженедельно, карточки и медиа ежемесячно, реестр после получения официального файла',
  'Результат',
  'Статусы `pending`, `needs_review`, `needs_update`, `blocked` и `missing` помогают быстро увидеть следующий шаг',
  'Связанные инструменты',
  'редакционным календарём',
  'приёмом реестра',
  'медиа-реестром',
  'матрицей готовности',
  'QA после публикации',
  'Рабочая проверка свежести контента'
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

  checkContains(errors, html, 'freshness-check/index.html', '<html lang="ru"');
  checkContains(errors, html, 'freshness-check/index.html', '<title>Контроль свежести контента</title>');
  checkContains(errors, html, 'freshness-check/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'freshness-check/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/freshness-check/"');
  checkContains(errors, html, 'freshness-check/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/freshness-check/"');
  checkContains(errors, html, 'freshness-check/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'freshness-check/index.html', '<main id="main">');
  checkContains(errors, html, 'freshness-check/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'freshness-check/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'freshness-check/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`freshness-check/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Freshness check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Freshness check content OK');
}

main();
