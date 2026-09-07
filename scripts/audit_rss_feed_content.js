const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const rssPath = path.join(process.cwd(), 'rss.xml');
const newsPath = path.join(process.cwd(), 'data', 'news.json');
const siteUrl = 'https://tosborisoglebsk.ru';

function check(errors, content, text, label) {
  if (!content.includes(text)) errors.push(`missing ${label}: ${text}`);
}

function isRssNews(item) {
  return item
    && item.id
    && item.status !== 'draft'
    && inferContentOrigin(item, 'news') !== 'request';
}

function main() {
  const errors = [];

  if (!fs.existsSync(rssPath)) errors.push('missing rss.xml');
  if (!fs.existsSync(newsPath)) errors.push('missing data/news.json');
  if (errors.length) throw new Error(`RSS feed content audit failed:\n${errors.join('\n')}`);

  const xml = fs.readFileSync(rssPath, 'utf8');
  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));

  check(errors, xml, '<?xml version="1.0" encoding="UTF-8"?>', 'XML declaration');
  check(errors, xml, '<rss version="2.0">', 'RSS version');
  check(errors, xml, '<channel>', 'channel');
  check(errors, xml, '<title>Новости ТОС БГО</title>', 'channel title');
  check(errors, xml, '<link>https://tosborisoglebsk.ru/news/</link>', 'channel link');
  check(errors, xml, '<description>Новости, объявления и содержательные материалы портала ТОС Борисоглебского городского округа.</description>', 'channel description');
  check(errors, xml, '<language>ru</language>', 'language');
  check(errors, xml, '<lastBuildDate>', 'last build date');
  check(errors, xml, '<guid isPermaLink="true">', 'permalink guid');
  check(errors, xml, '</rss>', 'closing rss tag');

  if (!Array.isArray(news)) {
    errors.push('data/news.json must be an array');
  } else {
    const expected = news.filter(isRssNews);
    const requests = news.filter((item) => item && item.id && item.status !== 'draft' && inferContentOrigin(item, 'news') === 'request');
    const itemCount = (xml.match(/<item>/g) || []).length;

    if (itemCount !== expected.length) {
      errors.push(`rss item count must match substantive published news: rss ${itemCount}, expected ${expected.length}`);
    }

    expected.forEach((item) => {
      if (!xml.includes(`${siteUrl}/news/${item.id}/`)) {
        errors.push(`rss is missing substantive news item ${item.id}`);
      }
    });

    requests.forEach((item) => {
      if (xml.includes(`${siteUrl}/news/${item.id}/`)) {
        errors.push(`rss must not include request item ${item.id}`);
      }
    });

    if (!requests.length) {
      errors.push('rss request exclusion contract is not exercised: expected at least one request item in data/news.json');
    }
  }

  if (errors.length) throw new Error(`RSS feed content audit failed:\n${errors.join('\n')}`);
  console.log('RSS feed content OK: substantive publications only, request items excluded');
}

main();
