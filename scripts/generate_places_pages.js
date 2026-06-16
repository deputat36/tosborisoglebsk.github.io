const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const PLACES_DIR = path.join(ROOT, 'places');

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
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
  const cards = places.map((place) => `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(place.count)} ТОС</span></div><h3>${esc(place.name)}</h3><p>${esc(place.summary)}</p><div class="card-actions"><a class="btn" href="/places/${esc(place.slug)}/">Открыть территорию</a></div></div></article>`).join('');
  return `<!doctype html><html lang="ru"><head>${baseHead('Населённые пункты и территории ТОС БГО', description, canonical)}</head><body>${header()}<main id="main"><section class="hero"><div class="container hero-card"><div class="eyebrow">Справочник территорий</div><h1>Населённые пункты и территории ТОС БГО</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/tos/">Каталог ТОС</a><a class="btn" href="/map/">Карта</a><a class="btn" href="/sources/">Источники данных</a></div></div></section><section class="section"><div class="container grid">${cards}</div></section></main>${footer()}</body></html>`;
}

function makePlacePage(place) {
  const canonical = `${SITE_URL}/places/${place.slug}/`;
  const description = `${place.name}: связанные ТОСы, границы территорий, новости, проекты, потребности и материалы портала ТОС БГО.`;
  const tosCards = place.toses.map((tos) => {
    const contacts = [
      arr(tos.phones).length ? `Телефон: ${arr(tos.phones).join(', ')}` : '',
      arr(tos.social_links).length ? 'Есть соцсети' : '',
      tos.founded ? `Создан: ${tos.founded}` : ''
    ].filter(Boolean).join(' · ');
    return `<article class="card"><div class="card-inner"><div class="meta"><span class="tag">${esc(tos.type || 'ТОС')}</span>${tos.population ? `<span class="tag">${esc(tos.population)} жителей</span>` : ''}</div><h3>ТОС «${esc(tos.name)}»</h3><p>${esc(tos.description || 'Описание уточняется.')}</p><p class="tiny">${esc(contacts || 'Контакты и сведения уточняются.')}</p><div class="card-actions"><a class="btn" href="/tos/${esc(tos.slug)}/">Открыть карточку</a></div></div></article>`;
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
  return `<!doctype html><html lang="ru"><head>${baseHead(`${place.name} | Территории ТОС БГО`, description, canonical)}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body>${header()}<main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/places/">← Все территории</a><div class="eyebrow">Территория ТОС БГО</div><h1>${esc(place.name)}</h1><p class="lead">${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/tos/">Каталог ТОС</a><a class="btn" href="/map/">Карта</a><a class="btn" href="/update-tos/">Обновить данные</a></div></div></section><section class="section"><div class="container section-head"><div><h2>Связанные ТОСы</h2><p>${esc(place.toses.length)} карточек на этой территории</p></div></div><div class="container grid">${tosCards}</div></section><section class="section"><div class="container prose"><h2>Границы по карточкам ТОС</h2><ul>${boundaries}</ul><div class="notice">Справка сформирована автоматически из каталога ТОС. Если в границах или названии территории есть ошибка, отправьте уточнение через раздел «Обновить данные».</div></div></section></main>${footer()}</body></html>`;
}

function main() {
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const grouped = new Map();

  for (const tos of toses) {
    const location = cleanPlace(tos.location);
    if (!grouped.has(location)) grouped.set(location, []);
    grouped.get(location).push(tos);
  }

  const places = [...grouped.entries()].map(([name, items]) => ({
    name,
    slug: slugify(placeTitle(name)),
    count: items.length,
    toses: items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru')),
    summary: items.length === 1
      ? `На этой территории сейчас связана 1 карточка ТОС.`
      : `На этой территории сейчас связано ${items.length} карточек ТОС.`
  })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));

  fs.rmSync(PLACES_DIR, { recursive: true, force: true });
  write(path.join(PLACES_DIR, 'index.html'), makeIndex(places));
  places.forEach((place) => write(path.join(PLACES_DIR, place.slug, 'index.html'), makePlacePage(place)));

  console.log(`Generated place pages: ${places.length}`);
}

main();
