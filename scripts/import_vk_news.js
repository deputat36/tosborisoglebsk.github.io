/*
  Импорт новостей из сообщества ВКонтакте в data/news.json.
  Работает через GitHub Actions без сервера и без платного хостинга.

  Требуемые переменные окружения:
  - VK_TOKEN — сервисный/пользовательский токен ВК с доступом к wall.get
  - VK_OWNER_ID или VK_DOMAIN — ID сообщества со знаком минус, например -123456789, или короткое имя сообщества

  Дополнительные переменные:
  - VK_HASHTAGS — хештеги для отбора через запятую. По умолчанию: #наСайтТОСБГО,#новостьТОСБГО,#новостиТОСБГО
  - VK_COUNT — сколько последних постов проверять. По умолчанию: 50
  - NEWS_LIMIT — сколько новостей хранить в data/news.json. По умолчанию: 100
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://tosborisoglebsk.ru';

const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_OWNER_ID = process.env.VK_OWNER_ID || '';
const VK_DOMAIN = process.env.VK_DOMAIN || '';
const VK_COUNT = Number(process.env.VK_COUNT || 50);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 100);
const VK_API_VERSION = process.env.VK_API_VERSION || '5.199';
const HASHTAGS = (process.env.VK_HASHTAGS || '#наСайтТОСБГО,#новостьТОСБГО,#новостиТОСБГО')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripServiceHashtags(text) {
  let result = String(text || '');
  for (const tag of HASHTAGS) {
    const re = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    result = result.replace(re, '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function hasAllowedHashtag(text) {
  const lower = String(text || '').toLowerCase();
  return HASHTAGS.some((tag) => lower.includes(tag));
}

function makeTitle(text) {
  const clear = stripServiceHashtags(text).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость ТОС БГО';
  const firstSentence = clear.split(/[.!?]\s/)[0].trim();
  const title = firstSentence.length > 90 ? firstSentence.slice(0, 87).trim() + '...' : firstSentence;
  return title || 'Новость ТОС БГО';
}

function makeLead(text) {
  const clear = stripServiceHashtags(text).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость из сообщества ВКонтакте.';
  return clear.length > 170 ? clear.slice(0, 167).trim() + '...' : clear;
}

function splitText(text) {
  const clear = stripServiceHashtags(text);
  if (!clear) return ['Новость опубликована в сообществе ВКонтакте.'];
  return clear
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatDate(unix) {
  const d = new Date(unix * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bestPhoto(attachments = []) {
  const photo = attachments.find((a) => a.type === 'photo' && a.photo && Array.isArray(a.photo.sizes));
  if (!photo) return '';
  const sizes = photo.photo.sizes.slice().sort((a, b) => (b.width || 0) - (a.width || 0));
  return sizes[0]?.url || '';
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Ошибка чтения JSON ${file}:`, error.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

async function callVkWallGet() {
  if (!VK_TOKEN) throw new Error('Не задан VK_TOKEN в GitHub Secrets.');
  if (!VK_OWNER_ID && !VK_DOMAIN) throw new Error('Не задан VK_OWNER_ID или VK_DOMAIN в переменных GitHub Actions.');

  const params = new URLSearchParams({
    access_token: VK_TOKEN,
    v: VK_API_VERSION,
    count: String(VK_COUNT),
    extended: '0'
  });

  if (VK_OWNER_ID) params.set('owner_id', VK_OWNER_ID);
  if (VK_DOMAIN) params.set('domain', VK_DOMAIN);

  const url = `https://api.vk.com/method/wall.get?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`VK API error ${data.error.error_code}: ${data.error.error_msg}`);
  }

  return data.response?.items || [];
}

function convertVkPost(post) {
  const ownerId = post.owner_id;
  const postId = post.id;
  const id = `vk-${Math.abs(ownerId)}-${postId}`;
  const sourceUrl = `https://vk.com/wall${ownerId}_${postId}`;
  const image = bestPhoto(post.attachments || []);

  return {
    id,
    date: formatDate(post.date),
    category: 'Новости ТОС',
    title: makeTitle(post.text),
    lead: makeLead(post.text),
    text: splitText(post.text),
    source: 'ВКонтакте',
    source_url: sourceUrl,
    image,
    external: true,
    imported_from: 'vk',
    vk_owner_id: ownerId,
    vk_post_id: postId,
    imported_at: new Date().toISOString()
  };
}

function generateNewsPage(news) {
  const dir = path.join(ROOT, 'news', news.id);
  fs.mkdirSync(dir, { recursive: true });

  const paragraphs = Array.isArray(news.text)
    ? news.text.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')
    : `<p>${escapeHtml(news.text || news.lead || '')}</p>`;

  const image = news.image ? `<img src="${escapeHtml(news.image)}" alt="${escapeHtml(news.title)}" style="width:100%;border-radius:24px;margin:18px 0;border:1px solid var(--line);">` : '';
  const source = news.source_url
    ? `<p class="source"><b>Источник:</b> ${escapeHtml(news.source || 'Источник')}<br><a href="${escapeHtml(news.source_url)}" target="_blank" rel="noopener">${escapeHtml(news.source_url)}</a></p>`
    : `<p class="source"><b>Источник:</b> ${escapeHtml(news.source || 'Редакция портала')}</p>`;

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(news.title)} | ТОС БГО</title>
<meta name="description" content="${escapeHtml(news.lead)}"/>
<link rel="canonical" href="${SITE_URL}/news/${news.id}/"/>
<meta property="og:title" content="${escapeHtml(news.title)}"/>
<meta property="og:description" content="${escapeHtml(news.lead)}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${SITE_URL}/news/${news.id}/"/>
<meta property="og:image" content="${escapeHtml(news.image || `${SITE_URL}/assets/img/og-cover.svg`)}"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="stylesheet" href="/assets/css/styles.css"/>
</head>
<body>
<a class="skip-link" href="#main">Перейти к содержимому</a>
<header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/news/">Новости</a><a href="/grants/">Конкурсы</a><a href="/projects/">Проекты</a><a href="/materials/">Материалы</a><a href="/documents/">Документы</a><a href="/create-tos/">Как создать ТОС</a><a href="/contacts/">Контакты</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header>
<main id="main">
<section class="hero"><div class="container hero-card"><a class="chip" href="/news/">← Новости</a><div class="eyebrow">${escapeHtml(news.category || 'Новости')} · ${escapeHtml(news.date || '')}</div><h1>${escapeHtml(news.title)}</h1><p class="lead">${escapeHtml(news.lead)}</p></div></section>
<section class="section"><div class="container prose">${image}${paragraphs}<hr class="sep"/>${source}</div></section>
</main>
<footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru.</div></div><div class="tiny">Новость импортирована или обновлена автоматически.</div></div></footer>
<script src="/assets/js/site.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function updateSitemap(newsList) {
  const staticUrls = [
    '/', '/tos/', '/news/', '/grants/', '/projects/', '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/search/'
  ];

  let urls = staticUrls.map((u) => `${SITE_URL}${u}`);

  const tosPath = path.join(ROOT, 'data', 'toses.json');
  const toses = readJson(tosPath, []);
  for (const tos of toses) {
    if (tos.slug) urls.push(`${SITE_URL}/tos/${tos.slug}/`);
  }

  for (const news of newsList) {
    if (news.id) urls.push(`${SITE_URL}/news/${news.id}/`);
  }

  const articlesPath = path.join(ROOT, 'data', 'articles.json');
  const articles = readJson(articlesPath, []);
  for (const article of articles) {
    if (article.id) urls.push(`${SITE_URL}/materials/${article.id}/`);
  }

  urls = [...new Set(urls)];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}

async function main() {
  const existing = readJson(NEWS_PATH, []);
  const existingById = new Map(existing.map((item) => [item.id, item]));

  const posts = await callVkWallGet();
  const imported = posts
    .filter((post) => !post.is_pinned)
    .filter((post) => hasAllowedHashtag(post.text))
    .map(convertVkPost);

  for (const item of imported) {
    existingById.set(item.id, {
      ...(existingById.get(item.id) || {}),
      ...item
    });
  }

  const merged = Array.from(existingById.values())
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, NEWS_LIMIT);

  writeJson(NEWS_PATH, merged);
  for (const item of merged) generateNewsPage(item);
  updateSitemap(merged);

  console.log(`Проверено постов ВК: ${posts.length}`);
  console.log(`Импортировано/обновлено постов по хештегам: ${imported.length}`);
  console.log(`Всего новостей в data/news.json: ${merged.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
