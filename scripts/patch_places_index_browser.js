const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_places_pages.js');
const VERSION_MARKER = 'data-places-browser-version="2026-07-22"';
const AUDIT_REQUIRE = "const { auditPlacesBrowser } = require('./audit_places_browser');";
const AUDIT_CALL = 'auditPlacesBrowser();';

const MAKE_INDEX = `function makeIndex(places) {
  const canonical = \`\${SITE_URL}/places/\`;
  const description = 'Справочник населённых пунктов и территорий Борисоглебского городского округа, связанных с карточками ТОС.';
  const cards = places.map((place) => {
    const verification = placeVerificationSummary(place);
    const tosNames = place.toses.map((tos) => tos.name).join('|');
    return \`<article class="card" data-place-slug="\${esc(place.slug)}" data-place-name="\${esc(place.name)}" data-place-count="\${place.count}" data-place-verified="\${place.verifiedCount}" data-place-partial="\${place.partialCount}" data-place-review="\${place.reviewCount}" data-place-summary="\${esc(place.summary)}" data-place-tos-names="\${esc(tosNames)}"><div class="card-inner"><div class="meta"><span class="tag">\${esc(cardCountLabel(place.count))}</span><span class="tag \${verification.className}">\${esc(verification.label)}</span></div><h3>\${esc(place.name)}</h3><p>\${esc(place.summary)}</p><p class="tiny">Связанные ТОС: \${esc(place.toses.map((tos) => \`«\${tos.name}»\`).join(', '))}</p><div class="card-actions"><a class="btn" href="/places/\${esc(place.slug)}/">Открыть территорию</a></div></div></article>\`;
  }).join('');
  return \`<!doctype html><html lang="ru"><head>\${baseHead('Населённые пункты и территории ТОС БГО', description, canonical)}</head><body>\${header()}<main id="main"><section class="hero"><div class="container hero-card"><div class="eyebrow">Справочник территорий</div><h1>Населённые пункты и территории ТОС БГО</h1><p class="lead">\${esc(description)}</p><div class="hero-actions"><a class="btn primary" href="/tos/">Каталог ТОС</a><a class="btn" href="/map/">Карта</a><a class="btn" href="/sources/">Источники данных</a></div></div></section><section class="section tight"><div class="container notice"><b>О достоверности:</b> справочник объединяет карточки по указанному населённому пункту. Метка на каждой территории показывает состояние проверки связанных карточек, а не официальное подтверждение границ.</div></section><section class="section" id="places-browser" ${VERSION_MARKER}><div class="container section-head"><div><h2>Найти территорию или ТОС</h2><p id="place-filter-help">Поиск работает по названию населённого пункта и связанным названиям ТОС. Фильтры и сортировка сохраняются в ссылке.</p></div></div><div class="container" id="places-summary" aria-label="Сводка территорий"></div><div class="container toolbar"><input class="input" id="place-search" type="search" placeholder="Например: Чигорак, Борисоглебск, Миролюбие..." aria-label="Поиск территории или ТОС" aria-describedby="place-filter-help place-filter-status"/><select class="select" id="place-count-filter" aria-label="Фильтр по числу связанных ТОС"><option value="all">Любое число ТОС</option><option value="single">Одна карточка ТОС</option><option value="multiple">Несколько карточек ТОС</option></select><select class="select" id="place-verification-filter" aria-label="Фильтр по состоянию проверки"><option value="all">Любой статус проверки</option><option value="verified">Все карточки подтверждены</option><option value="partial">Есть подтверждённые или частичные</option><option value="review">Требует проверки</option></select><select class="select" id="place-sort" aria-label="Сортировка территорий"><option value="name">По названию</option><option value="count-desc">Сначала больше ТОС</option><option value="count-asc">Сначала меньше ТОС</option></select><button class="btn" id="place-reset-filters" type="button">Сбросить</button></div><p class="container tiny" id="place-filter-status" role="status" aria-live="polite">Загрузка справочника и подсчёт территорий...</p></section><section class="section"><div class="container grid" id="places-grid">\${cards}</div><div class="container empty" id="places-empty" hidden>По выбранным условиям территории не найдены. Сбросьте фильтры или откройте полный каталог ТОС.</div></section></main>\${footer()}<script src="/assets/js/places-core.js"></script><script src="/assets/js/places.js"></script></body></html>\`;
}`;

function patchSource(source) {
  let content = source;
  let changed = false;

  if (!content.includes(VERSION_MARKER)) {
    const pattern = /function makeIndex\(places\) \{[\s\S]*?\n\}\n\nfunction makePlacePage/;
    if (!pattern.test(content)) throw new Error('generate_places_pages.js: makeIndex block not found');
    content = content.replace(pattern, `${MAKE_INDEX}\n\nfunction makePlacePage`);
    changed = true;
  }

  if (!content.includes(AUDIT_REQUIRE)) {
    content = content.replace("const path = require('path');", `const path = require('path');\n${AUDIT_REQUIRE}`);
    changed = true;
  }

  if (!content.includes(AUDIT_CALL)) {
    const mainPattern = /\nmain\(\);\s*$/;
    if (!mainPattern.test(content)) throw new Error('generate_places_pages.js: final main() call not found');
    content = content.replace(mainPattern, `\nmain();\n${AUDIT_CALL}\n`);
    changed = true;
  }

  return { content, changed };
}

function patchPlacesIndexBrowser() {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);
  const current = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(GENERATOR_PATH, result.content, 'utf8');
  console.log(`Places index browser patch OK: ${result.changed ? 'generator updated' : 'already current'}`);
  return result.changed;
}

if (require.main === module) patchPlacesIndexBrowser();

module.exports = { patchSource, patchPlacesIndexBrowser };
