const fs = require('fs');
const path = require('path');
const { auditPlacesBrowser } = require('./audit_places_browser');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const PLACES_DIR = path.join(ROOT, 'places');

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

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function write(file, html) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
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

function placeVerificationSummary(place) {
  if (place.verifiedCount === place.count) {
    return { className: 'ok', label: 'Все карточки подтверждены' };
  }
  if (place.verifiedCount || place.partialCount) {
    return {
      className: 'info',
      label: `${place.verifiedCount} подтверждено · ${place.partialCount} частично`
    };
  }
  return { className: 'warn', label: 'Сведения требуют проверки' };
}

function baseHead(title, description, canonical) {
  return `<meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:image" content="${SITE_URL}/assets/img/og-cover.svg"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="stylesheet" href="/assets/css/styles.css"/>`;
}

function header() {
  return `<a class="skip-link" href="#main">Перейти к содержимому</a>
<header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>`;
}

function footer(note = 'Справочник территорий формируется автоматически из каталога ТОС.') {
  return `<footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">${esc(note)}</div></div></footer><script src="/assets/js/site.js"></script>`;
}

function makeIndex(places) {
  const canonical = `${SITE_URL}/places/`;
  const description = 'Справочник населённых пунктов и территорий Борисоглебского городского округа, связанных с карточками ТОС.';
  const cards = places.map((place) => {
    const verification = placeVerificationSummary(place);
    const tosNames = place.toses.map((tos) => tos.name).join('|');
    return `<article class="card" data-place-slug="${esc(place.slug)}" data-place-name="${esc(place.name)}" data-place-count="${place.count}" data-place-verified="${place.verifiedCount}" data-place-partial="${place.partialCount}" data-place-review="${place.reviewCount}" data-place-summary="${esc(place.summary)}" data-place-tos-names="${esc(tosNames)}"><div class="card-inner"><div class="meta"><span class="tag">${esc(cardCountLabel(place.count))}</span><span class="tag ${verification.className}">${esc(verification.label)}</span></div><h3>${esc(place.name)}</h3><p>${esc(place.summary)}</p><p class="tiny">Связанные ТОС: ${place.toses.map((tos) => `<a data-place-tos-link href="/tos/${esc(tos.slug)}/">«${esc(tos.name)}»</a>`).join(', ')}</p><div class="card-actions"><a class="btn" href="/places/${esc(place.slug)}/">Открыть территорию</a></div></div></article>`;
  }).join('');
  return `<!doctype html><html lang="ru"><head>${baseHead('Населённые пункты и территории ТОС БГО', description, canonical)}</head><body>${header()}<main id="main"><section class="hero"><div class="container hero-card"><div class="eyebrow">Справочник территорий</div><h1>Населённые пункты и территории ТОС БГО</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/tos/">Каталог ТОС</a><a class="btn" href="/map/">Карта</a><a class="btn" href="/sources/">Источники данных</a></div></div></section><section class="section tight"><div class="container notice"><b>О достоверности:</b> справочник объединяет карточки по указанному населённому пункту. Метка на каждой территории показывает состояние проверки связанных карточек, а не официальное подтверждение границ.</div></section><section class="section" id="places-browser" data-places-browser-version="2026-07-22"><div class="container section-head"><div><h2>Найти территорию или ТОС</h2><p id="place-filter-help">Поиск работает по названию населённого пункта и связанным названиям ТОС. Фильтры и сортировка сохраняются в ссылке.</p></div></div><div class="container" id="places-summary" aria-label="Сводка территорий"></div><div class="container toolbar"><input class="input" id="place-search" type="search" placeholder="Например: Чигорак, Борисоглебск, Миролюбие..." aria-label="Поиск территории или ТОС" aria-describedby="place-filter-help place-filter-status"/><select class="select" id="place-count-filter" aria-label="Фильтр по числу связанных ТОС"><option value="all">Любое число ТОС</option><option value="single">Одна карточка ТОС</option><option value="multiple">Несколько карточек ТОС</option></select><select class="select" id="place-verification-filter" aria-label="Фильтр по состоянию проверки"><option value="all">Любой статус проверки</option><option value="verified">Все карточки подтверждены</option><option value="partial">Есть подтверждённые или частичные</option><option value="review">Требует проверки</option></select><select class="select" id="place-sort" aria-label="Сортировка территорий"><option value="name">По названию</option><option value="count-desc">Сначала больше ТОС</option><option value="count-asc">Сначала меньше ТОС</option></select><button class="btn" id="place-reset-filters" type="button">Сбросить</button></div><p class="container tiny" id="place-filter-status" role="status" aria-live="polite">Загрузка справочника и подсчёт территорий...</p></section><section class="section"><div class="container grid" id="places-grid">${cards}</div><div class="container empty" id="places-empty" hidden>По выбранным условиям территории не найдены. Сбросьте фильтры или откройте полный каталог ТОС.</div></section></main>${footer()}<script src="/assets/js/places-core.js"></script><script src="/assets/js/places.js"></script></body></html>`;
}

