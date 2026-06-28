const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'data-requests', 'projects-2026-results', 'index.html');

const requiredInternalLinks = [
  '/data/projects_2026_result_requests.csv',
  '/project-check-2026/',
  '/reply-review/',
  '/outreach-register/'
];

const requiredPhrases = [
  'Запрос подтверждений по проектам ТОС 2026 года',
  'Запросы сроков и реализации победившего проекта, а также дальнейших планов остальных ТОС БГО',
  'Что запросить у пяти ТОС после публикации официального протокола',
  'Проекты 2026',
  'Запрос подтверждений после итогов конкурса',
  'Официальный протокол найден без отправки обращения',
  'Теперь нужны прямые ответы ТОС о реализации победившего проекта и дальнейших планах проектов, не включённых в перечень победителей',
  'Открыть CSV',
  'Результаты',
  'Разбор ответа',
  'Журнал запросов',
  'Официальный источник',
  'Протокол от 22 мая 2026 года подтверждает победу ТОС «Миролюбие» с проектом «Играй и побеждай» и грантом 1 489 360 рублей',
  'Общий запрос организатору больше не требуется',
  'Официальный результат не подтверждает начало работ, сроки или право использовать фотографии и тексты ТОС',
  '«Миролюбие»',
  'Запросить сроки, текущий статус реализации, разрешённый текст и собственные фото с подтверждёнными правами',
  '«Махровка»',
  'Подтвердить итог конкурса и узнать, планируется ли проект «Источник жизни» из других источников',
  '«Губари»',
  'Подтвердить итог проекта «Свеча памяти» и дальнейшие планы через доступный канал карточки',
  '«Петровское»',
  'Уточнить дальнейшую судьбу проекта по ограждению кладбища и разрешённые материалы',
  '«Макашевка»',
  'Уточнить дальнейшую судьбу проекта благоустройства мемориала и разрешённые материалы',
  'Обработка ответа',
  'Записать дату, канал и автора ответа',
  'Отдельно отметить право на публикацию текста и фото',
  'Обновить матрицу проектов и единый журнал обращений',
  'Передать подтверждённый материал в приём и публикационную очередь',
  'После публикации пройти QA и контроль свежести',
  'Персональные запросы остаются',
  'пока фактически не отправлены',
  'Запросы по проектам 2026 года'
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

  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<html lang="ru"');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<title>Запрос подтверждений по проектам ТОС 2026 года</title>');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/data-requests/projects-2026-results/"');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/data-requests/projects-2026-results/"');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '<main id="main">');
  checkContains(errors, html, 'data-requests/projects-2026-results/index.html', '/assets/js/site.js');

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'data-requests/projects-2026-results/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'data-requests/projects-2026-results/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`data-requests/projects-2026-results/index.html: missing linked local page ${localPath}`);
    }
  });

  ['«Миролюбие»', '«Махровка»', '«Губари»', '«Петровское»', '«Макашевка»'].forEach((tosName) => {
    if (!html.includes(`<h2>${tosName}</h2>`)) {
      errors.push(`data-requests/projects-2026-results/index.html: missing request card ${tosName}`);
    }
  });

  ['Записать дату, канал и автора ответа', 'Отдельно отметить право на публикацию текста и фото', 'Обновить матрицу проектов и единый журнал обращений', 'Передать подтверждённый материал', 'После публикации пройти QA'].forEach((step) => {
    if (!html.includes(step)) {
      errors.push(`data-requests/projects-2026-results/index.html: missing response handling step ${step}`);
    }
  });

  if (!html.includes('<code>draft</code>')) {
    errors.push('data-requests/projects-2026-results/index.html: missing draft request status');
  }

  if (errors.length) {
    throw new Error(`Projects 2026 result requests content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Projects 2026 result requests content OK');
}

main();