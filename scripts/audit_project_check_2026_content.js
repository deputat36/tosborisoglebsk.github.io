const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const htmlPath = path.join(process.cwd(), 'project-check-2026', 'index.html');

const officialProtocolUrl = 'https://obraz36.ru/site_data/s273/2026/2026/%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D0%B8%D1%82%D0%B5%D0%BB%D0%B8%20%D0%A2%D0%9E%D0%A1%202026.pdf';

const requiredInternalLinks = [
  '/data/projects_2026_verification.csv',
  '/data-requests/projects-2026-results/',
  '/publication-queue/'
];

const requiredPhrases = [
  'Проверка проектов ТОС БГО 2026 года',
  'Официальные результаты и дальнейшая проверка пяти проектов ТОС БГО 2026 года',
  'Официальный результат конкурса и сведения, которые ещё нужно подтвердить у ТОС',
  'Конкурсные проекты',
  'Результаты проектов ТОС 2026 года',
  'Официальный перечень победителей опубликован 22 мая 2026 года',
  'В нём найден один проект Борисоглебского городского округа: ТОС «Миролюбие», «Играй и побеждай»',
  'Матрица CSV',
  'Официальный протокол',
  'Запросы ТОС',
  'Очередь',
  'официальный результат',
  '22.05.2026',
  'ТОС «Миролюбие» — победитель',
  'Проект «Играй и побеждай» включён в официальный перечень победителей',
  'Размер гранта:',
  '1 489 360 рублей',
  'Победа и сумма подтверждены',
  'Сроки, текущий ход реализации, фотографии и разрешение на публикацию материалов ещё нужно получить у ТОС',
  '«Махровка»',
  'Проект «Источник жизни» не включён в официальный перечень победителей',
  '«Губари»',
  'Проект «Свеча памяти» не включён в официальный перечень победителей',
  '«Петровское»',
  'Проект по ограждению кладбища не включён в официальный перечень победителей',
  'Требуется уточнить, будет ли он реализован из других источников',
  '«Макашевка»',
  'Проект благоустройства мемориала не включён в официальный перечень победителей',
  'Следующие действия',
  'У «Миролюбия» запросить сроки, текущий статус, разрешённый текст и собственные фото',
  'У остальных четырёх ТОС подтвердить итог конкурса и дальнейшую судьбу проектов',
  'Не считать отсутствие в перечне победителей отказом от реализации проекта из других источников',
  'Перед публикацией провести сведения через приём материалов, разрешения и очередь',
  '`data/projects.json` пока не изменяется',
  'официальный конкурсный результат подтверждён, но содержание банка проектов и статус реализации требуют отдельной редакционной обработки',
  'Проверка проектов 2026 года'
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

  checkContains(errors, html, 'project-check-2026/index.html', '<html lang="ru"');
  checkContains(errors, html, 'project-check-2026/index.html', '<title>Проверка проектов ТОС БГО 2026 года</title>');
  checkContains(errors, html, 'project-check-2026/index.html', '<meta name="robots" content="noindex,follow"');
  checkContains(errors, html, 'project-check-2026/index.html', '<link rel="canonical" href="https://tosborisoglebsk.ru/project-check-2026/"');
  checkContains(errors, html, 'project-check-2026/index.html', '<meta property="og:url" content="https://tosborisoglebsk.ru/project-check-2026/"');
  checkContains(errors, html, 'project-check-2026/index.html', '<meta property="og:type" content="website"');
  checkContains(errors, html, 'project-check-2026/index.html', '<main id="main">');
  checkContains(errors, html, 'project-check-2026/index.html', '/assets/js/site.js');
  checkContains(errors, html, 'project-check-2026/index.html', officialProtocolUrl);

  requiredPhrases.forEach((phrase) => {
    checkContains(errors, html, 'project-check-2026/index.html', phrase);
  });

  requiredInternalLinks.forEach((link) => {
    checkContains(errors, html, 'project-check-2026/index.html', `href="${link}`);
    const localPath = localPathFor(link);
    if (!repoPathExists(localPath)) {
      errors.push(`project-check-2026/index.html: missing linked local page ${localPath}`);
    }
  });

  ['«Махровка»', '«Губари»', '«Петровское»', '«Макашевка»'].forEach((tosName) => {
    if (!html.includes(`<h2>${tosName}</h2>`)) {
      errors.push(`project-check-2026/index.html: missing non-winner card ${tosName}`);
    }
  });

  ['У «Миролюбия» запросить сроки', 'У остальных четырёх ТОС подтвердить итог конкурса', 'Не считать отсутствие в перечне победителей отказом', 'Перед публикацией провести сведения'].forEach((step) => {
    if (!html.includes(step)) {
      errors.push(`project-check-2026/index.html: missing next action ${step}`);
    }
  });

  if (errors.length) {
    throw new Error(`Project check 2026 content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Project check 2026 content OK');
}

main();