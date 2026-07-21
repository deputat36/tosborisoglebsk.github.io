const fs = require('fs');
const path = require('path');
const { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const EVENTS_PATH = path.join(ROOT, 'data', 'events.json');
const NEEDS_PATH = path.join(ROOT, 'data', 'needs.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const DETAIL_TRUST_VERSION = '2026-07-12';
const RELATED_CONTENT_TRUST_VERSION = '2026-07-21';

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
function compactText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const boundary = sliced.lastIndexOf(' ');
  const base = sliced.slice(0, boundary > 50 ? boundary : sliced.length).replace(/[,:;.!?\s]+$/u, '');
  return `${base}…`;
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
  const trust = tos.trust || {};
  const scope = arr(trust.verification_scope);
  if (!arr(tos.phones).length) list.push('телефон для открытой публикации');
  if (!arr(tos.social_links).length) list.push('ссылка на группу, чат или страницу ТОС');
  if (!tos.logo) list.push('реальный логотип ТОС');
  if (!tos.description || tos.description === 'Описание пока уточняется.') list.push('краткое описание деятельности');
  if (!tos.boundaries) list.push('границы территории');
  if (!tos.founded) list.push('год создания');
  if (!tos.population) list.push('примерная численность жителей');
  if (!trust.checked_at || !trust.source_ref || !scope.length) list.push('источник, дату и объём фактической проверки');
  return list;
}
function updateUrl(tos, type = 'card') {
  return `/update-tos/?tos=${encodeURIComponent(tos.slug)}&type=${encodeURIComponent(type)}#message-builder`;
}
const verificationLabels = {
  verified: 'Сведения подтверждены',
  partial: 'Проверено частично',
  needs_review: 'Требует проверки',
  stale: 'Нужно перепроверить'
};
function trustData(tos) {
  const trust = tos.trust && typeof tos.trust === 'object' ? tos.trust : {};
  return {
    sourceType: trust.source_type || '',
    sourceRef: trust.source_ref || '',
    checkedAt: trust.checked_at || '',
    checkedBy: trust.checked_by || '',
    recheckAfter: trust.recheck_after || '',
    scope: arr(trust.verification_scope),
    consentRef: trust.publication_consent_ref || ''
  };
}
function verificationInfo(tos) {
  const trust = trustData(tos);
  const allowed = ['verified', 'partial', 'needs_review', 'stale'];
  let status = allowed.includes(tos.verification_status) ? tos.verification_status : 'needs_review';
  if (trust.recheckAfter && status !== 'needs_review') {
    const recheck = new Date(`${trust.recheckAfter}T00:00:00`);
    if (!Number.isNaN(recheck.getTime()) && recheck.getTime() < Date.now()) status = 'stale';
  }
  return {
    status,
    label: verificationLabels[status] || verificationLabels.needs_review,
    date: trust.checkedAt,
    source: trust.sourceRef,
    sourceType: trust.sourceType,
    checkedBy: trust.checkedBy,
    recheckAfter: trust.recheckAfter,
    scope: trust.scope,
    consentRef: trust.consentRef
  };
}
function verificationClass(status) {
  if (status === 'verified') return 'ok';
  if (status === 'partial') return 'info';
  if (status === 'needs_review' || status === 'stale') return 'warn';
  return '';
}
function fieldIsVerified(tos, field) {
  const trust = trustData(tos);
  return Boolean(trust.checkedAt && trust.sourceRef && trust.scope.includes(field));
}
function scopeInfo(tos, fields) {
  const trust = trustData(tos);
  const matched = fields.filter(field => trust.scope.includes(field));
  if (!trust.checkedAt || !trust.sourceRef || !matched.length) {
    return { className: 'warn', label: 'Поля не подтверждены отдельно', text: 'Источник и дата проверки этих полей не зафиксированы.' };
  }
  if (matched.length === fields.length) {
    return { className: 'ok', label: 'Поля проверены', text: `Проверено ${niceDate(trust.checkedAt)}. Объём: ${matched.join(', ')}.` };
  }
  return { className: 'info', label: 'Проверено частично', text: `Проверено ${niceDate(trust.checkedAt)}: ${matched.join(', ')}.` };
}
function scopeBlock(name, info) {
  return `<div class="meta" data-verification-block="${esc(name)}"><span class="tag ${verificationClass(info.className === 'ok' ? 'verified' : info.className === 'info' ? 'partial' : 'needs_review')}">${esc(info.label)}</span></div><p class="tiny">${esc(info.text)}</p>`;
}
function verificationBlock(tos, info) {
  const details = [
    info.date ? `Дата фактической проверки: ${niceDate(info.date)}` : 'Дата фактической проверки не указана',
    info.source ? `Источник подтверждения: ${info.source}` : 'Источник подтверждения не указан',
    info.scope.length ? `Проверенные поля: ${info.scope.join(', ')}` : 'Объём проверки не зафиксирован',
    info.recheckAfter ? `Перепроверить после: ${niceDate(info.recheckAfter)}` : ''
  ].filter(Boolean).join(' · ');
  const actionText = info.status === 'verified'
    ? 'Если сведения изменились, отправьте обновление через конструктор.'
    : 'Техническая публикация карточки не подтверждает актуальность председателя, контактов или границ.';
  return `<div class="notice"><b style="color:var(--text)">Статус сведений: ${esc(info.label)}</b><br>${esc(details)}<br>${esc(actionText)}</div>`;
}
function clarifyBlock(tos, qualityScore, verification) {
  const missing = missingFields(tos);
  const items = missing.map(item => `<li>${esc(item)}</li>`).join('');
  const message = missing.length
    ? `<p>Карточка опубликована, но до подтверждения нужно уточнить:</p><ul>${items}</ul>`
    : '<p>Основные поля заполнены и доказательная проверка зафиксирована.</p>';
  return `<section class="section tight"><div class="container grid"><article class="card full"><div class="card-inner"><div class="meta"><span class="tag">Проверка данных</span><span class="tag ${verificationClass(verification.status)}">${esc(verification.label)}</span></div><h2>Что нужно уточнить</h2>${message}<p class="tiny">Техническая заполненность полей: ${esc(qualityScore)}%. Это не является подтверждением актуальности.</p><div class="notice"><b style="color:var(--text)">Как помочь</b><br>Пришлите только данные, которые можно размещать открыто, и укажите, откуда они получены.</div><div class="card-actions"><a class="btn primary" href="${esc(updateUrl(tos, 'card'))}">Прислать уточнение</a></div><p class="tiny"><a href="/data-quality/">Состояние данных</a> · <a href="/sources/">Правила источников</a></p></div></article></div></section>`;
}
function relatedTrust(item, collection) {
  const origin = inferContentOrigin(item, collection);
  return {
    origin,
    label: contentOriginLabel(origin),
    className: contentOriginClass(origin),
    notice: contentOriginNotice(origin, collection)
  };
}
function relatedAttributes(item, collection, origin = '') {
  return `data-related-collection="${esc(collection)}" data-related-id="${esc(item.id || '')}" data-related-tos="${esc(item.tos_slug || '')}"${origin ? ` data-content-origin="${esc(origin)}"` : ''}`;
}
function relatedOriginNotice(item, collection, trust) {
  return `<p class="tiny" data-related-origin-notice="${esc(`${collection}:${item.id || ''}`)}">${esc(trust.notice)}</p>`;
}
function newsCard(n) {
  const trust = relatedTrust(n, 'news');
  return `<article class="list-item" ${relatedAttributes(n, 'news', trust.origin)}><div class="meta"><span class="tag">${esc(n.category || 'Новость')}</span><span class="tag ${esc(trust.className)}">${esc(trust.label)}</span><span class="tag">${esc(niceDate(n.date))}</span></div><h3>${esc(n.title || 'Новость')}</h3><p>${esc(n.lead || '')}</p>${relatedOriginNotice(n, 'news', trust)}<div class="card-actions"><a class="btn" href="/news/${esc(n.id)}/">Открыть запись</a>${n.source_url ? `<a class="btn" href="${esc(n.source_url)}" target="_blank" rel="noopener">Источник</a>` : ''}</div></article>`;
}
function eventCard(e) {
  return `<article class="list-item" ${relatedAttributes(e, 'events')}><div class="meta"><span class="tag">${esc(e.type || 'Событие')}</span><span class="tag">${esc(niceDate(e.date))}${e.time ? ' · ' + esc(e.time) : ''}</span></div><h3>${esc(e.title || 'Событие')}</h3><p>${esc(e.description || '')}</p><p class="tiny"><b>Место:</b> ${esc(e.place || 'Уточняется')}</p><div class="card-actions"><a class="btn" href="/calendar/">Календарь</a></div></article>`;
}
function projectCard(p) {
  const trust = relatedTrust(p, 'projects');
  const steps = arr(p.steps).slice(0, 4).map(s => `<li>${esc(s)}</li>`).join('');
  return `<article class="card" ${relatedAttributes(p, 'projects', trust.origin)}><div class="card-inner"><div class="meta"><span class="tag">${esc(p.type || 'Проект')}</span><span class="tag ${esc(trust.className)}">${esc(trust.label)}</span></div><h3>${esc(p.title || 'Проект')}</h3><p>${esc(p.description || '')}</p>${relatedOriginNotice(p, 'projects', trust)}${steps ? `<hr class="sep"/><ul class="tiny">${steps}</ul>` : ''}<div class="card-actions"><a class="btn" href="/projects/${esc(p.id)}/">Открыть запись</a></div></div></article>`;
}
function doneCard(d) {
  const trust = relatedTrust(d, 'done');
  return `<article class="list-item" ${relatedAttributes(d, 'done', trust.origin)}><div class="meta"><span class="tag">${esc(d.type || 'Сделано')}</span><span class="tag ${esc(trust.className)}">${esc(trust.label)}</span><span class="tag">${esc(niceDate(d.date))}</span></div><h3>${esc(d.title || 'История ТОС')}</h3><p>${esc(d.summary || '')}</p>${relatedOriginNotice(d, 'done', trust)}<div class="grid"><article class="card"><div class="card-inner"><span class="tag">Было</span><p>${esc(d.before || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Сделали</span><p>${esc(d.done || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Результат</span><p>${esc(d.result || 'Информация уточняется.')}</p></div></article></div><div class="card-actions"><a class="btn" href="/done/${esc(d.id)}/">Открыть запись</a><a class="btn" href="${esc(updateUrl({ slug: d.tos_slug || '' }, 'photo'))}">Прислать фото</a></div></article>`;
}
function needCard(n) {
  const trust = relatedTrust(n, 'needs');
  return `<article class="list-item" ${relatedAttributes(n, 'needs', trust.origin)}><div class="meta"><span class="tag">${esc(n.need_type || 'Помощь')}</span><span class="tag ${n.priority === 'Высокий' ? 'warn' : ''}">${esc(n.priority || 'Приоритет уточняется')}</span><span class="tag ${esc(trust.className)}">${esc(trust.label)}</span></div><h3>${esc(n.title || 'Потребность')}</h3><p>${esc(n.description || '')}</p>${relatedOriginNotice(n, 'needs', trust)}<p class="tiny" data-related-contact-policy="${esc(n.id || '')}">Контакт и способ помощи доступны в основной записи после проверки статуса материала.</p><div class="card-actions"><a class="btn" href="/needs/${esc(n.id)}/">Открыть запись</a><a class="btn" href="/contacts/">Предложить помощь</a></div></article>`;
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
  const seoDesc = compactText(desc, 155);
  const canonical = `${SITE_URL}/tos/${tos.slug}/`;
  const logo = logoPath(tos);
  const phones = arr(tos.phones);
  const emails = arr(tos.emails);
  const chairLinks = arr(tos.chairperson_links);
  const socialLinks = arr(tos.social_links);
  const trust = trustData(tos);
  const verifiedPhones = fieldIsVerified(tos, 'phones') && trust.consentRef ? phones : [];
  const verifiedSameAs = [
    ...(fieldIsVerified(tos, 'chairperson') && trust.consentRef ? chairLinks : []),
    ...(fieldIsVerified(tos, 'social_links') ? socialLinks : [])
  ];
  const relNews = related(data.news, tos.slug, 6).map(newsCard).join('');
  const relEvents = related(data.events, tos.slug, 6, byDateAsc).map(eventCard).join('');
  const relProjects = related(data.projects, tos.slug, 6).map(projectCard).join('');
  const relDone = related(data.done, tos.slug, 4).map(doneCard).join('');
  const relNeeds = related(data.needs, tos.slug, 6).map(needCard).join('');
  const qualityScore = calcQuality(tos);
  const verification = verificationInfo(tos);
  const territoryScope = scopeInfo(tos, ['location', 'boundaries']);
  const contactsScope = scopeInfo(tos, ['chairperson', 'phones', 'emails']);
  const publicScope = scopeInfo(tos, ['social_links', 'logo']);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: `ТОС «${tos.name}»`,
        url: canonical,
        logo: `${SITE_URL}${logo}`,
        areaServed: tos.location || 'Борисоглебский городской округ',
        description: seoDesc,
        sameAs: verifiedSameAs,
        ...(verifiedPhones.length ? { contactPoint: verifiedPhones.map(phone => ({ '@type': 'ContactPoint', telephone: phone, contactType: 'председатель' })) } : {})
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

  const actions = `<article class="card"><div class="card-inner"><h3>Уточнить карточку</h3><p>Исправьте председателя, контакты, границы или описание и укажите источник сведений.</p><a class="btn primary" href="${esc(updateUrl(tos, 'card'))}">Передать уточнение</a></div></article><article class="card"><div class="card-inner"><h3>Рассказать о работе ТОС</h3><p>Передайте новость о событии или фотоотчёт о результате.</p><a class="btn" href="${esc(updateUrl(tos, 'news'))}">Прислать новость</a><p class="tiny"><a href="${esc(updateUrl(tos, 'photo'))}">Передать фотоотчёт</a></p></div></article><article class="card"><div class="card-inner"><h3>Предложить действие</h3><p>Опишите идею проекта или подтверждённую потребность территории.</p><a class="btn" href="${esc(updateUrl(tos, 'project'))}">Предложить проект</a><p class="tiny"><a href="${esc(updateUrl(tos, 'need'))}">Оформить потребность</a></p></div></article>`;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(seoDesc)}"/>
  <meta name="theme-color" content="#2f7d5a"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(seoDesc)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:image" content="${esc(`${SITE_URL}${logo}`)}"/>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <link rel="manifest" href="/site.webmanifest"/>
  <link rel="stylesheet" href="/assets/css/styles.css"/>
  <link rel="stylesheet" href="/assets/css/tos-detail-responsive.css"/>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>
  <main id="main">
    <section class="hero"><div class="container hero-card"><a class="chip" href="/tos/">← Каталог ТОС</a><h1>ТОС «${esc(tos.name)}»</h1><p class="lead">${esc(tos.location || 'Борисоглебский городской округ')}</p><div class="hero-actions"><a class="btn primary" href="${esc(updateUrl(tos, 'card'))}">Сообщить об ошибке</a><button class="btn" type="button" onclick="window.print()">Распечатать</button></div></div></section>

    <section class="section"><div class="container grid"><article class="card full"><div class="card-inner"><h2>Паспорт ТОС</h2><div class="kpi"><div class="tile"><b>${esc(tos.population || '—')}</b><span>примерно жителей</span></div><div class="tile"><b>${esc(tos.founded || '—')}</b><span>год создания</span></div><div class="tile"><b>${esc(tos.type || 'ТОС')}</b><span>тип ТОС</span></div><div class="tile"><b>${esc(verification.label)}</b><span>статус сведений</span></div></div><hr class="sep"/><div class="grid"><article class="card"><div class="card-inner"><h3>Территория</h3>${scopeBlock('territory', territoryScope)}<p><b>Населённый пункт:</b> ${esc(tos.location || 'уточняется')}</p><p><b>Границы:</b> ${esc(tos.boundaries || 'уточняются')}</p></div></article><article class="card"><div class="card-inner"><h3>Председатель и контакты</h3>${scopeBlock('contacts', contactsScope)}<p><b>Председатель:</b> ${esc(tos.chairperson || 'уточняется')}</p><p><b>Телефон:</b></p><ul>${renderList(phones, p => `<li><a href="tel:${esc(phoneHref(p))}">${esc(p)}</a></li>`, '<li>Телефон уточняется</li>')}</ul><p><b>Email:</b></p><ul>${renderList(emails, e => `<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`, '<li>Email уточняется</li>')}</ul><p><b>Публичная ссылка председателя:</b></p><ul>${renderList(chairLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">Открыть ссылку</a></li>`, '<li>Ссылка уточняется</li>')}</ul></div></article><article class="card"><div class="card-inner"><h3>Публичные ссылки</h3>${scopeBlock('public-links', publicScope)}<ul>${renderList(socialLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(socialName(u))}</a></li>`, '<li>Соцсети уточняются</li>')}</ul><p class="tiny"><b>Технически обновлено:</b> ${esc(tos.updated_at || 'дата уточняется')}. Эта дата не является проверкой сведений.</p></div></article></div>${verificationBlock(tos, verification)}<div class="notice"><b style="color:var(--text)">О территории</b><br>${esc(tos.description || 'Описание пока уточняется.')}</div></div></article></div></section>

    ${clarifyBlock(tos, qualityScore, verification)}


    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Передать сведения или инициативу</h2><p>Выберите один подходящий сценарий и не отправляйте закрытые персональные данные.</p></div><a class="btn" href="/partners/">Партнёрам</a></div><div class="container grid">${actions}</div></section>


    ${block('Новости и материалы этого ТОС', 'Публикации, связанные с территорией по данным портала.', 'Все новости', '/news/', relNews, 'list')}
    ${block('События и даты этого ТОС', 'Записи календаря, связанные с территорией; перед участием проверяйте источник и дату.', 'Календарь', '/calendar/', relEvents, 'list')}
    ${block('Проекты и идеи этого ТОС', 'Карточки могут быть подтверждёнными материалами, редакционными описаниями или стартовыми идеями.', 'Все проекты', '/projects/', relProjects, 'grid')}
    ${block('Результаты и запросы этого ТОС', 'Истории и запросы материалов; подтверждённость указана в самой записи.', 'Все истории', '/done/', relDone, 'list')}
    ${block('Потребности и запросы этого ТОС', 'Перед передачей помощи проверьте статус, получателя и актуальность записи.', 'Все потребности', '/needs/', relNeeds, 'list')}
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
