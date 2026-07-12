const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'scripts', 'generate_tos_pages.js');
if (!fs.existsSync(filePath)) throw new Error('Missing scripts/generate_tos_pages.js');

let source = fs.readFileSync(filePath, 'utf8');
const marker = "const DETAIL_TRUST_VERSION = '2026-07-12';";

if (source.includes(marker)) {
  console.log('TOS detail generator trust focus already applied');
  process.exit(0);
}

function replaceOrFail(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS detail generator patch marker not found: ${label}`);
  source = source.replace(pattern, replacement);
}

replaceOrFail(
  /(const SITEMAP_PATH = path\.join\(ROOT, 'sitemap\.xml'\);)/,
  `$1\n${marker}`,
  'version marker'
);

replaceOrFail(
  /function missingFields\(tos\) \{[\s\S]*?\n\}\nfunction updateUrl/,
  `function missingFields(tos) {
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
function updateUrl`,
  'missing fields'
);

replaceOrFail(
  /const verificationLabels = \{[\s\S]*?\nfunction newsCard/,
  `const verificationLabels = {
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
    const recheck = new Date(\`\${trust.recheckAfter}T00:00:00\`);
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
    return { className: 'ok', label: 'Поля проверены', text: \`Проверено \${niceDate(trust.checkedAt)}. Объём: \${matched.join(', ')}.\` };
  }
  return { className: 'info', label: 'Проверено частично', text: \`Проверено \${niceDate(trust.checkedAt)}: \${matched.join(', ')}.\` };
}
function scopeBlock(name, info) {
  return \`<div class="meta" data-verification-block="\${esc(name)}"><span class="tag \${verificationClass(info.className === 'ok' ? 'verified' : info.className === 'info' ? 'partial' : 'needs_review')}">\${esc(info.label)}</span></div><p class="tiny">\${esc(info.text)}</p>\`;
}
function verificationBlock(tos, info) {
  const details = [
    info.date ? \`Дата фактической проверки: \${niceDate(info.date)}\` : 'Дата фактической проверки не указана',
    info.source ? \`Источник подтверждения: \${info.source}\` : 'Источник подтверждения не указан',
    info.scope.length ? \`Проверенные поля: \${info.scope.join(', ')}\` : 'Объём проверки не зафиксирован',
    info.recheckAfter ? \`Перепроверить после: \${niceDate(info.recheckAfter)}\` : ''
  ].filter(Boolean).join(' · ');
  const actionText = info.status === 'verified'
    ? 'Если сведения изменились, отправьте обновление через конструктор.'
    : 'Техническая публикация карточки не подтверждает актуальность председателя, контактов или границ.';
  return \`<div class="notice"><b style="color:var(--text)">Статус сведений: \${esc(info.label)}</b><br>\${esc(details)}<br>\${esc(actionText)}</div>\`;
}
function clarifyBlock(tos, qualityScore, verification) {
  const missing = missingFields(tos);
  const items = missing.map(item => \`<li>\${esc(item)}</li>\`).join('');
  const message = missing.length
    ? \`<p>Карточка опубликована, но до подтверждения нужно уточнить:</p><ul>\${items}</ul>\`
    : '<p>Основные поля заполнены и доказательная проверка зафиксирована.</p>';
  return \`<section class="section tight"><div class="container grid"><article class="card full"><div class="card-inner"><div class="meta"><span class="tag">Проверка данных</span><span class="tag \${verificationClass(verification.status)}">\${esc(verification.label)}</span></div><h2>Что нужно уточнить</h2>\${message}<p class="tiny">Техническая заполненность полей: \${esc(qualityScore)}%. Это не является подтверждением актуальности.</p><div class="notice"><b style="color:var(--text)">Как помочь</b><br>Пришлите только данные, которые можно размещать открыто, и укажите, откуда они получены.</div><div class="card-actions"><a class="btn primary" href="\${esc(updateUrl(tos, 'card'))}">Прислать уточнение</a></div><p class="tiny"><a href="/data-quality/">Состояние данных</a> · <a href="/sources/">Правила источников</a></p></div></article></div></section>\`;
}
function newsCard`,
  'verification helpers'
);

replaceOrFail(
  /  const sameAs = \[\.\.\.chairLinks, \.\.\.socialLinks\];/,
  `  const trust = trustData(tos);
  const verifiedPhones = fieldIsVerified(tos, 'phones') && trust.consentRef ? phones : [];
  const verifiedSameAs = [
    ...(fieldIsVerified(tos, 'chairperson') && trust.consentRef ? chairLinks : []),
    ...(fieldIsVerified(tos, 'social_links') ? socialLinks : [])
  ];`,
  'structured trust variables'
);

replaceOrFail(
  /  const qualityScore = calcQuality\(tos\);\n  const qualityText = `\$\{qualityScore\}% — \$\{qualityLabel\(qualityScore\)\}`;\n  const verification = verificationInfo\(tos, qualityScore\);/,
  `  const qualityScore = calcQuality(tos);
  const verification = verificationInfo(tos);
  const territoryScope = scopeInfo(tos, ['location', 'boundaries']);
  const contactsScope = scopeInfo(tos, ['chairperson', 'phones', 'emails']);
  const publicScope = scopeInfo(tos, ['social_links', 'logo']);`,
  'page trust variables'
);

replaceOrFail(
  /        sameAs,\n        contactPoint: phones\.map\(phone => \(\{ '@type': 'ContactPoint', telephone: phone, contactType: 'председатель' \}\)\)/,
  `        sameAs: verifiedSameAs,
        ...(verifiedPhones.length ? { contactPoint: verifiedPhones.map(phone => ({ '@type': 'ContactPoint', telephone: phone, contactType: 'председатель' })) } : {})`,
  'structured contacts'
);

replaceOrFail(
  /  const actions = \[[\s\S]*?\n  \]\.join\(''\);/,
  `  const actions = \`<article class="card"><div class="card-inner"><h3>Уточнить карточку</h3><p>Исправьте председателя, контакты, границы или описание и укажите источник сведений.</p><a class="btn primary" href="\${esc(updateUrl(tos, 'card'))}">Передать уточнение</a></div></article><article class="card"><div class="card-inner"><h3>Рассказать о работе ТОС</h3><p>Передайте новость о событии или фотоотчёт о результате.</p><a class="btn" href="\${esc(updateUrl(tos, 'news'))}">Прислать новость</a><p class="tiny"><a href="\${esc(updateUrl(tos, 'photo'))}">Передать фотоотчёт</a></p></div></article><article class="card"><div class="card-inner"><h3>Предложить действие</h3><p>Опишите идею проекта или подтверждённую потребность территории.</p><a class="btn" href="\${esc(updateUrl(tos, 'project'))}">Предложить проект</a><p class="tiny"><a href="\${esc(updateUrl(tos, 'need'))}">Оформить потребность</a></p></div></article>\`;`,
  'focused actions'
);

replaceOrFail(
  /    <section class="hero">[\s\S]*?<\/section>/,
  `    <section class="hero"><div class="container hero-card"><a class="chip" href="/tos/">← Каталог ТОС</a><h1>ТОС «\${esc(tos.name)}»</h1><p class="lead">\${esc(tos.location || 'Борисоглебский городской округ')}</p><div class="hero-actions"><a class="btn primary" href="\${esc(updateUrl(tos, 'card'))}">Сообщить об ошибке</a><button class="btn" type="button" onclick="window.print()">Распечатать</button></div></div></section>`,
  'focused hero'
);

replaceOrFail(
  /    <section class="section"><div class="container grid"><article class="card full"><div class="card-inner"><h2>Паспорт ТОС<\/h2>[\s\S]*?<\/section>/,
  `    <section class="section"><div class="container grid"><article class="card full"><div class="card-inner"><h2>Паспорт ТОС</h2><div class="kpi"><div class="tile"><b>\${esc(tos.population || '—')}</b><span>примерно жителей</span></div><div class="tile"><b>\${esc(tos.founded || '—')}</b><span>год создания</span></div><div class="tile"><b>\${esc(tos.type || 'ТОС')}</b><span>тип ТОС</span></div><div class="tile"><b>\${esc(verification.label)}</b><span>статус сведений</span></div></div><hr class="sep"/><div class="grid"><article class="card"><div class="card-inner"><h3>Территория</h3>\${scopeBlock('territory', territoryScope)}<p><b>Населённый пункт:</b> \${esc(tos.location || 'уточняется')}</p><p><b>Границы:</b> \${esc(tos.boundaries || 'уточняются')}</p></div></article><article class="card"><div class="card-inner"><h3>Председатель и контакты</h3>\${scopeBlock('contacts', contactsScope)}<p><b>Председатель:</b> \${esc(tos.chairperson || 'уточняется')}</p><p><b>Телефон:</b></p><ul>\${renderList(phones, p => \`<li><a href="tel:\${esc(phoneHref(p))}">\${esc(p)}</a></li>\`, '<li>Телефон уточняется</li>')}</ul><p><b>Email:</b></p><ul>\${renderList(emails, e => \`<li><a href="mailto:\${esc(e)}">\${esc(e)}</a></li>\`, '<li>Email уточняется</li>')}</ul><p><b>Публичная ссылка председателя:</b></p><ul>\${renderList(chairLinks, u => \`<li><a href="\${esc(u)}" target="_blank" rel="noopener">Открыть ссылку</a></li>\`, '<li>Ссылка уточняется</li>')}</ul></div></article><article class="card"><div class="card-inner"><h3>Публичные ссылки</h3>\${scopeBlock('public-links', publicScope)}<ul>\${renderList(socialLinks, u => \`<li><a href="\${esc(u)}" target="_blank" rel="noopener">\${esc(socialName(u))}</a></li>\`, '<li>Соцсети уточняются</li>')}</ul><p class="tiny"><b>Технически обновлено:</b> \${esc(tos.updated_at || 'дата уточняется')}. Эта дата не является проверкой сведений.</p></div></article></div>\${verificationBlock(tos, verification)}<div class="notice"><b style="color:var(--text)">О территории</b><br>\${esc(tos.description || 'Описание пока уточняется.')}</div></div></article></div></section>`,
  'focused passport'
);

replaceOrFail(
  /    \$\{clarifyBlock\(tos, qualityText\)\}/,
  `    \${clarifyBlock(tos, qualityScore, verification)}`,
  'clarification call'
);

replaceOrFail(
  /\n    <section class="section"><div class="container grid"><div class="card full"><div class="card-inner"><div class="prose"><h2>Описание<\/h2>[\s\S]*?<\/section>\n/,
  '\n',
  'duplicate contact section'
);

replaceOrFail(
  /    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Как помочь этому ТОС<\/h2><p>[\s\S]*?<\/div><a class="btn" href="\/partners\/">Партнёрам<\/a><\/div><div class="container grid">\$\{actions\}<\/div><\/section>/,
  `    <section class="section" id="help-this-tos"><div class="container section-head"><div><h2>Передать сведения или инициативу</h2><p>Выберите один подходящий сценарий и не отправляйте закрытые персональные данные.</p></div><a class="btn" href="/partners/">Партнёрам</a></div><div class="container grid">\${actions}</div></section>`,
  'focused action section'
);

replaceOrFail(
  /\n    <section class="section"><div class="container section-head"><div><h2>Связанные разделы<\/h2>[\s\S]*?<\/section>\n/,
  '\n',
  'generic related links'
);

source = source
  .replace("block('Новости этого ТОС', 'Публикации, привязанные к этой территории через tos_slug.'", "block('Новости и материалы этого ТОС', 'Публикации, связанные с территорией по данным портала.'")
  .replace("block('События этого ТОС', 'Собрания, субботники, дедлайны и мероприятия территории.'", "block('События и даты этого ТОС', 'Записи календаря, связанные с территорией; перед участием проверяйте источник и дату.'")
  .replace("block('Проекты этого ТОС', 'Идеи, планы и реализованные инициативы.'", "block('Проекты и идеи этого ТОС', 'Карточки могут быть подтверждёнными материалами, редакционными описаниями или стартовыми идеями.'")
  .replace("block('Сделано этим ТОС', 'Истории результата, которые уже есть в архиве портала.'", "block('Результаты и запросы этого ТОС', 'Истории и запросы материалов; подтверждённость указана в самой записи.'")
  .replace("block('Актуальные потребности этого ТОС', 'Где территории нужна помощь жителей, партнёров или волонтёров.'", "block('Потребности и запросы этого ТОС', 'Перед передачей помощи проверьте статус, получателя и актуальность записи.'");

if (source.includes('if (date && qualityScore >= 80)') || source.includes("tos.updated_at || ''")) {
  throw new Error('Legacy verification inference remains in TOS generator');
}
if (source.includes('Исходные контакты из анкеты')) {
  throw new Error('Raw questionnaire contacts remain in public TOS template');
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('TOS detail generator trust focus applied');
