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

const requiredPagePhrases = ['Карта территорий ТОС','Неразмеченные места','возможность создания','Моя разметка','Проверить пересечения','Точка в центре карты','Вырезать участок','Скачать разметку','Скачать таблицу','Скачать схему','не подтверждение','на вашем устройстве','только проверенные геоданные без персональных сведений'];
const requiredLinks = ['/tos/','/create-tos/','/update-tos/','/verification-guide/','/legal/','/contacts/'];

function check(errors, content, text, label) {
  if (!content.includes(text)) errors.push(`missing ${label}: ${text}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
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
  check(errors, html, '<main id="main" data-territory-map-version="1">', 'main landmark');
  check(errors, html, '/assets/js/site.js', 'site script');
  check(errors, html, 'data/toses.geojson', 'GeoJSON reference');
  const C=require('../assets/js/territory-map-core');
  const reference=JSON.parse(fs.readFileSync('data/bgo-reference.geojson','utf8'));
  const source=reference.features[0];
  if(source.properties.osm_relation_id!==937332||source.properties.reference_only!==true||source.properties.license!=='ODbL-1.0'||!source.properties.source_api_url||!source.properties.retrieved_at)errors.push('OSM district reference needs provenance and reference-only status');
  try{C.normalizePolygon(source.geometry.coordinates);}catch(e){errors.push('Invalid district reference: '+e.message);}
  if(!C.contains([42.075169,51.368015],source.geometry))errors.push('District reference excludes actual administrative centre');
  const embedded=html.match(/<script type="application\/json" id="territory-map-data">([\s\S]*?)<\/script>/);
  if(!embedded)errors.push('Missing static map payload');
  else {const data=JSON.parse(embedded[1]);if(JSON.stringify(data.reference)!==JSON.stringify(reference)||JSON.stringify(data.public)!==JSON.stringify(geojson))errors.push('Map payload is stale');const B=require('../assets/js/territory-map-basemaps');if(JSON.stringify(data.basemaps)!==JSON.stringify(B.settings(JSON.parse(fs.readFileSync('data/map-basemaps.json','utf8')))))errors.push('Basemap settings are stale');const minimal=toses.map(({slug,name,location})=>({slug,name,location}));if(JSON.stringify(data.catalog)!==JSON.stringify(minimal))errors.push('Map roster must include every catalogue entry and only public name/location');}
  for(const asset of ['assets/js/territory-map.js','assets/js/territory-map-core.js','assets/js/territory-map-basemaps.js','assets/css/territory-map.css','assets/vendor/leaflet/leaflet.js','assets/vendor/leaflet/leaflet.css','assets/vendor/leaflet/LICENSE','assets/img/bgo-reference.svg']){
    if(!fs.existsSync(asset))errors.push('Missing local map asset '+asset);
    if(!asset.endsWith('LICENSE')&&!html.includes('/'+asset))errors.push('Map does not reference '+asset);
  }
  if(!html.includes('data-map-app hidden')||!html.includes('data-map-fallback')||!html.includes('OpenStreetMap'))errors.push('Map needs progressive fallback and visible attribution');
  const crypto=require('node:crypto');for(const asset of ['assets/js/territory-map.js','assets/js/territory-map-core.js','assets/js/territory-map-basemaps.js','assets/css/territory-map.css'])if(fs.existsSync(asset)&&!html.includes('/'+asset+'?v='+crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0,12)))errors.push('Map cache hash is stale: '+asset);
  for(const f of geojson.features||[]){try{if(f.geometry.type==='Point'){if(f.geometry.coordinates.length!==2||f.geometry.coordinates.some(x=>typeof x!=='number'||!Number.isFinite(x))||Math.abs(f.geometry.coordinates[0])>180||Math.abs(f.geometry.coordinates[1])>85)throw new Error('Invalid point');}else{C.normalize({type:'FeatureCollection',features:[f]},toses);for(const polygon of C.polygons(f.geometry))for(const ring of polygon)if(JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))throw new Error('Public rings must be explicitly closed');}}catch(e){errors.push('Invalid public geometry: '+e.message);}}

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
