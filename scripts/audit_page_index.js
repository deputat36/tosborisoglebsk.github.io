const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'data', 'page_index.json');
const siteUrl = 'https://tosborisoglebsk.ru';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function expectedUrlFromPath(pagePath) {
  if (pagePath === 'index.html') return `${siteUrl}/`;
  if (pagePath.endsWith('/index.html')) return `${siteUrl}/${pagePath.replace(/\/index\.html$/, '/')}`;
  return `${siteUrl}/${pagePath}`;
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const errors = [];

  if (!isIsoDateTime(data.generated_at)) errors.push('generated_at must be an ISO UTC timestamp');
  if (!Number.isInteger(data.total) || data.total < 0) errors.push('total must be a non-negative integer');
  if (!Array.isArray(data.pages)) errors.push('pages must be an array');

  if (Array.isArray(data.pages) && Number.isInteger(data.total) && data.pages.length !== data.total) {
    errors.push(`total must match pages length: total ${data.total}, pages ${data.pages.length}`);
  }

  const paths = new Set();
  const urls = new Set();

  if (Array.isArray(data.pages)) {
    data.pages.forEach((page, index) => {
      const line = `page ${index + 1}`;

      if (!isObject(page)) {
        errors.push(`${line}: page must be an object`);
        return;
      }

      const pagePath = page.path || '';
      const url = page.url || '';
      const title = page.title || '';
      const description = page.description || '';
      const section = page.section || '';

      if (!pagePath) errors.push(`${line}: missing path`);
      if (!url) errors.push(`${line}: missing url`);
      if (!title) errors.push(`${line}: missing title`);
      if (!description) errors.push(`${line}: missing description`);
      if (!section) errors.push(`${line}: missing section`);

      if (pagePath) {
        if (pagePath.startsWith('/')) errors.push(`${line}: path must be relative ${pagePath}`);
        if (pagePath.includes('..')) errors.push(`${line}: path must not contain .. ${pagePath}`);
        if (!pagePath.endsWith('index.html')) errors.push(`${line}: path must end with index.html ${pagePath}`);
        if (paths.has(pagePath)) errors.push(`${line}: duplicate path ${pagePath}`);
        paths.add(pagePath);
      }

      if (url) {
        if (!url.startsWith(`${siteUrl}/`)) errors.push(`${line}: url must start with ${siteUrl}/`);
        if (urls.has(url)) errors.push(`${line}: duplicate url ${url}`);
        urls.add(url);
      }

      if (pagePath && url && url !== expectedUrlFromPath(pagePath)) {
        errors.push(`${line}: url does not match path ${pagePath}`);
      }

      if (title && title.length < 5) errors.push(`${line}: title is too short`);
      if (description && description.length < 30) errors.push(`${line}: description is too short`);
      if (section && section.length < 2) errors.push(`${line}: section is too short`);
    });
  }

  if (errors.length) {
    throw new Error(`Page index audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Page index OK: ${data.total} pages`);
}

main();
