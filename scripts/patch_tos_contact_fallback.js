const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const CONTACTS_PATH = path.join(ROOT, 'contacts', 'index.html');
const TOS_DATA_PATH = path.join(ROOT, 'data', 'toses.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const CONTACT_HELPERS = `function hasDirectPublicContact(tos) {
  return [tos.phones, tos.emails, tos.chairperson_links, tos.social_links]
    .some((items) => arr(items).length > 0);
}
function contactFallback(tos) {
  if (hasDirectPublicContact(tos)) return '';
  const relayUrl = \`/contacts/?tos=\${encodeURIComponent(tos.slug)}#relay-tos\`;
  return \`<div class="notice" data-tos-contact-fallback="\${esc(tos.slug)}"><b style="color:var(--text)">Прямой контакт ТОС не опубликован</b><br>Передайте сообщение через редакцию портала. Редакция постарается найти доступный канал, но не гарантирует передачу или ответ. Этот путь не является официальным обращением в орган власти, учреждение или организацию.<div class="card-actions"><a class="btn primary" href="\${esc(relayUrl)}">Передать сообщение через редакцию</a><a class="btn" href="/contacts/#contact-boundaries">Как работает канал</a></div></div>\`;
}`;

const HELPER_INSERT_MARKER = 'function updateUrl(tos, type = \'card\') {';
const CONTACT_CARD_BOUNDARY = `</ul></div></article><article class="card"><div class="card-inner"><h3>Публичные ссылки</h3>\${scopeBlock('public-links', publicScope)}`;
const CONTACT_CARD_REPLACEMENT = `</ul>\${contactFallback(tos)}</div></article><article class="card"><div class="card-inner"><h3>Публичные ссылки</h3>\${scopeBlock('public-links', publicScope)}`;

const RELAY_SECTION_MARKER = '<section class="section"><div class="container section-head"><div><h2>Что можно отправить</h2>';
const RELAY_SECTION = `<section class="section" id="relay-tos" aria-labelledby="relay-tos-title"><div class="container section-head"><div><h2 id="relay-tos-title">Передать сообщение ТОС через редакцию</h2><p>Для случая, когда прямой публичный контакт нужного ТОС в карточке не указан</p></div><a class="btn" href="/tos/">Вернуться в каталог</a></div><div class="container grid"><article class="card half"><div class="card-inner"><span class="tag warn">Неофициальный канал</span><h3>Как работает передача</h3><p>Редакция портала принимает сообщение и проверяет, есть ли доступный способ передать его председателю или активу нужного ТОС. Передача и ответ не гарантируются.</p><div class="notice"><b>Важно:</b> этот канал не заменяет официальную приёмную, экстренную службу или регистрацию обращения. Не присылайте паспортные данные, платёжные реквизиты, пароли и другие лишние персональные сведения.</div><div class="card-actions"><a class="btn primary" href="https://vk.ru/tosbgo" target="_blank" rel="noopener">Отправить через ВК</a><a class="btn" href="tel:+79102498284">Позвонить ответственному контакту</a></div></div></article><article class="card half"><div class="card-inner"><span class="tag">Шаблон</span><h3>Подготовьте короткое сообщение</h3><p id="relay-tos-context" role="status" aria-live="polite">Укажите название ТОС или территорию в сообщении.</p><textarea class="input" id="relay-tos-template" rows="10" readonly aria-label="Шаблон сообщения для передачи ТОС"></textarea><div class="card-actions"><button class="btn primary" id="copy-relay-template" type="button">Скопировать шаблон</button><a class="btn" id="relay-tos-card-link" href="/tos/" hidden>Вернуться к карточке ТОС</a></div><p class="tiny" id="relay-copy-status" aria-live="polite"></p></div></article></div></section>`;

const SCRIPT_MARKER = '<script src="/assets/js/site.js"></script></body></html>';
const SCRIPT_REPLACEMENT = '<script src="/assets/js/site.js"></script><script src="/assets/js/contact-relay.js"></script></body></html>';

function replaceOnce(content, oldValue, newValue, label) {
  if (content.includes(newValue)) return { content, changed: false };
  if (!content.includes(oldValue)) throw new Error(`${label}: source marker not found`);
  return { content: content.replace(oldValue, newValue), changed: true };
}

function patchGenerator() {
  let content = fs.readFileSync(GENERATOR_PATH, 'utf8');
  let changed = false;

  if (!content.includes('function hasDirectPublicContact(tos)')) {
    if (!content.includes(HELPER_INSERT_MARKER)) throw new Error('TOS contact helper insertion marker not found');
    content = content.replace(HELPER_INSERT_MARKER, `${CONTACT_HELPERS}\n\n${HELPER_INSERT_MARKER}`);
    changed = true;
  }

  const cardResult = replaceOnce(content, CONTACT_CARD_BOUNDARY, CONTACT_CARD_REPLACEMENT, 'TOS contact card fallback');
  content = cardResult.content;
  changed = changed || cardResult.changed;

  const required = [
    'function hasDirectPublicContact(tos)',
    'function contactFallback(tos)',
    'data-tos-contact-fallback',
    'Передать сообщение через редакцию',
    '/contacts/?tos=',
    '${contactFallback(tos)}'
  ];
  required.forEach((fragment) => {
    if (!content.includes(fragment)) throw new Error(`Patched TOS generator is missing ${fragment}`);
  });

  if (changed) fs.writeFileSync(GENERATOR_PATH, content, 'utf8');
  return changed;
}

function patchContactsPage() {
  let content = fs.readFileSync(CONTACTS_PATH, 'utf8');
  let changed = false;

  if (!content.includes('id="relay-tos"')) {
    if (!content.includes(RELAY_SECTION_MARKER)) throw new Error('Contacts relay section insertion marker not found');
    content = content.replace(RELAY_SECTION_MARKER, `${RELAY_SECTION}${RELAY_SECTION_MARKER}`);
    changed = true;
  }

  const scriptResult = replaceOnce(content, SCRIPT_MARKER, SCRIPT_REPLACEMENT, 'Contacts relay script');
  content = scriptResult.content;
  changed = changed || scriptResult.changed;

  const required = [
    'id="relay-tos"',
    'id="relay-tos-context"',
    'id="relay-tos-template"',
    'id="copy-relay-template"',
    'id="relay-copy-status"',
    '/assets/js/contact-relay.js',
    'Передача и ответ не гарантируются',
    'не заменяет официальную приёмную'
  ];
  required.forEach((fragment) => {
    if (!content.includes(fragment)) throw new Error(`Patched contacts page is missing ${fragment}`);
  });

  if (changed) fs.writeFileSync(CONTACTS_PATH, content, 'utf8');
  return changed;
}

function directChannels(tos) {
  return ['phones', 'emails', 'chairperson_links', 'social_links']
    .flatMap((key) => Array.isArray(tos[key]) ? tos[key].filter(Boolean) : []);
}

function regenerateTosPages() {
  const sitemapBefore = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : null;
  execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: 'pipe' });
  if (sitemapBefore !== null) fs.writeFileSync(SITEMAP_PATH, sitemapBefore, 'utf8');
}

