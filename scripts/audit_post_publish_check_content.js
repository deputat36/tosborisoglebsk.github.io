const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'post-publish-check', 'index.html');

const requiredInternalLinks = [
  '/data/post_publish_qa_checklist.csv',
  '/open-data/',
  '/site-health/',
  '/publication-consent/',
  '/verification-readiness/',
  '/verification-evidence/',
  '/domain-check/'
];

const requiredPhrases = [
  'Проверка после публикации',
  'Чек-лист контроля после публикации новых страниц, карточек ТОС и открытых данных на портале ТОС БГО',
  'QA после публикации',
  'Чек-лист нужен после каждого изменения карточек, реестра, CSV/JSON-файлов или рабочих страниц',
  'Он отделяет факт публикации от факта готовности страницы к использованию',
  'Скачать CSV',
  'Открытые данные',
  'Здоровье сайта',
  'Разрешения',
  'Что проверять',
  'страница открывается',
  'внутренние ссылки работают',
  'CSV или JSON читается',
  'служебные страницы не индексируются',
  'метаданные соответствуют содержанию',
  'персональные данные не опубликованы без разрешения',
  'Статус `verified` нельзя ставить по факту публикации',
  'Его можно ставить только после закрытия условий в матрице готовности и журнале доказательств',
  '1. URL и ссылки',
  'Открыть новую страницу, проверить кнопки, ссылки на CSV/JSON и обратные переходы в рабочие разделы',
  '2. Данные',
  'Проверить структуру CSV/JSON: заголовки, кодировку, пустые строки, статус проверки и отсутствие неподтверждённых фактов',
  '3. Публикация',
  'Сверить контакты, фото, имена и проекты с разрешениями на открытую публикацию',
  '4. Домен',
  'После деплоя открыть основной домен и убедиться, что опубликована новая версия, а не старая кэшированная страница',
  'Результат проверки',
  'CSV можно вести как короткий журнал',
  'pending',
  'passed',
  'failed',
  'blocked',
  'Если пункт не пройден, публиковать ссылку на страницу в основных разделах сайта рано',
  'Связанные инструменты',
  'матрица готовности',
  'журнал доказательств',
  'разрешения на публикацию',
  'проверка домена',
  'QA-чек-лист публикации'
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

  checkContains(errors, html, 'post-publish-check/index.html', '<html lang="ru"');
  checkContains(errors, html, 'post-publish-check/index.html', '<title>Проверка после публикации</title>');
  checkContains(errors, html, 'post-publish-check/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'post-publish-check/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/post-publish-check/"');
  checkContains(errors, html, 'post-publish-check/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/post-publish-check/"');
  checkContains(errors, html, 'post-publish-check/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'post-publish-check/index.html', '<main id="main">');
  checkContains(errors, html, 'post-publish-check/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'post-publish-check/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'post-publish-check/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`post-publish-check/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Post-publish check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Post-publish check content OK');
}

main();
