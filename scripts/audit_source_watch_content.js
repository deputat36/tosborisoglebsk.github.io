const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'source-watch', 'index.html');

const requiredInternalLinks = [
  '/data/source_watchlist.csv',
  '/content-discovery/',
  '/data/content_discovery_log.csv',
  '/sources/',
  '/publication-queue/'
];

const requiredPhrases = [
  'Мониторинг источников ТОС БГО',
  'Рабочий реестр официальных, прямых и редакционных источников для актуализации портала ТОС БГО',
  'Какие источники проверять и что допустимо публиковать на их основании',
  'Актуальное содержание',
  'Мониторинг источников',
  'Реестр задаёт постоянный набор каналов для поиска новостей, документов и уточнений',
  'У каждого источника указаны уровень доверия, частота проверки и ограничения использования',
  'Источники CSV',
  'Найденные материалы',
  'Находки CSV',
  'Принципы',
  'Очередь',
  'Уровни источников',
  'Primary:',
  'официальный документ, официальный портал или прямое подтверждение уполномоченного представителя ТОС',
  'Secondary:',
  'редакционная публикация, которая может подтвердить событие или подсказать первоисточник',
  'Discovery:',
  'поисковая выдача и социальные сети, пригодные только для обнаружения материала',
  'Упоминание названия ТОС в новости не подтверждает актуального председателя, границы, контакты или официальный статус',
  'Еженедельно',
  'Проверять официальные порталы, конкурсные материалы, региональные и местные новости с прямым упоминанием ТОС БГО',
  'Фиксировать находки',
  'Каждую полезную страницу заносить в',
  'журнал найденных материалов',
  'Перед публикацией',
  'не публиковать, пока не закрыты источник, разрешения, персональные данные и медиа',
  'После публикации',
  'Фиксировать URL, дату проверки и срок актуальности материала, затем проходить QA',
  'Рабочий цикл',
  'Проверить источники согласно частоте в CSV',
  'Добавить находку в',
  'журнал обнаружения',
  'Найти первоисточник, если материал обнаружен через СМИ или поиск',
  'Передать подтверждённый материал в `/content-intake/`',
  'Провести его через `/publication-queue/`',
  'После публикации обновить дату последней проверки источника',
  'Рабочий мониторинг источников'
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

  checkContains(errors, html, 'source-watch/index.html', '<html lang="ru"');
  checkContains(errors, html, 'source-watch/index.html', '<title>Мониторинг источников ТОС БГО</title>');
  checkContains(errors, html, 'source-watch/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'source-watch/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/source-watch/"');
  checkContains(errors, html, 'source-watch/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/source-watch/"');
  checkContains(errors, html, 'source-watch/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'source-watch/index.html', '<main id="main">');
  checkContains(errors, html, 'source-watch/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'source-watch/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'source-watch/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`source-watch/index.html: missing linked local page ${localPath}`);
    }
  });

  ['Primary:', 'Secondary:', 'Discovery:'].forEach((level) => {
    if (!html.includes(`<b>${level}</b>`)) {
      errors.push(`source-watch/index.html: missing source trust level ${level}`);
    }
  });

  ['Проверить источники согласно частоте в CSV', 'Добавить находку в', 'Найти первоисточник', 'Передать подтверждённый материал', 'Провести его через', 'После публикации обновить дату'].forEach((step) => {
    if (!html.includes(step)) {
      errors.push(`source-watch/index.html: missing workflow step ${step}`);
    }
  });

  if (errors.length) {
    throw new Error(`Source watch content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Source watch content OK');
}

main();