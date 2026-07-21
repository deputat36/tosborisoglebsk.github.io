const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PLACES_DIR = path.join(ROOT, 'places');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const SITE_URL = 'https://tosborisoglebsk.ru';

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

const VERIFICATION_LABELS = {
  verified: 'Сведения подтверждены',
  partial: 'Проверено частично',
  needs_review: 'Требует проверки',
  stale: 'Нужно перепроверить'
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function slugify(value) {
  return String(value || 'place')
    .toLowerCase()
    .replace(/[а-яё]/g, (letter) => CYR[letter] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'place';
}

function cleanPlace(value) {
  return String(value || 'Территория уточняется').trim();
}

function placeTitle(place) {
  return place.replace(/^г\.\s*/i, '').replace(/^с\.\s*/i, '').replace(/^п\.\s*/i, '').trim();
}

function niceDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cardCountLabel(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} карточек`;
  if (mod10 === 1) return `${count} карточка`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} карточки`;
  return `${count} карточек`;
}

function verificationInfo(tos) {
  const trust = tos?.trust && typeof tos.trust === 'object' ? tos.trust : {};
  const allowed = ['verified', 'partial', 'needs_review', 'stale'];
  let status = allowed.includes(tos?.verification_status) ? tos.verification_status : 'needs_review';

  if (trust.recheck_after && status !== 'needs_review') {
    const recheck = new Date(`${trust.recheck_after}T00:00:00`);
    if (!Number.isNaN(recheck.getTime()) && recheck.getTime() < Date.now()) status = 'stale';
  }

  return {
    status,
    label: VERIFICATION_LABELS[status] || VERIFICATION_LABELS.needs_review,
    checkedAt: String(trust.checked_at || ''),
    scope: arr(trust.verification_scope)
  };
}

function verificationClass(status) {
  if (status === 'verified') return 'ok';
  if (status === 'partial') return 'info';
  return 'warn';
}

function trustSummary(info) {
  if (info.status === 'needs_review') {
    return 'Источник, дата и объём проверки сведений пока не зафиксированы.';
  }
  if (info.status === 'stale') {
    return 'Сведения опубликованы, но срок их повторной проверки уже наступил.';
  }

  const details = [];
  if (info.checkedAt) details.push(`проверено ${niceDate(info.checkedAt)}`);
  if (info.scope.length) details.push(`объём: ${info.scope.join(', ')}`);
  if (!details.length) return 'Статус установлен, но подробности проверки требуют уточнения.';
  return `${info.label}: ${details.join(' · ')}.`;
}

function updateUrl(tos) {
  return `/update-tos/?tos=${encodeURIComponent(tos.slug)}&type=card#message-builder`;
}

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) errors.push(`missing ${label}: ${needle}`);
}

function requireRoute(errors, route) {
  if (!repoPathExists(route)) errors.push(`missing route ${route}`);
}

function rejectPersonalCopies(errors, html, toses, label) {
  if (html.includes('Телефон:')) errors.push(`${label}: aggregate page must not render phone labels`);
  if (html.includes('href="tel:') || html.includes('href="mailto:')) {
    errors.push(`${label}: aggregate page must not contain tel or mailto links`);
  }

  toses.forEach((tos) => {
    arr(tos.phones).forEach((phone) => {
      if (phone && html.includes(esc(phone))) errors.push(`${label}: duplicated phone for ${tos.slug}`);
    });
    arr(tos.emails).forEach((email) => {
      if (email && html.includes(esc(email))) errors.push(`${label}: duplicated email for ${tos.slug}`);
    });
    arr(tos.chairperson_links).forEach((url) => {
      if (url && html.includes(esc(url))) errors.push(`${label}: duplicated personal profile for ${tos.slug}`);
    });
  });
}

