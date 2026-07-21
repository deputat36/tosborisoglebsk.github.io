const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const MARKER = "const RELATED_CONTENT_TRUST_VERSION = '2026-07-21';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS related-content patch marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (current.includes(MARKER)) return { content: current, changed: false };

  let source = current;
  source = replaceOrFail(
    source,
    /const path = require\('path'\);/,
    `const path = require('path');\nconst { inferContentOrigin, contentOriginLabel, contentOriginClass, contentOriginNotice } = require('./lib/content_origin');`,
    'content origin import'
  );
  source = replaceOrFail(
    source,
    /(const DETAIL_TRUST_VERSION = '2026-07-12';)/,
    `$1\n${MARKER}`,
    'version marker'
  );
  source = replaceOrFail(
    source,
    /function newsCard\(n\) \{[\s\S]*?\n\}\nfunction block/,
    `function relatedTrust(item, collection) {
  const origin = inferContentOrigin(item, collection);
  return {
    origin,
    label: contentOriginLabel(origin),
    className: contentOriginClass(origin),
    notice: contentOriginNotice(origin, collection)
  };
}
function relatedAttributes(item, collection, origin = '') {
  return \`data-related-collection="\${esc(collection)}" data-related-id="\${esc(item.id || '')}" data-related-tos="\${esc(item.tos_slug || '')}"\${origin ? \` data-content-origin="\${esc(origin)}"\` : ''}\`;
}
function relatedOriginNotice(item, collection, trust) {
  return \`<p class="tiny" data-related-origin-notice="\${esc(\`\${collection}:\${item.id || ''}\`)}">\${esc(trust.notice)}</p>\`;
}
function newsCard(n) {
  const trust = relatedTrust(n, 'news');
  return \`<article class="list-item" \${relatedAttributes(n, 'news', trust.origin)}><div class="meta"><span class="tag">\${esc(n.category || 'Новость')}</span><span class="tag \${esc(trust.className)}">\${esc(trust.label)}</span><span class="tag">\${esc(niceDate(n.date))}</span></div><h3>\${esc(n.title || 'Новость')}</h3><p>\${esc(n.lead || '')}</p>\${relatedOriginNotice(n, 'news', trust)}<div class="card-actions"><a class="btn" href="/news/\${esc(n.id)}/">Открыть запись</a>\${n.source_url ? \`<a class="btn" href="\${esc(n.source_url)}" target="_blank" rel="noopener">Источник</a>\` : ''}</div></article>\`;
}
function eventCard(e) {
  return \`<article class="list-item" \${relatedAttributes(e, 'events')}><div class="meta"><span class="tag">\${esc(e.type || 'Событие')}</span><span class="tag">\${esc(niceDate(e.date))}\${e.time ? ' · ' + esc(e.time) : ''}</span></div><h3>\${esc(e.title || 'Событие')}</h3><p>\${esc(e.description || '')}</p><p class="tiny"><b>Место:</b> \${esc(e.place || 'Уточняется')}</p><div class="card-actions"><a class="btn" href="/calendar/">Календарь</a></div></article>\`;
}
function projectCard(p) {
  const trust = relatedTrust(p, 'projects');
  const steps = arr(p.steps).slice(0, 4).map(s => \`<li>\${esc(s)}</li>\`).join('');
  return \`<article class="card" \${relatedAttributes(p, 'projects', trust.origin)}><div class="card-inner"><div class="meta"><span class="tag">\${esc(p.type || 'Проект')}</span><span class="tag \${esc(trust.className)}">\${esc(trust.label)}</span></div><h3>\${esc(p.title || 'Проект')}</h3><p>\${esc(p.description || '')}</p>\${relatedOriginNotice(p, 'projects', trust)}\${steps ? \`<hr class="sep"/><ul class="tiny">\${steps}</ul>\` : ''}<div class="card-actions"><a class="btn" href="/projects/\${esc(p.id)}/">Открыть запись</a></div></div></article>\`;
}
function doneCard(d) {
  const trust = relatedTrust(d, 'done');
  return \`<article class="list-item" \${relatedAttributes(d, 'done', trust.origin)}><div class="meta"><span class="tag">\${esc(d.type || 'Сделано')}</span><span class="tag \${esc(trust.className)}">\${esc(trust.label)}</span><span class="tag">\${esc(niceDate(d.date))}</span></div><h3>\${esc(d.title || 'История ТОС')}</h3><p>\${esc(d.summary || '')}</p>\${relatedOriginNotice(d, 'done', trust)}<div class="grid"><article class="card"><div class="card-inner"><span class="tag">Было</span><p>\${esc(d.before || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Сделали</span><p>\${esc(d.done || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Результат</span><p>\${esc(d.result || 'Информация уточняется.')}</p></div></article></div><div class="card-actions"><a class="btn" href="/done/\${esc(d.id)}/">Открыть запись</a><a class="btn" href="\${esc(updateUrl({ slug: d.tos_slug || '' }, 'photo'))}">Прислать фото</a></div></article>\`;
}
function needCard(n) {
  const trust = relatedTrust(n, 'needs');
  return \`<article class="list-item" \${relatedAttributes(n, 'needs', trust.origin)}><div class="meta"><span class="tag">\${esc(n.need_type || 'Помощь')}</span><span class="tag \${n.priority === 'Высокий' ? 'warn' : ''}">\${esc(n.priority || 'Приоритет уточняется')}</span><span class="tag \${esc(trust.className)}">\${esc(trust.label)}</span></div><h3>\${esc(n.title || 'Потребность')}</h3><p>\${esc(n.description || '')}</p>\${relatedOriginNotice(n, 'needs', trust)}<p class="tiny" data-related-contact-policy="\${esc(n.id || '')}">Контакт и способ помощи доступны в основной записи после проверки статуса материала.</p><div class="card-actions"><a class="btn" href="/needs/\${esc(n.id)}/">Открыть запись</a><a class="btn" href="/contacts/">Предложить помощь</a></div></article>\`;
}
function block`,
    'related card renderers'
  );

  source = replaceOrFail(
    source,
    /\$\{block\('Новости и материалы этого ТОС', 'Публикации, связанные с территорией по данным портала\.'/,
    "${block('Новости и материалы этого ТОС', 'У каждой публикации показано происхождение материала и ограничение проверки.",
    'news related subtitle'
  );
  source = replaceOrFail(
    source,
    /\$\{block\('Результаты и запросы этого ТОС', 'Истории и запросы материалов; подтверждённость указана в самой записи\.'/,
    "${block('Результаты и запросы этого ТОС', 'Происхождение результата или запроса показано прямо в связанной карточке.",
    'done related subtitle'
  );
  source = replaceOrFail(
    source,
    /\$\{block\('Потребности и запросы этого ТОС', 'Перед передачей помощи проверьте статус, получателя и актуальность записи\.'/,
    "${block('Потребности и запросы этого ТОС', 'Контакт не дублируется: сначала откройте запись и проверьте её статус и актуальность.",
    'needs related subtitle'
  );

  return { content: source, changed: true };
}

function patchTosRelatedContentTrust() {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);
  const current = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(GENERATOR_PATH, result.content, 'utf8');
  console.log(result.changed ? 'TOS related-content trust patch applied' : 'TOS related-content trust patch already applied');
  return result.changed;
}

if (require.main === module) patchTosRelatedContentTrust();

module.exports = { MARKER, patchSource, patchTosRelatedContentTrust };
