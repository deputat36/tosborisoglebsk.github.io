const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'media-guide', 'index.html');

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) {
    errors.push(`missing ${label}: ${needle}`);
  }
}

function requireRoute(errors, route) {
  if (!repoPathExists(route)) {
    errors.push(`missing route ${route}`);
  }
}

function main() {
  const errors = [];

  if (!fs.existsSync(pagePath)) {
    throw new Error(`Missing file: ${pagePath}`);
  }

  const html = fs.readFileSync(pagePath, 'utf8');

  requireIncludes(errors, html, '<html lang="ru">', 'Russian language marker');
  requireIncludes(errors, html, '<title>Фото и логотипы для карточек ТОС БГО</title>', 'page title');
  requireIncludes(errors, html, 'href="https://tosborisoglebsk.ru/media-guide/"', 'canonical');
  requireIncludes(errors, html, 'property="og:url" content="https://tosborisoglebsk.ru/media-guide/"', 'Open Graph URL');
  requireIncludes(errors, html, 'property="og:type" content="website"', 'Open Graph type');
  requireIncludes(errors, html, '<main id="main">', 'main landmark');
  requireIncludes(errors, html, '/assets/js/site.js', 'site script');

  requireIncludes(errors, html, 'Медиа для портала', 'eyebrow');
  requireIncludes(errors, html, 'Фото и логотипы для карточек ТОС', 'main heading');
  requireIncludes(errors, html, 'публикуем только то, что можно размещать открыто', 'open publication principle');
  requireIncludes(errors, html, 'Что прислать', 'materials section');
  requireIncludes(errors, html, 'Логотип ТОС', 'logo card');
  requireIncludes(errors, html, 'Фото территории', 'territory photos card');
  requireIncludes(errors, html, 'Фото мероприятий', 'event photos card');
  requireIncludes(errors, html, 'Фото результата', 'result photos card');
  requireIncludes(errors, html, 'было / сделали / стало', 'before after result format');

  requireIncludes(errors, html, 'Как подписывать фото', 'caption section');
  requireIncludes(errors, html, 'название ТОС', 'TOS name caption field');
  requireIncludes(errors, html, 'где сделано фото', 'place caption field');
  requireIncludes(errors, html, 'когда сделано фото', 'date caption field');
  requireIncludes(errors, html, 'что происходит на фото', 'event caption field');
  requireIncludes(errors, html, 'можно ли публиковать фото открыто', 'publication permission field');
  requireIncludes(errors, html, 'Фото можно публиковать', 'example permission phrase');

  requireIncludes(errors, html, 'Технические рекомендации', 'technical section');
  requireIncludes(errors, html, 'без сильного сжатия', 'quality recommendation');
  requireIncludes(errors, html, 'режим «файлом»', 'send as file recommendation');
  requireIncludes(errors, html, 'горизонтальные, и вертикальные фото', 'orientation recommendation');
  requireIncludes(errors, html, 'Избегайте мутных фото', 'bad quality warning');
  requireIncludes(errors, html, 'tos-nazvanie-2026-05-subbotnik-01.jpg', 'file name example');

  requireIncludes(errors, html, 'Что нельзя публиковать без осторожной проверки', 'publication restrictions section');
  requireIncludes(errors, html, 'фото людей в спорных или неприятных ситуациях', 'people photo warning');
  requireIncludes(errors, html, 'фото детей крупным планом', 'children photo warning');
  requireIncludes(errors, html, 'паспортными, банковскими или личными данными', 'sensitive documents warning');
  requireIncludes(errors, html, 'домашние адреса, личные телефоны и внутренние переписки', 'private contacts warning');
  requireIncludes(errors, html, 'обвинениями без подтверждённых фактов', 'unverified claims warning');
  requireIncludes(errors, html, 'нет прав или разрешения', 'rights and permission warning');

  requireIncludes(errors, html, 'https://vk.ru/tosbgo', 'VK community link');
  requireIncludes(errors, html, '/communication-kit/', 'communication kit link');
  requireIncludes(errors, html, '/field-checklist/', 'field checklist link');
  requireIncludes(errors, html, '/update-tos/?type=photo#message-builder', 'photo update link');

  [
    '/media-guide/',
    '/communication-kit/',
    '/field-checklist/',
    '/update-tos/'
  ].forEach((route) => requireRoute(errors, route));

  if (errors.length) {
    throw new Error(`Media guide content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Media guide content OK');
}

main();
