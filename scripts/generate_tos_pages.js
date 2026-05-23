const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonEsc(value) {
  return JSON.stringify(String(value ?? ''));
}

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function phoneHref(phone) {
  return String(phone || '').replace(/[^+\d]/g, '');
}

function logoPath(tos) {
  return tos.logo || `/assets/img/tos-logos/${tos.slug}.svg`;
}

function description(tos) {
  const base = [tos.boundaries, tos.location].filter(Boolean).join(' ');
  return `ТОС «${tos.name}»: председатель, контакты, границы, новости, события, проекты и потребности. ${base}`.trim();
}

function socialName(url) {
  if (!url) return 'Ссылка';
  if (url.includes('vk.com')) return 'ВКонтакте';
  if (url.includes('ok.ru')) return 'Одноклассники';
  if (url.includes('t.me')) return 'Telegram';
  return 'Ссылка';
}

function renderList(items, formatter, empty = '<li>Информация уточняется</li>') {
  return items.length ? items.map(formatter).join('\n') : empty;
}

function makePage(tos) {
  const title = `ТОС «${tos.name}» — контакты, границы, председатель | ТОС БГО`;
  const desc = description(tos);
  const canonical = `${SITE_URL}/tos/${tos.slug}/`;
  const logo = logoPath(tos);
  const phones = arr(tos.phones);
  const emails = arr(tos.emails);
  const chairLinks = arr(tos.chairperson_links);
  const socialLinks = arr(tos.social_links);
  const sameAs = [...chairLinks, ...socialLinks];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: `ТОС «${tos.name}»`,
    url: canonical,
    logo: `${SITE_URL}${logo}`,
    areaServed: tos.location || 'Борисоглебский городской округ',
    description: desc,
    sameAs,
    contactPoint: phones.map(phone => ({
      '@type': 'ContactPoint',
      telephone: phone,
      contactType: 'председатель'
    }))
  };

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
  <header class="header">
    <div class="container header-inner">
      <a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a>
      <nav class="nav" id="site-nav" aria-label="Навигация">
        <a href="/tos/">Каталог ТОС</a>
        <a href="/news/">Новости</a>
        <a href="/grants/">Конкурсы</a>
        <a href="/projects/">Проекты</a>
        <a href="/calendar/">Календарь</a>
        <a href="/needs/">Нужна помощь</a>
        <a href="/materials/">Материалы</a>
        <a href="/documents/">Документы</a>
        <a href="/create-tos/">Как создать ТОС</a>
        <a href="/chairperson/">Председателю</a>
        <a href="/contacts/">Контакты</a>
      </nav>
      <div class="actions">
        <a class="btn" href="/search/">Поиск</a>
        <button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button>
        <button class="btn" type="button" data-action="theme">Тема</button>
      </div>
    </div>
  </header>

  <main id="main">
    <section class="hero">
      <div class="container hero-card">
        <a class="chip" href="/tos/">← Каталог ТОС</a>
        <h1>ТОС «${esc(tos.name)}»</h1>
        <p class="lead">${esc(tos.location || 'Борисоглебский городской округ')}</p>
      </div>
    </section>

    <section class="section">
      <div class="container grid">
        <div class="card full"><div class="card-inner">
          <div class="kpi">
            <div class="tile"><b>${esc(tos.population || '—')}</b><span>примерно жителей</span></div>
            <div class="tile"><b>${esc(tos.founded || '—')}</b><span>год создания</span></div>
            <div class="tile"><b>${esc(tos.type || 'ТОС')}</b><span>тип ТОС</span></div>
          </div>
          <hr class="sep"/>
          <div class="notice"><b style="color:var(--text)">Границы ТОС</b><br>${esc(tos.boundaries || 'Границы уточняются')}</div>
          <hr class="sep"/>
          <div class="prose">
            <h2>Описание</h2>
            <p>${esc(tos.description || 'Описание пока уточняется.')}</p>
            <h2>Председатель</h2>
            <p>${esc(tos.chairperson || 'Информация уточняется')}</p>
            <h2>Контакты председателя</h2>
            <ul>
              ${renderList(phones, p => `<li><a href="tel:${esc(phoneHref(p))}">${esc(p)}</a></li>`, '')}
              ${renderList(emails, e => `<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`, '')}
              ${renderList(chairLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">Профиль/ссылка — ${esc(u)}</a></li>`, '')}
              ${(!phones.length && !emails.length && !chairLinks.length) ? '<li>Контакты уточняются</li>' : ''}
            </ul>
            <h2>Сообщества ТОС</h2>
            <ul>${renderList(socialLinks, u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(socialName(u))} — ${esc(u)}</a></li>`)}</ul>
            <p class="tiny">Исходные контакты из анкеты: ${esc(tos.contacts_raw || '—')}</p>
            <p class="tiny">Источник/обновление: ${esc(tos.updated_at || 'дата уточняется')}</p>
          </div>
          <hr class="sep"/>
          <div class="card-actions">
            <a class="btn" href="/tos/">← В каталог</a>
            <a class="btn" href="/update-tos/">Сообщить об ошибке</a>
            <button class="btn" onclick="window.print()">Распечатать карточку</button>
          </div>
        </div></div>
      </div>
    </section>
  </main>

  <footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru</div></div><div class="tiny">Данные страницы обновляются автоматически из data/toses.json.</div></div></footer>
  <script src="/assets/js/site.js"></script>
  <script src="/assets/js/tos-logos.js"></script>
</body>
</html>`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function updateSitemap(toses) {
  let existing = '';
  if (fs.existsSync(SITEMAP_PATH)) existing = fs.readFileSync(SITEMAP_PATH, 'utf8');

  const baseUrls = [
    '/', '/tos/', '/news/', '/grants/', '/projects/', '/calendar/', '/needs/',
    '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/',
    '/map/', '/contacts/', '/search/'
  ].map(u => `${SITE_URL}${u}`);

  const tosUrls = toses
    .filter(t => t.slug && t.status !== 'draft')
    .map(t => `${SITE_URL}/tos/${t.slug}/`);

  const urls = [...new Set([...baseUrls, ...tosUrls])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}

function main() {
  const toses = readJson(TOSES_PATH).filter(t => t.slug && t.status !== 'draft');
  for (const tos of toses) {
    const file = path.join(ROOT, 'tos', tos.slug, 'index.html');
    writeFile(file, makePage(tos));
  }
  updateSitemap(toses);
  console.log(`Generated TOS pages: ${toses.length}`);
}

main();
