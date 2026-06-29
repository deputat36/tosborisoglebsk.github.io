const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'publication-queue', 'index.html');

const requiredInternalLinks = [
  '/data/publication_queue.csv',
  '/content-intake/',
  '/publication-consent/',
  '/post-publish-check/',
  '/freshness-check/'
];

const requiredPhrases = [
  'Очередь публикаций портала ТОС БГО',
  'Рабочая очередь проверки входящих новостей, проектов, потребностей, результатов, обновлений карточек и медиа перед публикацией на портале ТОС БГО',
  'Редакционный workflow',
  'Очередь публикаций',
  'Очередь связывает приём материалов с обновлением JSON и страниц сайта',
  'Статус <code>ready</code> допустим только после проверки источника, разрешения, персональных данных и приложенных медиа',
  'Открыть CSV',
  'Приём материалов',
  'Разрешения',
  'QA публикации',
  'Обязательные проверки',
  '<b>Источник:</b> указаны автор или организация, дата факта и документ либо ссылка',
  '<b>Разрешение:</b> подтверждено право на открытую публикацию текста, контактов и иных сведений',
  '<b>Персональные данные:</b> телефоны, email, имена и изображения людей проверены отдельно',
  '<b>Медиа:</b> зафиксированы автор или правообладатель, разрешение и допустимый объём использования',
  'Пустая строка, устное сообщение без фиксации источника или найденное в сети изображение не переводят материал в <code>ready</code>',
  'Материал принят, но обязательные поля и проверки ещё не завершены',
  'Уточняются источник, дата события или факта и подтверждающий документ',
  'Проверяются разрешения, персональные данные и права на медиа',
  'Все проверки закрыты, указан целевой JSON или страница и назначен ответственный',
  'Материал опубликован, затем проверен через послепубликационный QA',
  'Зафиксирован конкретный блокер: нет источника, разрешения, актуальности или подтверждения',
  'Маршрут материала',
  'Принять материал через',
  'единый шаблон',
  'Добавить строку в',
  'очередь публикаций',
  'Закрыть проверки и указать блокер, если публикация невозможна',
  'При статусе <code>ready</code> обновить целевой JSON или страницу',
  'После публикации пройти',
  'Контролировать срок актуальности через',
  'проверку свежести',
  'Рабочая очередь публикаций'
];

const requiredStatuses = [
  'draft',
  'source_check',
  'consent_check',
  'ready',
  'published',
  'blocked'
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

  checkContains(errors, html, 'publication-queue/index.html', '<html lang="ru"');
  checkContains(errors, html, 'publication-queue/index.html', '<title>Очередь публикаций портала ТОС БГО</title>');
  checkContains(errors, html, 'publication-queue/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'publication-queue/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/publication-queue/"');
  checkContains(errors, html, 'publication-queue/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/publication-queue/"');
  checkContains(errors, html, 'publication-queue/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'publication-queue/index.html', '<main id="main">');
  checkContains(errors, html, 'publication-queue/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'publication-queue/index.html', phrase);
  });

  requiredStatuses.forEach((status) => {
    if (!html.includes(`<code>${status}</code>`)) {
      errors.push(`publication-queue/index.html: missing status ${status}`);
    }
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'publication-queue/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`publication-queue/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Publication queue content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Publication queue content OK');
}

main();
