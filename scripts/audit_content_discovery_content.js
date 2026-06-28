const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'content-discovery', 'index.html');

const requiredInternalLinks = [
  '/data/content_discovery_log.csv',
  '/project-check-2026/',
  '/source-watch/',
  '/content-intake/',
  '/publication-queue/',
  '/data/projects_2026_verification.csv'
];

const requiredPhrases = [
  'Журнал найденных материалов ТОС БГО',
  'Рабочий журнал обнаруженных официальных страниц, новостей, кандидатов реестра и архивных материалов для портала ТОС БГО',
  'Что найдено, что подтверждено и что ещё блокирует публикацию',
  'Редакционная разведка',
  'Журнал найденных материалов',
  'Журнал фиксирует свежие находки до публикации: официальный раздел, новость, кандидат на карточку или архивный факт',
  'Каждая строка содержит источник, дату, уровень доверия, ограничение и следующий шаг',
  'Открыть CSV',
  'Проекты 2026',
  'Мониторинг источников',
  'Приём материалов',
  'Очередь',
  'Почему это отдельный журнал',
  'Обнаружение материала не означает готовность к публикации',
  'Журнал сохраняет полезную находку и одновременно показывает, чего не хватает',
  'официального первоисточника',
  'итогов конкурса',
  'разрешения редакции',
  'подтверждения ТОС',
  'доступа к документу',
  'Строки журнала не являются новостями сайта и не создают новые карточки ТОС',
  'Для этого материал должен пройти проверку и очередь публикаций',
  'Официальный раздел ТОС',
  'автоматический доступ 24 июня 2026 года вернул 403',
  'Требуется ручное открытие и сохранение актуального перечня',
  'Проекты 2026 года',
  'Найден материал о защите пяти проектов ТОС БГО',
  'Инициативы разложены в отдельную',
  'матрицу проверки',
  'официальные итоги пока не найдены',
  'ТОС «Просторный»',
  'кандидат на сверку реестра',
  'Карточка не создаётся без официального статуса, границ и прямого подтверждения',
  'Архив проектов 2025',
  'Найдена публикация о 13 участниках, но без полного списка и итогов',
  'Материал оставлен на проверке первоисточника',
  'Переход к публикации',
  'Найти первичный источник или прямое подтверждение',
  'Зафиксировать разрешения и ограничения повторного использования',
  'Перенести проверенные факты в `/content-intake/`',
  'Добавить материал в `/publication-queue/`',
  'Публиковать только после статуса',
  'Рабочий журнал найденных материалов'
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

  checkContains(errors, html, 'content-discovery/index.html', '<html lang="ru"');
  checkContains(errors, html, 'content-discovery/index.html', '<title>Журнал найденных материалов ТОС БГО</title>');
  checkContains(errors, html, 'content-discovery/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'content-discovery/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/content-discovery/"');
  checkContains(errors, html, 'content-discovery/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/content-discovery/"');
  checkContains(errors, html, 'content-discovery/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'content-discovery/index.html', '<main id="main">');
  checkContains(errors, html, 'content-discovery/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'content-discovery/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'content-discovery/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`content-discovery/index.html: missing linked local page ${localPath}`);
    }
  });

  ['Официальный раздел ТОС', 'Проекты 2026 года', 'ТОС «Просторный»', 'Архив проектов 2025'].forEach((cardTitle) => {
    if (!html.includes(`<h2>${cardTitle}</h2>`)) {
      errors.push(`content-discovery/index.html: missing discovery card ${cardTitle}`);
    }
  });

  if (!html.includes('<code>ready</code>')) {
    errors.push('content-discovery/index.html: missing ready publication status');
  }

  ['Найти первичный источник или прямое подтверждение', 'Зафиксировать разрешения', 'Перенести проверенные факты', 'Добавить материал', 'Публиковать только после статуса'].forEach((step) => {
    if (!html.includes(step)) {
      errors.push(`content-discovery/index.html: missing publication transition step ${step}`);
    }
  });

  if (errors.length) {
    throw new Error(`Content discovery content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Content discovery content OK');
}

main();