function verifyMaterializedPages() {
  const toses = JSON.parse(fs.readFileSync(TOS_DATA_PATH, 'utf8'))
    .filter((item) => item && item.slug && item.status !== 'draft');
  const withoutDirectContact = toses.filter((item) => directChannels(item).length === 0);

  for (const tos of toses) {
    const pagePath = path.join(ROOT, 'tos', tos.slug, 'index.html');
    const html = fs.readFileSync(pagePath, 'utf8');
    const hasFallback = html.includes(`data-tos-contact-fallback="${tos.slug}"`);
    const expected = directChannels(tos).length === 0;
    if (hasFallback !== expected) {
      throw new Error(`${tos.slug}: contact fallback expected=${expected}, received=${hasFallback}`);
    }
    if (expected && !html.includes(`/contacts/?tos=${encodeURIComponent(tos.slug)}#relay-tos`)) {
      throw new Error(`${tos.slug}: addressable editorial relay link is missing`);
    }
  }

  return withoutDirectContact.map((item) => item.slug).sort();
}

function patchTosContactFallback() {
  const generatorChanged = patchGenerator();
  const contactsChanged = patchContactsPage();
  regenerateTosPages();
  const fallbackSlugs = verifyMaterializedPages();
  console.log(`TOS contact fallback patch OK: generator ${generatorChanged ? 'updated' : 'current'}, contacts ${contactsChanged ? 'updated' : 'current'}, fallback pages ${fallbackSlugs.length} (${fallbackSlugs.join(', ')})`);
  return { generatorChanged, contactsChanged, fallbackSlugs };
}

if (require.main === module) patchTosContactFallback();

module.exports = { patchTosContactFallback, directChannels };
