const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'map', 'index.html');
const geojsonPath = path.join(process.cwd(), 'data', 'toses.geojson');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');

const allowedGeometryTypes = new Set(['Point', 'Polygon', 'MultiPolygon']);
const allowedGeometryRoles = new Set(['reference_point', 'boundary']);
const forbiddenPropertyKeys = new Set([
  'phone',
  'email',
  'contact',
  'contacts',
  'private_address',
  'personal_data',
  'passport',
  'snils'
]);

const requiredPagePhrases = [
  'Карта территорий и ориентиров ТОС',
  'подтверждённые геометрии не опубликованы',
  'пустая карта честнее предположительных координат',
  'Как читать будущую карту',
  'Точка-ориентир',
  'Не является границей',
  'Полигон границы',
  'Нужен подтверждённый источник',
  'Черновик',
  'Не публикуется в GeoJSON',
  'Что можно и нельзя публиковать',
  'Карта показывает территорию, а не персональные данные жителей',
  'Порядок добавления геоданных',
  'Сначала источник и проверка, затем публичный GeoJSON',
  'verification_status: verified',
  'geometry_role',
  'reference_point',
  'boundary',
  'checked_at',
  'public_note',
  'только проверенные геоданные без персональных сведений'
];

const requiredLinks = [
  '/tos/',
  '/update-tos/',
  '/verification-guide/',
  '/legal/',
  '/faq/',
  '/contacts/'
];

function check(errors, content, text, label) {
  if (!content.includes(text)) errors.push(`missing ${label}: ${text}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function validateFeature(errors, feature, index, tosSlugs) {
  const label = `feature ${index + 1}`;
  if (!feature || feature.type !== 'Feature') {
    errors.push(`${label}: type must be Feature`);
    return;
  }

  const properties = feature.properties;
  const geometry = feature.geometry;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    errors.push(`${label}: properties must be an object`);
    return;
  }

  Object.keys(properties).forEach((key) => {
    if (forbiddenPropertyKeys.has(String(key).toLowerCase())) {
      errors.push(`${label}: forbidden personal-data property ${key}`);
    }
  });

  if (!isNonEmptyString(properties.slug)) {
    errors.push(`${label}: missing properties.slug`);
  } else if (!tosSlugs.has(properties.slug)) {
    errors.push(`${label}: unknown TOS slug ${properties.slug}`);
  }

  if (properties.verification_status !== 'verified') {
    errors.push(`${label}: public GeoJSON accepts only verification_status=verified`);
  }

  if (!allowedGeometryRoles.has(properties.geometry_role)) {
    errors.push(`${label}: geometry_role must be reference_point or boundary`);
  }

  if (!isNonEmptyString(properties.source)) {
    errors.push(`${label}: missing source description`);
  }

  if (!validDate(properties.checked_at)) {
    errors.push(`${label}: checked_at must use YYYY-MM-DD`);
  }

  if (!isNonEmptyString(properties.public_note)) {
    errors.push(`${label}: missing public_note`);
  }

  if (!geometry || !allowedGeometryTypes.has(geometry.type)) {
    errors.push(`${label}: geometry type must be Point, Polygon or MultiPolygon`);
    return;
  }

  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    errors.push(`${label}: geometry.coordinates must be a non-empty array`);
  }

  if (geometry.type === 'Point' && properties.geometry_role !== 'reference_point') {
    errors.push(`${label}: Point must use geometry_role=reference_point`);
  }

  if (['Polygon', 'MultiPolygon'].includes(geometry.type) && properties.geometry_role !== 'boundary') {
    errors.push(`${label}: Polygon and MultiPolygon must use geometry_role=boundary`);
  }
}

function main() {
  const errors = [];
  if (!fs.existsSync(pagePath)) errors.push('missing map/index.html');
  if (!fs.existsSync(geojsonPath)) errors.push('missing data/toses.geojson');
  if (!fs.existsSync(tosesPath)) errors.push('missing data/toses.json');

  if (errors.length) throw new Error(`Map content audit failed:\n${errors.join('\n')}`);

  const html = fs.readFileSync(pagePath, 'utf8');
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);

  check(errors, html, '<html lang="ru">', 'language');
  check(errors, html, '<title>Карта ТОС Борисоглебского городского округа</title>', 'title');
  check(errors, html, 'https://tosborisoglebsk.ru/map/', 'canonical or Open Graph URL');
  check(errors, html, '<main id="main">', 'main landmark');
  check(errors, html, '/assets/js/site.js', 'site script');
  check(errors, html, 'data/toses.geojson', 'GeoJSON reference');
  check(errors, html, '<code>slug</code>', 'slug reference');
  check(errors, html, 'координаты полигона или точки', 'geometry note');

  requiredPagePhrases.forEach((phrase) => check(errors, html, phrase, 'map guidance'));

  requiredLinks.forEach((link) => {
    check(errors, html, `href="${link}`, 'required link');
    if (!repoPathExists(link)) errors.push(`missing linked route ${link}`);
  });

  if (!geojson || geojson.type !== 'FeatureCollection') {
    errors.push('data/toses.geojson must be a FeatureCollection');
  }

  if (!Array.isArray(geojson.features)) {
    errors.push('data/toses.geojson features must be an array');
  } else {
    geojson.features.forEach((feature, index) => validateFeature(errors, feature, index, tosSlugs));
  }

  if (errors.length) throw new Error(`Map content audit failed:\n${errors.join('\n')}`);
  console.log(`Map content OK: ${geojson.features.length} verified public geometries`);
}

main();
