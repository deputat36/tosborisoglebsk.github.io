const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const EVENTS_PATH = path.join(ROOT, 'data', 'events.json');
const NEEDS_PATH = path.join(ROOT, 'data', 'needs.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
}
function arr(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
function phoneHref(phone) { return String(phone || '').replace(/[^+\d]/g, ''); }
function logoPath(tos) { return tos.logo || `/assets/img/tos-logos/${tos.slug}.svg`; }
function isPublished(x) { return x && x.status !== 'draft'; }
function niceDate(value) {
  if (!value) return 'Дата уточняется';
  const d = new Date(String(value) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
function description(tos) {
  const base = [tos.boundaries, tos.location].filter(Boolean).join(' ');
  return `ТОС «${tos.name}»: председатель, контакты, границы, новости, события, проекты, потребности и результаты работы. ${base}`.trim();
}
function socialName(url) {
  if (!url) return 'Ссылка';
  if (url.includes('vk.com') || url.includes('vk.ru')) return 'ВКонтакте';
  if (url.includes('ok.ru')) return 'Одноклассники';
  if (url.includes('t.me')) return 'Telegram';
  return 'Ссылка';
}
function renderList(items, formatter, empty = '<li>Информация уточняется</li>') {
  return items.length ? items.map(formatter).join('\n') : empty;
}
function byDateDesc(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }
function byDateAsc(a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }
function related(items, slug, limit, sorter = byDateDesc) {
  return arr(items).filter(x => isPublished(x) && x.tos_slug === slug).sort(sorter).slice(0, limit);
}
function calcQuality(tos) {
  const checks = [
    tos.slug,
    tos.name,
    tos.type,
    tos.location,
    tos.boundaries,
    tos.founded,
    tos.chairperson,
    arr(tos.phones).length,
    arr(tos.emails).length,
    arr(tos.social_links).length,
    tos.population,
    tos.logo,
    tos.description && tos.description !== 'Описание пока уточняется.',
    tos.updated_at
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
function qualityLabel(score) {
  if (score >= 80) return 'хорошо заполнена';
  if (score >= 55) return 'требует уточнений';
  return 'нужно обновить данные';
}
function missingFields(tos) {
  const list = [];
  if (!arr(tos.phones).length) list.push('телефон для открытой публикации');
  if (!arr(tos.social_links).length) list.push('ссылка на группу, чат или страницу ТОС');
  if (!tos.logo) list.push('реальный логотип ТОС');
  if (!tos.updated_at) list.push('дата последней проверки карточки');
  if (!tos.description || tos.description === 'Описание пока уточняется.') list.push('краткое описание деятельности');
  if (!tos.boundaries) list.push('границы территории');
  if (!tos.founded) list.push('год создания');
  if (!tos.population) list.push('примерная численность жителей');
  return list;
}
function clarifyBlock(tos, qualityText) {
  const missing = missingFields(tos);
  const items = missing.map((item) => `<li>${esc(item)}</li>`).join('');
  const message = missing.length
    ? `<p>Карточка уже опубликована, но её можно сделать точнее. Сейчас стоит уточнить:</p><ul>${items}</ul>`
    : '<p>Основные поля карточки заполнены. Следующий шаг — добавить подтверждённые фото, логотип, новости и истории результата по мере поступления.</p>';
  return `<section class="section tight"><div class="container grid"><article class="card full"><div class="card-inner"><div class="meta"><span class="tag">Проверка данных</span><span class="tag">${esc(qualityText)}</span></div><h2>Что нужно уточнить</h2>${message}<div class="notice"><b style="color:var(--text)">Как помочь</b><br>Пришлите только те данные, которые можно размещать открыто: публичный телефон, ссылку на группу, логотип, фото территории, описание выполненных дел или актуальную потребность.</div><div class="card-actions"><a class="btn primary" href="/update-tos/?tos=${esc(tos.slug)}">Прислать уточнение</a><a class="btn" href="/data-quality/">Качество данных</a><a class="btn" href="/sources/">Источники данных</a></div></div></article></div></section>`;
}
function newsCard(n) {
  return `<article class="list-item"><div class="meta"><span class="tag">${esc(n.category || 'Новость')}</span><span class="tag">${esc(niceDate(n.date))}</span></div><h3>${esc(n.title || 'Новость')}</h3><p>${esc(n.lead || '')}</p><div class="card-actions"><a class="btn" href="/news/${esc(n.id)}/">Читать</a>${n.source_url ? `<a class="btn" href="${esc(n.source_url)}" target="_blank" rel="noopener">Источник</a>` : ''}</div></article>`;
}
function eventCard(e) {
  return `<article class="list-item"><div class="meta"><span class="tag">${esc(e.type || 'Событие')}</span><span class="tag">${esc(niceDate(e.date))}${e.time ? ' · ' + esc(e.time) : ''}</span></div><h3>${esc(e.title || 'Событие')}</h3><p>${esc(e.description || '')}</p><p class="tiny"><b>Место:</b> ${esc(e.place || 'Уточняется')}</p><div class="card-actions"><a class="btn" href="/calendar/">Календарь</a></div></article>`;
}
function projectCard(p) {
  const steps = arr(p.steps).slice(0, 4).map(s => `<li>${esc(s)}</li>`).join('');
  return `<article class="card"><div class="card-inner"><div class="tag">${esc(p.type || 'Проект')}</div><h3>${esc(p.title || 'Проект')}</h3><p>${esc(p.description || '')}</p>${steps ? `<hr class="sep"/><ul class="tiny">${steps}</ul>` : ''}<div class="card-actions"><a class="btn" href="/projects/${esc(p.id)}/">Подробнее</a></div></div></article>`;
}
function doneCard(d) {
  return `<article class="list-item"><div class="meta"><span class="tag">${esc(d.type || 'Сделано')}</span><span class="tag">${esc(niceDate(d.date))}</span></div><h3>${esc(d.title || 'История ТОС')}</h3><p>${esc(d.summary || '')}</p><div class="grid"><article class="card"><div class="card-inner"><span class="tag">Было</span><p>${esc(d.before || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Сделали</span><p>${esc(d.done || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Результат</span><p>${esc(d.result || 'Информация уточняется.')}</p></div></article></div><div class="card-actions"><a class="btn" href="/done/">Все истории</a><a class="btn" href="/contacts/">Прислать фото</a></div></article>`;
}
function needCard(n) {
  return `<article class="list-item"><div class="meta"><span class="tag">${esc(n.need_type || 'Помощь')}</span><span class="tag ${n.priority === 'Высокий' ? 'warn' : ''}">${esc(n.priority || 'Приоритет уточняется')}</span></div><h3>${esc(n.title || 'Потребность')}</h3><p>${esc(n.description || '')}</p><p class="tiny"><b>Контакт:</b> ${esc(n.contact || 'Уточняется')}</p><div class="card-actions"><a class="btn" href="/needs/">Все потребности</a><a class="btn" href="/contacts/">Предложить помощь</a></div></article>`;
}
function block(title, subtitle, linkText, linkUrl, content, layout = 'list') {
  if (!content) return '';
  return `<section class="section"><div class="container section-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${linkUrl ? `<a class="btn" href="${esc(linkUrl)}">${esc(linkText || 'Открыть')}</a>` : ''}</div><div class="container ${layout}">${content}</div></section>`;
}
function actionCard(title, text, url, primary = false) {
  return `<article class="card"><div class="card-inner"><h3>${esc(title)}</h3><p>${esc(text)}</p><a class="btn ${primary ? 'primary' : ''}" href="${esc(url)}">Открыть</a></div></article>`;
}

function makePage(tos, data) {
  const title = `ТОС «${tos.name}» — контакты, границы, председатель | ТОС БГО`;
  const desc = description(tos);
  const canonical = `${SITE_URL}/tos/${tos.slug}/`;
  const logo = logoPath(tos);
  const phones = arr(tos.phones);
  const emails = arr(tos.emails);
  const chairLinks = arr(tos.chairperson_links);
  const socialLinks = arr(tos.social_links);
  const sameAs = [...chairLinks, ...socialLinks];
  const relNews = related(data.news, tos.slug, 6).map(newsCard).join('');
  const relEvents = related(data.events, tos.slug, 6, byDateAsc).map(eventCard).join('');
  const relProjects = related(data.projects, tos.slug, 6).map(projectCard).join('');
  const relDone = related(data.done, tos.slug, 4).map(doneCard).join('');
  const relNeeds = related(data.needs, tos.slug, 6).map(needCard).join('');
  const qualityScore = calcQuality(tos);
  const qualityText = `${qualityScore}% — ${qualityLabel(qualityScore)}`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: `ТОС «${tos.name}»`,
        url: canonical,
        logo: `${SITE_URL}${logo}`,
        areaServed: tos.location || 'Борисоглебский городской округ',
        description: desc,
        sameAs,
        contactPoint: phones.map(phone => ({ '@type': 'ContactPoint', telephone: phone, contactType: 'председатель' }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Каталог ТОС', item: `${SITE_URL}/tos/` },
          { '@type': 'ListItem', position: 3, name: `ТОС «${tos.name}»`, item: canonical }
        ]
      }
    ]
  };

  const actions = [
    actionCard('Прислать новость', 'Расскажите о субботнике, собрании, празднике, проекте, помощи или результате работы ТОС.', '/contacts/', true),
    actionCard('Предложить проект', 'Опишите идею: что нужно изменить, кому это поможет, какие фото и ресурсы уже есть.', '/update-tos/#template-project'),
    actionCard('Сообщить о потребности', 'Укажите, что нужно территории: материалы, волонтёры, техника, транспорт, фото или помощь партнёров.', '/update-tos/#template-need'),
    actionCard('Уточнить данные', 'Исправьте телефон, председателя, ссылку, границы, описание или дату обновления карточки.', `/update-tos/?tos=${tos.slug}`),
    actionCard('Прислать фотоотчёт', 'Покажите результат: было, сделали, кто участвовал и что получилось.', '/update-tos/#template-photo'),
    actionCard('Посмотреть, что сделано', 'Откройте истории результата и архив реализованных инициатив ТОСов.', '/done/')
  ].join('');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:image" content="${esc(`${SITE_URL}${logo}`)}"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="stylesheet" href="/assets/css/styles.css"/>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>
  <main id="main">
    <section class="hero"><div class="container hero-card"><a class="chip" href="/tos/">← Каталог ТОС</a><h1>ТОС «${esc(tos.name)}»</h1><p class="lead">${esc(tos.location || 'Борисоглебский городской округ')}</p><div class="hero-actions"><a class="btn primary" href="#help-this-tos">Как помочь</a><a class="btn" href="/contacts/">Предложить новость</a><a class="btn" href="/update-tos/?tos=${esc(tos.slug)}">Сообщить об ошибке</a><button class="btn" onclick="window.print()">Распечатать карточку</button></div></div></section>

    <section class="section"><div class="container grid"><article class="card full"><div class="card-inner"><h2>Паспорт ТОС</h2><div class="kpi"><div class="tile"><b>${esc(tos.population || '—')}</b><span>примерно жителей</span></div><div class="tile"><b>${esc(tos.founded || '—')}</b><span>год создания</span></div><div class="tile"><b>${esc(tos.type || 'ТОС')}</b><span>тип ТОС</span></div><div class="tile"><b>${esc(qualityText)}</b><span>заполненность карточки</span></div></div><hr class="sep"/><div class="grid"><article class="card"><div class="card-inner"><h3>Территория</h3><p><b>Населённый пункт:</b> ${esc(tos.location || 'уточняется')}</p><p><b>Границы:</b> ${esc(tos.boundaries || 'уточняются')}</p></div></article><article class="card"><div class="card-inner"><h3>Контакты</h3><p><b>Председатель:</b> ${esc(tos.chairperson || 'уточняется')}</p><p><b>Телефон:</b> ${esc(phones.join(', ') || 'уточняется')}</p><p><b>Email:</b> ${esc(emails.join(', ') || 'уточняется')}</p></div></article><article class="card"><div class="card-inner"><h3>Публичность</h3><p><b>Соцсети:</b> ${esc(socialLinks.length ? socialLinks.map(socialName).join(', ') : 'уточняются')}</p><p><b>Обновлено:</b> ${esc(tos.updated_at || 'дата уточняется')}</p><p><b>Источник:</b> ${esc(tos.source_label || tos.source || 'уточняется')}</p></div></article></div><div class="notice"><b style="color:var(--text)">Если вы живёте на этой территории</b><br>Вы можете прислать новость, фото, идею проекта, уточнение контактов или потребность для публикации на портале.</div></div></article></div></section>

    ${clarifyBlock(tos, qualityText)}

    <section class="section"><div class="container grid"><div class="card full"><div class="card-inner"><div class="prose"><h2>Описание</h2><p>${esc(tos.description || 'Описание пока уточняется.')}</p><h2>Председатель</h2><p>${esc(tos.chairperson || 'Информация уточняется')}</p><h2>Контакты председателя</h2><ul>${renderList(phones, p => `<li><a href="tel:${esc(phoneHref(p))}">${esc(p)}</a></li>`, '')}${renderList(emails, e => `<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`, '')}${renderList(chairLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">Профиль/ссылка — ${esc(u)}</a></li>`, '')}${(!phones.length && !emails.length && !chairLinks.length) ? '<li>Контакты уточняются</li>' : ''}</ul><h2>Сообщества ТОС</h2><ul>${renderList(socialLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(socialName(u))} — ${esc(u)}</a></li>`)}</ul><p class="tiny">Исходные контакты из анкеты: ${esc(tos.contacts_raw || '—')}</p><p class="tiny">Источник/обновление: ${esc(tos.updated_at || 'дата уточняется')}</p></div><hr class="sep"/><div class="card-actions"><a class="btn" href="/tos/">← В каталог</a><a class="btn" href="/update-tos/?tos=${esc(tos.slug)}">Сообщить об ошибке</a><a class="btn" href="/contacts/">Предложить новость</a></div></div></div></div></section>

    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Как помочь этому ТОС</h2><p>Карточка ТОС — не только справочник, но и точка действия для жителей, председателя и партнёров</p></div><a class="btn" href="/partners/">Партнёрам</a></div><div class="container grid">${actions}</div></section>

    <section class="section"><div class="container section-head"><div><h2>Связанные разделы</h2><p>Все материалы, которые могут относиться к этому ТОСу</p></div></div><div class="container grid"><article class="card"><div class="card-inner"><h3>Новости</h3><p>Публикации, события, объявления и фотоотчёты территории.</p><a class="btn" href="/news/">Открыть</a></div></article><article class="card"><div class="card-inner"><h3>Проекты</h3><p>Идеи, планы и инициативы, которые можно обсуждать с жителями.</p><a class="btn" href="/projects/">Открыть</a></div></article><article class="card"><div class="card-inner"><h3>Потребности</h3><p>Материалы, волонтёры, техника, фото, тексты и другая помощь.</p><a class="btn" href="/needs/">Открыть</a></div></article><article class="card"><div class="card-inner"><h3>Сделано</h3><p>Истории результата: было, сделали, кто участвовал и что получилось.</p><a class="btn" href="/done/">Открыть</a></div></article></div></section>

    ${block('Новости этого ТОС', 'Публикации, привязанные к этой территории через tos_slug.', 'Все новости', '/news/', relNews, 'list')}
    ${block('События этого ТОС', 'Собрания, субботники, дедлайны и мероприятия территории.', 'Календарь', '/calendar/', relEvents, 'list')}
    ${block('Проекты этого ТОС', 'Идеи, планы и реализованные инициативы.', 'Все проекты', '/projects/', relProjects, 'grid')}
    ${block('Сделано этим ТОС', 'Истории результата, которые уже есть в архиве портала.', 'Все истории', '/done/', relDone, 'list')}
    ${block('Актуальные потребности этого ТОС', 'Где территории нужна помощь жителей, партнёров или волонтёров.', 'Все потребности', '/needs/', relNeeds, 'list')}
  </main>
  <footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Данные страницы обновляются автоматически из JSON-файлов сайта.</div></div></footer>
  <script src="/assets/js/site.js"></script><script src="/assets/js/tos-logos.js"></script>
</body></html>`;
}

function writeFile(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, 'utf8'); }
function updateSitemap(toses) {
  const baseUrls = ['/', '/tos/', '/residents/', '/partners/', '/news/', '/grants/', '/projects/', '/done/', '/calendar/', '/needs/', '/materials/', '/documents/', '/legal/', '/legal/federal-law-33/', '/places/', '/sources/', '/data-quality/', '/methodology/', '/glossary/', '/privacy/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/editorial-policy/', '/search/', '/sections/'].map(u => `${SITE_URL}${u}`);
  const tosUrls = toses.filter(t => t.slug && t.status !== 'draft').map(t => `${SITE_URL}/tos/${t.slug}/`);
  const urls = [...new Set([...baseUrls, ...tosUrls])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function main() {
  const toses = readJson(TOSES_PATH).filter(t => t.slug && t.status !== 'draft');
  const data = { news: readJson(NEWS_PATH), projects: readJson(PROJECTS_PATH), done: readJson(DONE_PATH), events: readJson(EVENTS_PATH), needs: readJson(NEEDS_PATH) };
  for (const tos of toses) writeFile(path.join(ROOT, 'tos', tos.slug, 'index.html'), makePage(tos, data));
  updateSitemap(toses);
  console.log(`Generated TOS pages: ${toses.length}`);
}
main();
