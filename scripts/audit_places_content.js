const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'places', 'index.html');

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) errors.push(`missing ${label}: ${needle}`);
}

function requireRoute(errors, route) {
  if (!repoPathExists(route)) errors.push(`missing route ${route}`);
}

function main() {
  const errors = [];
  if (!fs.existsSync(pagePath)) throw new Error(`Missing file: ${pagePath}`);

  const html = fs.readFileSync(pagePath, 'utf8');

  requireIncludes(errors, html, '<html lang="ru">', 'language');
  requireIncludes(errors, html, '<title>Населённые пункты и территории ТОС БГО</title>', 'title');
  requireIncludes(errors, html, 'https://tosborisoglebsk.ru/places/', 'canonical or OG URL');
  requireIncludes(errors, html, 'property="og:type" content="website"', 'OG type');
  requireIncludes(errors, html, '<main id="main">', 'main');
  requireIncludes(errors, html, '/assets/js/site.js', 'site script');
  requireIncludes(errors, html, 'Справочник территорий', 'eyebrow');
  requireIncludes(errors, html, 'Справочник населённых пунктов и территорий Борисоглебского городского округа', 'lead text');
  requireIncludes(errors, html, '/tos/', 'catalog link');
  requireIncludes(errors, html, '/map/', 'map link');
  requireIncludes(errors, html, '/sources/', 'sources link');
  requireIncludes(errors, html, 'Справочник территорий формируется автоматически из каталога ТОС', 'auto generated note');

  [
    'г. Борисоглебск',
    'п. Ивановка',
    'п. Калинино',
    'п. Миролюбие',
    'п. Подстёпки',
    'с. Богана',
    'с. Губари',
    'с. Махровка',
    'с. Петровское',
    'с. Танцырей',
    'с. Третьяки',
    'с. Ульяновка',
    'с. Чигорак'
  ].forEach((place) => requireIncludes(errors, html, place, `place ${place}`));

  [
    '/places/',
    '/tos/',
    '/map/',
    '/sources/',
    '/places/borisoglebsk/',
    '/places/ivanovka/',
    '/places/kalinino/',
    '/places/mirolyubie/',
    '/places/podstepki/',
    '/places/bogana/',
    '/places/gubari/',
    '/places/mahrovka/',
    '/places/petrovskoe/',
    '/places/tancyrey/',
    '/places/tretyaki/',
    '/places/ulyanovka/',
    '/places/chigorak/'
  ].forEach((route) => requireRoute(errors, route));

  if (errors.length) throw new Error(`Places content audit failed:\n${errors.join('\n')}`);
  console.log('Places content OK');
}

main();
