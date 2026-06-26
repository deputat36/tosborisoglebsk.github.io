const fs = require('fs');
const path = require('path');
const { isIsoDate } = require('./lib/date_checks');

const newsPath = path.join(process.cwd(), 'data', 'news.json');
const siteUrl = 'https://tosborisoglebsk.ru';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function main() {
  if (!fs.existsSync(newsPath)) {
    throw new Error(`Missing file: ${newsPath}`);
  }

  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(news)) {
    throw new Error('News data audit failed:\ndata/news.json must be an array');
  }

  const seenIds = new Set();
  const seenUrls = new Set();

  news.forEach((item, index) => {
    const line = `news ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = item.id || '';
    const date = item.date || '';
    const category = item.category || '';
    const title = item.title || '';
    const lead = item.lead || '';
    const text = item.text;
    const source = item.source || '';
    const sourceUrl = item.source_url || '';
    const publicUrl = `${siteUrl}/news/${id}/`;

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!isIsoDate(date)) errors.push(`${line}: invalid date ${date}`);
    if (!category) errors.push(`${line}: missing category`);
    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 10) errors.push(`${line}: title is too short`);
    if (!lead) errors.push(`${line}: missing lead`);
    if (lead && lead.length < 30) errors.push(`${line}: lead is too short`);

    if (!Array.isArray(text) || text.length === 0) {
      errors.push(`${line}: text must be a non-empty array`);
    } else {
      text.forEach((paragraph, paragraphIndex) => {
        if (typeof paragraph !== 'string' || paragraph.trim().length < 20) {
          errors.push(`${line}: text paragraph ${paragraphIndex + 1} is too short`);
        }
      });
    }

    if (!source) errors.push(`${line}: missing source`);
    if (sourceUrl && !isHttpUrl(sourceUrl)) errors.push(`${line}: invalid source_url ${sourceUrl}`);

    if (seenUrls.has(publicUrl)) errors.push(`${line}: duplicate public url ${publicUrl}`);
    seenUrls.add(publicUrl);
  });

  if (errors.length) {
    throw new Error(`News data audit failed:\n${errors.join('\n')}`);
  }

  console.log(`News data OK: ${news.length} items`);
}

main();