function makePlacePage(place) {
  const canonical = `${SITE_URL}/places/${place.slug}/`;
  const description = `${place.name}: связанные карточки ТОС и опубликованные в них границы территорий Борисоглебского городского округа.`;
  const tosCards = place.toses.map((tos) => {
    const verification = verificationInfo(tos);
    const contacts = [
      arr(tos.social_links).length ? 'Есть открытая группа ТОС' : '',
      tos.founded ? `Год создания: ${tos.founded}` : ''
    ].filter(Boolean).join(' · ');
    return `<article class="card" data-tos-slug="${esc(tos.slug)}" data-verification-status="${esc(verification.status)}"><div class="card-inner"><div class="meta"><span class="tag">${esc(tos.type || 'ТОС')}</span>${tos.population ? `<span class="tag">${esc(tos.population)} жителей</span>` : ''}<span class="tag ${verificationClass(verification.status)}">${esc(verification.label)}</span></div><h3><a data-place-tos-link href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a></h3><p>${esc(tos.description || 'Описание уточняется.')}</p><p class="tiny">${esc(contacts || 'Дополнительные сведения уточняются.')}</p><p class="tiny" data-trust-summary>${esc(trustSummary(verification))}</p><div class="card-actions"><a class="btn" href="/tos/${esc(tos.slug)}/">Открыть карточку</a><a class="btn" href="${esc(updateUrl(tos))}">Уточнить сведения</a></div></div></article>`;
  }).join('');
  const boundaries = place.toses.map((tos) => `<li><a href="/tos/${esc(tos.slug)}/">ТОС «${esc(tos.name)}»</a>: ${esc(tos.boundaries || 'границы уточняются')}</li>`).join('');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: place.name,
    url: canonical,
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: 'Борисоглебский городской округ'
    }
  };
  return `<!doctype html><html lang="ru"><head>${baseHead(`${place.name} | Территории ТОС БГО`, description, canonical)}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body>${header()}<main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/places/">← Все территории</a><div class="eyebrow">Территория ТОС БГО</div><h1>${esc(place.name)}</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/tos/">Каталог ТОС</a><a class="btn" href="/map/">Карта</a><a class="btn" href="/update-tos/?type=card#message-builder">Обновить данные</a></div></div></section><section class="section tight" id="place-trust" aria-labelledby="place-trust-title"><div class="container notice"><b id="place-trust-title">Как читать эту страницу:</b> сведения собраны из карточек ТОС и могут быть проверены частично. Телефоны, email и личные профили здесь не дублируются — они доступны только в основной карточке вместе со статусом проверки.</div></section><section class="section"><div class="container section-head"><div><h2>Связанные ТОСы</h2><p>${esc(cardCountLabel(place.toses.length))} на этой территории</p></div></div><div class="container grid">${tosCards}</div></section><section class="section"><div class="container prose"><h2>Границы по карточкам ТОС</h2><ul>${boundaries}</ul><div class="notice">Границы приведены в том виде, в котором они записаны в каталоге. Публикация на портале не заменяет официальный реестр или муниципальный документ.</div></div></section><section class="section tight" id="place-context" aria-labelledby="place-context-title"><div class="container prose"><h2 id="place-context-title">Что делать дальше</h2><ul><li><a href="/tos/">Открыть полный каталог ТОС</a></li><li><a href="/map/">Посмотреть территории на карте</a></li><li><a href="/verification-guide/">Узнать, как портал проверяет сведения</a></li><li><a href="/update-tos/?type=card#message-builder">Передать уточнение по карточке или границам</a></li></ul></div></section></main>${footer()}</body></html>`;
}

function main() {
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const grouped = new Map();

  for (const tos of toses) {
    const location = cleanPlace(tos.location);
    if (!grouped.has(location)) grouped.set(location, []);
    grouped.get(location).push(tos);
  }

  const places = [...grouped.entries()].map(([name, items]) => {
    const sortedItems = items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
    const statuses = sortedItems.map(verificationInfo);
    return {
      name,
      slug: slugify(placeTitle(name)),
      count: sortedItems.length,
      toses: sortedItems,
      verifiedCount: statuses.filter((item) => item.status === 'verified').length,
      partialCount: statuses.filter((item) => item.status === 'partial').length,
      reviewCount: statuses.filter((item) => item.status === 'needs_review' || item.status === 'stale').length,
      summary: sortedItems.length === 1
        ? 'На этой территории сейчас связана 1 карточка ТОС.'
        : `На этой территории сейчас связано ${sortedItems.length} карточек ТОС.`
    };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));

  fs.rmSync(PLACES_DIR, { recursive: true, force: true });
  write(path.join(PLACES_DIR, 'index.html'), makeIndex(places));
  places.forEach((place) => write(path.join(PLACES_DIR, place.slug, 'index.html'), makePlacePage(place)));

  console.log(`Generated place pages: ${places.length}`);
}

main();
auditPlacesBrowser();
