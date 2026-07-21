const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const contract = require('../assets/js/publication-queue-contract.js');

const htmlPath = path.join(process.cwd(), 'publication-queue', 'index.html');

const requiredInternalLinks = [
  '/update-tos/',
  '/publication-import/',
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
  'Канонические статусы',
  'Статус <code>ready</code> допустим только после закрытия обязательных проверок',
  'временные строки <code>incoming-*</code>',
  'канонические ID <code>queue-001</code>…<code>queue-999</code>',
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
  'Материал принят, но обязательные поля или проверки ещё не завершены',
  'Редакция проверяет источник, разрешения, персональные данные и медиа',
  'Все проверки закрыты, указан целевой JSON или страница, назначен ответственный, блокер очищен',
  'Материал опубликован и затем проверяется через послепубликационный QA',
  'Публикация остановлена. В очереди сохраняются конкретная причина и следующий шаг',
  'Маршрут материала',
  'Принять материал через',
  'единый шаблон',
  'Скачать объединённый предпросмотр с каноническими <code>queue-*</code>',
  'Добавить строку в',
  'очередь публикаций',
  'Перевести материал в <code>checking</code>',
  'При статусе <code>ready</code> обновить целевой JSON или страницу',
  'После публикации пройти',
  'Контролировать срок актуальности через',
  'проверку свежести',
  'Рабочая очередь публикаций'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
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

  requiredPhrases.forEach((phrase) => checkContains(errors, html, 'publication-queue/index.html', phrase));

  [...contract.STATUSES].forEach((status) => {
    if (!html.includes(`<code>${status}</code>`)) errors.push(`publication-queue/index.html: missing status ${status}`);
  });
  ['source_check', 'consent_check', 'blocked'].forEach((legacyStatus) => {
    if (html.includes(`<code>${legacyStatus}</code>`)) errors.push(`publication-queue/index.html: legacy status ${legacyStatus} must not be shown`);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'publication-queue/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) errors.push(`publication-queue/index.html: missing linked local page ${localPath}`);
  });

  if (errors.length) throw new Error(`Publication queue content audit failed:\n${errors.join('\n')}`);
  console.log(`Publication queue content OK: statuses=${[...contract.STATUSES].join(',')}`);
}

main();
