const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const rssPath = path.join(process.cwd(), 'rss.xml');
const newsPath = path.join(process.cwd(), 'data', 'news.json');
const siteUrl = 'https://tosborisoglebsk.ru';

function extractTagValues(xml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'g');
  const values = [];
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    values.push(match[1]);
  }

  return values;
}

function extractItems(xml) {
  const pattern = /<item>([\s\S]*?)<\/item>/g;
  const items = [];
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    items.push(match[1]);
  }

  return items;
}

function firstTagValue(xml, tagName) {
  const values = extractTagValues(xml, tagName);
  return values.length ? values[0] : '';
}

function newsUrl(newsItem) {
  return `${siteUrl}/news/${newsItem.id}/`;
}

function isRssDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRssNews(item) {
  return item
    && item.id
    && item.status !== 'draft'
    && inferContentOrigin(item, 'news') !== 'request';
}

function isRequestNews(item) {
  return item
    && item.id
    && item.status !== 'draft'
    && inferContentOrigin(item, 'news') === 'request';
}

function main() {
  if (!fs.existsSync(rssPath)) {
    throw new Error(`Missing file: ${rssPath}`);
  }

  if (!fs.existsSync(newsPath)) {
    throw new Error(`Missing file: ${newsPath}`);
  }

  const xml = fs.readFileSync(rssPath, 'utf8');
  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const errors = [];

  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push('rss must start with XML declaration');
  }

  if (!xml.includes('<rss version="2.0">')) errors.push('rss version 2.0 tag is missing');
  if (!xml.includes('<channel>')) errors.push('channel tag is missing');
  if (!xml.trim().endsWith('</rss>')) errors.push('rss must end with closing rss tag');

  if (firstTagValue(xml, 'title') !== 'Новости ТОС БГО') errors.push('channel title is unexpected');
  if (firstTagValue(xml, 'link') !== `${siteUrl}/news/`) errors.push('channel link is unexpected');
  if (firstTagValue(xml, 'language') !== 'ru') errors.push('channel language must be ru');

  const lastBuildDate = firstTagValue(xml, 'lastBuildDate');
  if (!isRssDate(lastBuildDate)) errors.push('lastBuildDate must be a valid RSS date');

  if (!Array.isArray(news)) errors.push('data/news.json must be an array');

  const items = extractItems(xml);
  const links = [];
  const seenLinks = new Set();

  items.forEach((itemXml, index) => {
    const line = `item ${index + 1}`;
    const title = firstTagValue(itemXml, 'title');
    const link = firstTagValue(itemXml, 'link');
    const guid = firstTagValue(itemXml, 'guid');
    const pubDate = firstTagValue(itemXml, 'pubDate');
    const description = firstTagValue(itemXml, 'description');

    if (!title) errors.push(`${line}: missing title`);
    if (!link) errors.push(`${line}: missing link`);
    if (!guid) errors.push(`${line}: missing guid`);
    if (!pubDate) errors.push(`${line}: missing pubDate`);
    if (!description) errors.push(`${line}: missing description`);

    if (link && !link.startsWith(`${siteUrl}/news/`)) errors.push(`${line}: link must start with ${siteUrl}/news/`);
    if (guid && link && guid !== link) errors.push(`${line}: guid must match link`);
    if (link && seenLinks.has(link)) errors.push(`${line}: duplicate link ${link}`);
    if (link) seenLinks.add(link);
    if (link) links.push(link);
    if (pubDate && !isRssDate(pubDate)) errors.push(`${line}: invalid pubDate ${pubDate}`);
  });

  if (Array.isArray(news)) {
    const substantiveUrls = news.filter(isRssNews).map(newsUrl);
    const requestUrls = news.filter(isRequestNews).map(newsUrl);

    substantiveUrls.forEach((url) => {
      if (!seenLinks.has(url)) errors.push(`substantive news item is absent in rss: ${url}`);
    });

    requestUrls.forEach((url) => {
      if (seenLinks.has(url)) errors.push(`request news item must be absent from rss: ${url}`);
    });

    const substantiveUrlSet = new Set(substantiveUrls);
    links.forEach((link) => {
      if (!substantiveUrlSet.has(link)) errors.push(`rss item is not an eligible substantive news item: ${link}`);
    });

    if (!requestUrls.length) {
      errors.push('rss request exclusion contract is not exercised: expected at least one request item in data/news.json');
    }
  }

  if (errors.length) {
    throw new Error(`RSS audit failed:\n${errors.join('\n')}`);
  }

  console.log(`RSS OK: ${items.length} substantive items, request records excluded`);
}

main();
