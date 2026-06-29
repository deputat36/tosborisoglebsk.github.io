const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'content-intake', 'index.html');

const requiredInternalLinks = [
  '/data/content_intake_template.csv',
  '/publication-queue/',
  '/reply-review/',
  '/publication-consent/',
  '/post-publish-check/',
  '/data/publication_queue.csv',
  '/freshness-check/',
  '/editorial-calendar/',
  '/media-intake/',
  '/open-data/'
];

const requiredPhrases = [
  'Приём материалов для сайта ТОС БГО',
  'Рабочий шаблон приёма новостей, проектов, потребностей, историй результата, обновлений карточек и медиа для портала ТОС БГО',
  'Входящие материалы',
  'Шаблон помогает принимать новости, проекты, потребности, истории результата, обновления карточек и медиа в единой структуре',
  'Материал не переносится на сайт, пока не указаны источник, дата и разрешение на публикацию',
  'Скачать CSV',
  'Очередь публикаций',
  'Разбор ответа',
  'Разрешения',
  'QA публикации',
  'Минимум для публикации',
  'Для любого материала нужны тип, ТОС, заголовок, краткое описание, дата события или факта, источник, контакт для уточнения, разрешение на открытую публикацию и отметка о персональных данных',
  'Если в материале есть фото людей, телефоны, адреса, имена ответственных лиц или другие персональные данные, сначала используется `/publication-consent/`',
  'Новости',
  'Публиковать только событие с датой, источником и понятным правом на открытую публикацию',
  'Проекты',
  'Фиксировать статус, сроки, территорию, подтверждение ТОС и связь с карточкой или реестром',
  'Потребности',
  'Указывать срок актуальности. Устаревшая потребность должна закрываться, а не висеть как новая',
  'Сделано',
  'История результата требует факта, даты, подтверждения и разрешённых фото или иных доказательств',
  'Порядок обработки',
  'Заполнить строку в CSV-шаблоне',
  'Добавить материал в',
  'Проверить источник и дату актуальности',
  'Разобрать персональные данные и разрешения',
  'Перенести материал в нужный JSON только после статуса <code>ready</code>',
  'После публикации пройти QA и контроль свежести',
  'Связанные инструменты',
  'Рабочий приём материалов'
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

  checkContains(errors, html, 'content-intake/index.html', '<html lang="ru"');
  checkContains(errors, html, 'content-intake/index.html', '<title>Приём материалов для сайта ТОС БГО</title>');
  checkContains(errors, html, 'content-intake/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'content-intake/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/content-intake/"');
  checkContains(errors, html, 'content-intake/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/content-intake/"');
  checkContains(errors, html, 'content-intake/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'content-intake/index.html', '<main id="main">');
  checkContains(errors, html, 'content-intake/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'content-intake/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'content-intake/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`content-intake/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Content intake page content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Content intake page content OK');
}

main();