function groupPlaces(toses) {
  const grouped = new Map();
  toses.forEach((tos) => {
    const location = cleanPlace(tos.location);
    if (!grouped.has(location)) grouped.set(location, []);
    grouped.get(location).push(tos);
  });

  return [...grouped.entries()].map(([name, items]) => ({
    name,
    slug: slugify(placeTitle(name)),
    toses: items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'))
  })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
}

function auditIndex(errors, places, toses) {
  const pagePath = path.join(PLACES_DIR, 'index.html');
  if (!fs.existsSync(pagePath)) {
    errors.push(`missing file ${pagePath}`);
    return;
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  requireIncludes(errors, html, '<html lang="ru">', 'index language');
  requireIncludes(errors, html, '<title>Населённые пункты и территории ТОС БГО</title>', 'index title');
  requireIncludes(errors, html, `${SITE_URL}/places/`, 'index canonical or OG URL');
  requireIncludes(errors, html, 'property="og:type" content="website"', 'index OG type');
  requireIncludes(errors, html, '<main id="main">', 'index main');
  requireIncludes(errors, html, '/assets/js/site.js', 'index site script');
  requireIncludes(errors, html, 'Справочник территорий', 'index eyebrow');
  requireIncludes(errors, html, 'О достоверности:', 'index trust notice');
  requireIncludes(errors, html, '/tos/', 'index catalog link');
  requireIncludes(errors, html, '/map/', 'index map link');
  requireIncludes(errors, html, '/sources/', 'index sources link');
  requireIncludes(errors, html, 'Справочник территорий формируется автоматически из каталога ТОС', 'index generated note');

  places.forEach((place) => {
    requireIncludes(errors, html, place.name, `place ${place.name}`);
    requireIncludes(errors, html, `/places/${place.slug}/`, `place route ${place.slug}`);
    requireIncludes(errors, html, cardCountLabel(place.toses.length), `place count ${place.slug}`);
  });

  rejectPersonalCopies(errors, html, toses, 'places index');
}

function auditPlacePage(errors, place) {
  const pagePath = path.join(PLACES_DIR, place.slug, 'index.html');
  const line = `place ${place.slug}`;
  if (!fs.existsSync(pagePath)) {
    errors.push(`${line}: missing generated page`);
    return;
  }

  const html = fs.readFileSync(pagePath, 'utf8');
  const canonical = `${SITE_URL}/places/${place.slug}/`;
  requireIncludes(errors, html, `<title>${esc(place.name)} | Территории ТОС БГО</title>`, `${line} title`);
  requireIncludes(errors, html, `<link rel="canonical" href="${canonical}"`, `${line} canonical`);
  requireIncludes(errors, html, '"@type":"Place"', `${line} JSON-LD`);
  requireIncludes(errors, html, `<h1>${esc(place.name)}</h1>`, `${line} h1`);
  requireIncludes(errors, html, 'id="place-trust"', `${line} trust section`);
  requireIncludes(errors, html, 'Телефоны, email и личные профили здесь не дублируются', `${line} privacy explanation`);
  requireIncludes(errors, html, 'id="place-context"', `${line} context section`);
  requireIncludes(errors, html, '/verification-guide/', `${line} verification guide`);
  requireIncludes(errors, html, '/map/', `${line} map route`);
  requireIncludes(errors, html, '/update-tos/?type=card#message-builder', `${line} generic update route`);
  requireIncludes(errors, html, `${esc(cardCountLabel(place.toses.length))} на этой территории`, `${line} grammatical count`);

  const cardMatches = html.match(/data-tos-slug="[^"]+"/g) || [];
  if (cardMatches.length !== place.toses.length) {
    errors.push(`${line}: expected ${place.toses.length} TOS cards, found ${cardMatches.length}`);
  }

  place.toses.forEach((tos) => {
    const verification = verificationInfo(tos);
    requireIncludes(
      errors,
      html,
      `data-tos-slug="${esc(tos.slug)}" data-verification-status="${esc(verification.status)}"`,
      `${line} trust attributes ${tos.slug}`
    );
    requireIncludes(
      errors,
      html,
      `<span class="tag ${verificationClass(verification.status)}">${esc(verification.label)}</span>`,
      `${line} verification label ${tos.slug}`
    );
    requireIncludes(errors, html, esc(trustSummary(verification)), `${line} trust summary ${tos.slug}`);
    requireIncludes(errors, html, `/tos/${esc(tos.slug)}/`, `${line} TOS route ${tos.slug}`);
    requireIncludes(errors, html, esc(updateUrl(tos)), `${line} scoped update route ${tos.slug}`);
    requireIncludes(
      errors,
      html,
      `ТОС «${esc(tos.name)}»</a>: ${esc(tos.boundaries || 'границы уточняются')}`,
      `${line} boundaries ${tos.slug}`
    );
  });

  rejectPersonalCopies(errors, html, place.toses, line);
}

function main() {
  const errors = [];
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const places = groupPlaces(toses);

  auditIndex(errors, places, toses);
  places.forEach((place) => auditPlacePage(errors, place));

  const expectedDirectories = new Set(places.map((place) => place.slug));
  if (fs.existsSync(PLACES_DIR)) {
    fs.readdirSync(PLACES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        if (!expectedDirectories.has(entry.name)) errors.push(`unexpected place directory ${entry.name}`);
      });
  }

  ['/places/', '/tos/', '/map/', '/sources/', '/verification-guide/', '/update-tos/']
    .forEach((route) => requireRoute(errors, route));
  places.forEach((place) => requireRoute(errors, `/places/${place.slug}/`));

  if (errors.length) throw new Error(`Places content audit failed:\n${errors.join('\n')}`);
  console.log(`Places content OK: ${places.length} detail pages checked without duplicated personal contacts`);
}

main();