const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'editorial-calendar', 'index.html');

const requiredInternalLinks = [
  '/data/editorial_calendar.csv',
  '/quarterly-report/',
  '/collection-board/',
  '/media-intake/',
  '/post-publish-check/',
  '/data/quarterly_report_template.csv',
  '/reply-review/',
  '/publication-consent/',
  '/verification-evidence/',
  '/open-data/'
];

const requiredPhrases = [
  'Редакционный календарь ТОС БГО',
  'Рабочий календарь регулярного обновления новостей, карточек, реестра, медиа и отчётов портала ТОС БГО',
  'Актуальное содержание',
  'Календарь задаёт регулярный порядок обновления сайта: новости, карточки ТОС, реестр, фото, проекты, потребности и публичные отчёты',
  'Он помогает не публиковать случайные данные и не оставлять сайт без обновлений',
  'Скачать CSV',
  'Квартальный отчёт',
  'Доска сбора',
  'Медиа',
  'QA публикации',
  'Главный принцип',
  'Актуальность сайта должна подтверждаться источником',
  'Если за неделю нет проверенных новостей, лучше не публиковать искусственный материал',
  'Если пришло новое сообщение, его нужно провести через источник, разрешения и контроль после публикации',
  'Календарь не заменяет проверку фактов',
  'Он только задаёт ритм и ответственные контрольные точки',
  'Еженедельно',
  'Проверять входящие ответы, новости ТОС, статус запросов и наличие материалов, которые можно опубликовать без дополнительных согласований',
  'Ежемесячно',
  'Обновлять карточки, медиа-реестр, потребности, проекты, истории сделанного и сверку по реестру, если появились подтверждённые сведения',
  'Ежеквартально',
  'шаблон публичного отчёта',
  'После публикации',
  'Каждое изменение проводить через QA: URL, ссылки, CSV/JSON, noindex для рабочих страниц, метаданные и домен',
  'Что считать готовым к публикации',
  'Есть источник и дата актуальности',
  'Персональные данные и фото имеют разрешение на открытую публикацию',
  'Сведения не противоречат текущему каталогу, реестру и журналу доказательств',
  'После публикации пройден чек-лист `/post-publish-check/`',
  'Связанные инструменты',
  'CSV-календарь',
  'CSV квартального отчёта',
  'разбор ответов',
  'разрешения',
  'доказательства',
  'открытые данные',
  'Рабочий редакционный календарь'
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

  checkContains(errors, html, 'editorial-calendar/index.html', '<html lang="ru"');
  checkContains(errors, html, 'editorial-calendar/index.html', '<title>Редакционный календарь ТОС БГО</title>');
  checkContains(errors, html, 'editorial-calendar/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'editorial-calendar/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/editorial-calendar/"');
  checkContains(errors, html, 'editorial-calendar/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/editorial-calendar/"');
  checkContains(errors, html, 'editorial-calendar/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'editorial-calendar/index.html', '<main id="main">');
  checkContains(errors, html, 'editorial-calendar/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'editorial-calendar/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'editorial-calendar/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`editorial-calendar/index.html: missing linked local page ${localPath}`);
    }
  });

  if (errors.length) {
    throw new Error(`Editorial calendar content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Editorial calendar content OK');
}

main();
