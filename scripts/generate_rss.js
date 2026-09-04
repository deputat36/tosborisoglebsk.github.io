const fs = require('fs');
const path = require('path');
require('./generate_tos_starter_news');
require('./generate_verified_news_wave12');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const RSS_PATH = path.join(ROOT, 'rss.xml');

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

function safeDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function pubDate(value) {
  return new Date(`${safeDate(value)}T09:00:00+03:00`).toUTCString();
}

function paragraphs(value, fallback) {
  if (Array.isArray(value) && value.length) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [fallback || 'Новость портала ТОС БГО.'];
}

function main() {
  // RSS является полным публичным представлением опубликованных news-записей.
  // Не ограничиваем число элементов: audit_rss_feed_content.js проверяет
  // соответствие feed ↔ data/news.json и защищает новые материалы от потери.
  const news = readJson(NEWS_PATH)
    .filter((item) => item && item.id && item.status !== 'draft')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const items = news.map((item) => {
    const link = `${SITE_URL}/news/${item.id}/`;
    const title = item.title || 'Новость ТОС БГО';
    const description = item.lead || paragraphs(item.text, title)[0];
    return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate(item.date)}</pubDate>
      <description>${esc(description)}</description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Новости ТОС БГО</title>
    <link>${SITE_URL}/news/</link>
    <description>Новости, объявления и материалы портала ТОС Борисоглебского городского округа.</description>
    <language>ru</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  fs.writeFileSync(RSS_PATH, xml, 'utf8');
  console.log(`RSS generated: ${news.length} items.`);
}

main();
