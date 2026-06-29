const fs = require('fs');
const path = require('path');

const pagePath = path.join(process.cwd(), 'map', 'index.html');
const geojsonPath = path.join(process.cwd(), 'data', 'toses.geojson');

function check(errors, content, text, label) {
  if (!content.includes(text)) errors.push(`missing ${label}: ${text}`);
}

function main() {
  const errors = [];
  if (!fs.existsSync(pagePath)) errors.push('missing map/index.html');
  if (!fs.existsSync(geojsonPath)) errors.push('missing data/toses.geojson');

  if (errors.length) throw new Error(`Map content audit failed:\n${errors.join('\n')}`);

  const html = fs.readFileSync(pagePath, 'utf8');
  const geojson = fs.readFileSync(geojsonPath, 'utf8');

  check(errors, html, '<html lang="ru">', 'language');
  check(errors, html, '<title>Карта ТОС Борисоглебского городского округа</title>', 'title');
  check(errors, html, 'https://tosborisoglebsk.ru/map/', 'canonical or Open Graph URL');
  check(errors, html, '<main id="main">', 'main landmark');
  check(errors, html, '/assets/js/site.js', 'site script');
  check(errors, html, 'Карта ТОСов', 'heading');
  check(errors, html, 'границ и точек ТОСов', 'purpose');
  check(errors, html, 'data/toses.geojson', 'GeoJSON reference');
  check(errors, html, '<code>slug</code>', 'slug reference');
  check(errors, html, 'координаты полигона или точки', 'geometry note');
  check(errors, html, 'Быстрый старт', 'quick start');
  check(errors, html, 'Следующий этап', 'next step');
  check(errors, html, '/tos/', 'catalog link');
  check(errors, html, '/create-tos/', 'create TOS link');
  check(errors, html, '/contacts/', 'contacts link');

  check(errors, geojson, '"type": "FeatureCollection"', 'GeoJSON collection type');
  check(errors, geojson, '"features": []', 'empty features marker');

  if (errors.length) throw new Error(`Map content audit failed:\n${errors.join('\n')}`);
  console.log('Map content OK');
}

main();
