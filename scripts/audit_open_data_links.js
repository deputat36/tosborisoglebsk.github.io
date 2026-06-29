const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'open-data', 'index.html');
const requiredDataTargets = new Set([
  '/data/toses.json',
  '/data/news.json',
  '/data/projects.json',
  '/data/needs.json',
  '/data/done.json',
  '/data/site_health.json',
  '/data/page_index.json',
  '/rss.xml',
  '/sitemap.xml'
]);

function requireIncludes(errors, html, text, label) {
  if (!html.includes(text)) errors.push(`missing ${label}: ${text}`);
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
  const dataTargets = hrefs.filter((href) => (
    href.startsWith('/data/') || href === '/rss.xml' || href === '/sitemap.xml'
  ));
  const uniqueTargets = new Set(dataTargets);

  requireIncludes(errors, html, '<html lang="ru">', 'language');
  requireIncludes(errors, html, '<title>Открытые данные портала ТОС БГО</title>', 'title');
  requireIncludes(errors, html, 'https://tosborisoglebsk.ru/open-data/', 'canonical or OG URL');
  requireIncludes(errors, html, 'property="og:type" content="website"', 'OG type');
  requireIncludes(errors, html, '<main id="main">', 'main landmark');
  requireIncludes(errors, html, '/assets/js/site.js', 'site script');
  requireIncludes(errors, html, 'Данные портала хранятся в простых JSON и CSV-файлах', 'open data purpose');
  requireIncludes(errors, html, 'Каталог ТОС', 'TOS catalog card');
  requireIncludes(errors, html, 'Новости', 'news card');
  requireIncludes(errors, html, 'Проекты', 'projects card');
  requireIncludes(errors, html, 'Потребности', 'needs card');
  requireIncludes(errors, html, 'Сделано', 'done card');
  requireIncludes(errors, html, 'Качество данных', 'data quality link');
  requireIncludes(errors, html, 'Источники данных', 'sources link');
  requireIncludes(errors, html, 'Как использовать', 'usage section');
  requireIncludes(errors, html, 'Рабочий статус не означает подтверждение факта', 'working status caveat');
  requireIncludes(errors, html, 'для публикации нужны источник, дата актуальности и необходимые разрешения', 'publication caveat');
  requireIncludes(errors, html, 'Устаревшие или спорные сведения должны проходить повторную проверку', 'recheck caveat');

  if (!dataTargets.length) {
    errors.push('open-data page must link to data files');
  }

  requiredDataTargets.forEach((target) => {
    if (!uniqueTargets.has(target)) {
      errors.push(`missing required open data target ${target}`);
    }
  });

  uniqueTargets.forEach((target) => {
    const isSupported = /\.(csv|json|xml)$/.test(target);
    if (!isSupported) {
      errors.push(`unsupported open data target extension ${target}`);
    }
    if (!repoPathExists(target)) {
      errors.push(`missing open data target ${target}`);
    }
  });

  if (errors.length) {
    throw new Error(`Open data links audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Open data links OK: ${uniqueTargets.size} data targets`);
}

main();
