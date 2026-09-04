/*
  Импорт новостей из сообщества ВКонтакте в data/news.json.
  Работает через GitHub Actions без сервера и без платного хостинга.

  Требуемые переменные окружения:
  - VK_TOKEN — пользовательский или сервисный токен ВК с доступом к wall.get.
    Group/community access token для wall.get не поддерживается.

  Источник сообщества:
  - VK_OWNER_ID — необязательный ID сообщества со знаком минус;
  - VK_DOMAIN — необязательное короткое имя сообщества; по умолчанию используется публичный домен портала tosbgo.

  Дополнительные переменные:
  - VK_HASHTAGS — хештеги для отбора через запятую. По умолчанию: #наСайтТОСБГО,#новостьТОСБГО,#новостиТОСБГО
  - VK_COUNT — сколько последних постов проверять. По умолчанию: 50
  - NEWS_LIMIT — сколько импортированных из VK новостей хранить. Канонические материалы портала этим лимитом не обрезаются. По умолчанию: 100
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const ARTICLES_PATH = path.join(ROOT, 'data', 'articles.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://tosborisoglebsk.ru';
const DEFAULT_VK_DOMAIN = 'tosbgo';

const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_OWNER_ID = process.env.VK_OWNER_ID || '';
const VK_DOMAIN = process.env.VK_DOMAIN || DEFAULT_VK_DOMAIN;
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

function slugify(text) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashtagVariantsForTos(tos) {
  const values = [tos.slug, tos.name, tos.title, `тос${tos.name || ''}`, `ТОС${tos.name || ''}`]
    .filter(Boolean)
    .map((v) => String(v).replace(/^ТОС\s*[«"]?|[»"]$/gi, '').trim())
    .filter(Boolean);
  const variants = new Set();
  for (const value of values) {
    variants.add('#' + value.replace(/\s+/g, '').toLowerCase());
    variants.add('#тос' + value.replace(/\s+/g, '').toLowerCase());
    variants.add('#' + slugify(value).replace(/-/g, '').toLowerCase());
    variants.add('#tos' + slugify(value).replace(/-/g, '').toLowerCase());
  }
  return [...variants].filter((v) => v.length > 1);
}

function loadTosHashtagMap() {
  const toses = readJson(TOSES_PATH, []);
  const map = new Map();
  for (const tos of toses) {
    if (!tos.slug) continue;
    for (const tag of hashtagVariantsForTos(tos)) {
      map.set(tag.toLowerCase(), tos.slug);
    }
  }
  return map;
}

function detectTosSlug(text, tagMap) {
  const lower = String(text || '').toLowerCase();
  for (const [tag, slug] of tagMap.entries()) {
    if (lower.includes(tag)) return slug;
  }
  return '';
}

function stripServiceHashtags(text, tagMap = new Map()) {
  let result = String(text || '');
  const allTags = [...HASHTAGS, ...tagMap.keys()];
  for (const tag of allTags) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'ig'), '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function hasAllowedHashtag(text) {
  const lower = String(text || '').toLowerCase();
  return HASHTAGS.some((tag) => lower.includes(tag));
}

function makeTitle(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость ТОС БГО';
  const firstSentence = clear.split(/[.!?]\s/)[0].trim();
  return firstSentence.length > 90 ? firstSentence.slice(0, 87).trim() + '...' : firstSentence;
}

function makeLead(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость из сообщества ВКонтакте.';
  return clear.length > 170 ? clear.slice(0, 167).trim() + '...' : clear;
}

function splitText(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap);
  if (!clear) return ['Новость опубликована в сообществе ВКонтакте.'];
  return clear.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function formatDate(unix) {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function collectPhotos(attachments = []) {
  return attachments
    .filter((a) => a.type === 'photo' && a.photo && Array.isArray(a.photo.sizes))
    .map((a) => a.photo.sizes.slice().sort((x, y) => (y.width || 0) - (x.width || 0))[0]?.url)
    .filter(Boolean);
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

function mergeImportedNews(existing, imported, vkLimit = NEWS_LIMIT) {
  const existingItems = Array.isArray(existing) ? existing.filter((item) => item && item.id) : [];
  const importedItems = Array.isArray(imported) ? imported.filter((item) => item && item.id) : [];
  const byId = new Map(existingItems.map((item) => [item.id, item]));

  for (const item of importedItems) {
    byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
  }

  const records = Array.from(byId.values());
  const canonical = records.filter((item) => item.imported_from !== 'vk');
  const effectiveLimit = Number.isFinite(Number(vkLimit)) ? Math.max(0, Math.floor(Number(vkLimit))) : 100;
  const vkItems = records
    .filter((item) => item.imported_from === 'vk')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, effectiveLimit);

  return [...canonical, ...vkItems]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function callVkWallGet() {
  if (!VK_TOKEN) throw new Error('Не задан VK_TOKEN в GitHub Secrets.');
  if (!VK_OWNER_ID && !VK_DOMAIN) throw new Error('Не задан VK_OWNER_ID или VK_DOMAIN в переменных GitHub Actions.');

  const params = new URLSearchParams({ access_token: VK_TOKEN, v: VK_API_VERSION, count: String(VK_COUNT), extended: '0' });
  if (VK_OWNER_ID) params.set('owner_id', VK_OWNER_ID);
  if (VK_DOMAIN) params.set('domain', VK_DOMAIN);

  const res = await fetch(`https://api.vk.com/method/wall.get?${params.toString()}`);
  const data = await res.json();
  if (data.error) {
    if (Number(data.error.error_code) === 27) {
      throw new Error('VK API error 27: wall.get недоступен с group/community access token. Замените GitHub Secret VK_TOKEN на совместимый пользовательский или сервисный токен; см. docs/VK-IMPORT-OWNERSHIP-2026-07-14.md.');
    }
    throw new Error(`VK API error ${data.error.error_code}: ${data.error.error_msg}`);
  }
  return data.response?.items || [];
}

function convertVkPost(post, tagMap) {
  const ownerId = post.owner_id;
  const postId = post.id;
  const photos = collectPhotos(post.attachments || []);
  const tosSlug = detectTosSlug(post.text, tagMap);

  return {
    id: `vk-${Math.abs(ownerId)}-${postId}`,
    status: 'published',
    date: formatDate(post.date),
    category: tosSlug ? 'Новости ТОС' : 'Новости ТОС БГО',
    title: makeTitle(post.text, tagMap),
    lead: makeLead(post.text, tagMap),
    text: splitText(post.text, tagMap),
    source: 'ВКонтакте',
    source_url: `https://vk.com/wall${ownerId}_${postId}`,
    image: photos[0] || '',
    images: photos,
    tos_slug: tosSlug,
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
  const paragraphs = Array.isArray(news.text) ? news.text.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n') : `<p>${escapeHtml(news.text || news.lead || '')}</p>`;
  const images = Array.isArray(news.images) && news.images.length
    ? `<div class="grid">${news.images.slice(0, 8).map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(news.title)}" style="width:100%;border-radius:20px;border:1px solid var(--line);">`).join('')}</div>`
    : (news.image ? `<img src="${escapeHtml(news.image)}" alt="${escapeHtml(news.title)}" style="width:100%;border-radius:24px;margin:18px 0;border:1px solid var(--line);">` : '');
  const tosLink = news.tos_slug ? `<p><a class="btn" href="/tos/${escapeHtml(news.tos_slug)}/">Открыть связанный ТОС</a></p>` : '';
  const source = news.source_url ? `<p class="source"><b>Источник:</b> ${escapeHtml(news.source || 'Источник')}<br><a href="${escapeHtml(news.source_url)}" target="_blank" rel="noopener">${escapeHtml(news.source_url)}</a></p>` : `<p class="source"><b>Источник:</b> ${escapeHtml(news.source || 'Редакция портала')}</p>`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(news.title)} | ТОС БГО</title><meta name="description" content="${escapeHtml(news.lead)}"/><link rel="canonical" href="${SITE_URL}/news/${news.id}/"/><meta property="og:title" content="${escapeHtml(news.title)}"/><meta property="og:description" content="${escapeHtml(news.lead)}"/><meta property="og:type" content="article"/><meta property="og:url" content="${SITE_URL}/news/${news.id}/"/><meta property="og:image" content="${escapeHtml(news.image || `${SITE_URL}/assets/img/og-cover.svg`)}"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="stylesheet" href="/assets/css/styles.css"/></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><header class="header"><div class="container header-inner"><a class="brand" href="/"><img src="/assets/img/logo.svg" alt="ТОС БГО"/></a><nav class="nav" id="site-nav" aria-label="Навигация"><a href="/tos/">Каталог ТОС</a><a href="/news/">Новости</a><a href="/grants/">Конкурсы</a><a href="/projects/">Проекты</a><a href="/materials/">Материалы</a><a href="/documents/">Документы</a><a href="/create-tos/">Как создать ТОС</a><a href="/contacts/">Контакты</a></nav><div class="actions"><a class="btn" href="/search/">Поиск</a><button class="btn menu-btn" type="button" data-action="menu" aria-expanded="false" aria-controls="site-nav">Меню</button><button class="btn" type="button" data-action="theme">Тема</button></div></div></header><main id="main"><section class="hero"><div class="container hero-card"><a class="chip" href="/news/">← Новости</a><div class="eyebrow">${escapeHtml(news.category || 'Новости')} · ${escapeHtml(news.date || '')}</div><h1>${escapeHtml(news.title)}</h1><p class="lead">${escapeHtml(news.lead)}</p></div></section><section class="section"><div class="container prose">${images}${paragraphs}${tosLink}<hr class="sep"/>${source}</div></section></main><footer class="footer"><div class="container footer-grid"><div><b>Портал ТОС БГО</b><div class="tiny">© <span id="year"></span> tosborisoglebsk.ru.</div></div><div class="tiny">Новость импортирована или обновлена автоматически.</div></div></footer><script src="/assets/js/site.js"></script></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function updateSitemap(newsList) {
  const staticUrls = ['/', '/tos/', '/news/', '/grants/', '/projects/', '/materials/', '/documents/', '/create-tos/', '/chairperson/', '/update-tos/', '/map/', '/contacts/', '/search/'];
  let urls = staticUrls.map((u) => `${SITE_URL}${u}`);
  for (const tos of readJson(TOSES_PATH, [])) if (tos.slug && tos.status !== 'draft') urls.push(`${SITE_URL}/tos/${tos.slug}/`);
  for (const news of newsList) if (news.id && news.status !== 'draft') urls.push(`${SITE_URL}/news/${news.id}/`);
  for (const article of readJson(ARTICLES_PATH, [])) if (article.id && article.status !== 'draft') urls.push(`${SITE_URL}/materials/${article.id}/`);
  urls = [...new Set(urls)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}

async function main() {
  const tagMap = loadTosHashtagMap();
  const existing = readJson(NEWS_PATH, []);
  const posts = await callVkWallGet();
  const imported = posts.filter((post) => !post.is_pinned).filter((post) => hasAllowedHashtag(post.text)).map((post) => convertVkPost(post, tagMap));
  const merged = mergeImportedNews(existing, imported, NEWS_LIMIT);

  writeJson(NEWS_PATH, merged);
  for (const item of merged.filter((item) => item.status !== 'draft')) generateNewsPage(item);
  updateSitemap(merged);

  console.log(`Проверено постов ВК: ${posts.length}`);
  console.log(`Импортировано/обновлено постов по хештегам: ${imported.length}`);
  console.log(`Привязано к ТОСам: ${imported.filter((item) => item.tos_slug).length}`);
  console.log(`VK-новостей после применения лимита: ${merged.filter((item) => item.imported_from === 'vk').length}`);
  console.log(`Всего новостей в data/news.json: ${merged.length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  mergeImportedNews
};
