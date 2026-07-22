const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const filePath = path.join(ROOT, 'data', 'page_index.json');
const contentOriginReportPath = path.join(ROOT, 'data', 'content_origin_report.json');
const siteUrl = 'https://tosborisoglebsk.ru';

const requiredPaths = [
  'index.html',
  'tos/index.html',
  'news/index.html',
  'projects/index.html',
  'needs/index.html',
  'done/index.html',
  'open-data/index.html',
  'data-quality/index.html',
  'places/index.html',
  'map/index.html',
  'search/index.html'
];

const allowedOrigins = new Set(['reference', 'verified', 'editorial', 'starter', 'request']);
const requiredGroups = new Set(['tos', 'news', 'projects', 'done', 'needs', 'materials', 'documents', 'places', 'guides', 'other']);
const collectionConfigs = {
  news: { file: 'data/news.json', route: 'news', group: 'news' },
  projects: { file: 'data/projects.json', route: 'projects', group: 'projects' },
  done: { file: 'data/done.json', route: 'done', group: 'done' },
  needs: { file: 'data/needs.json', route: 'needs', group: 'needs' },
  articles: { file: 'data/articles.json', route: 'materials', group: 'materials' }
};

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

function readJson(relativePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function main() {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  if (!fs.existsSync(contentOriginReportPath)) throw new Error(`Missing file: ${contentOriginReportPath}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const originReport = JSON.parse(fs.readFileSync(contentOriginReportPath, 'utf8'));
  const errors = [];

  if (!isIsoDateTime(data.generated_at)) errors.push('generated_at must be an ISO UTC timestamp');
  if (!Number.isInteger(data.total) || data.total < 0) errors.push('total must be a non-negative integer');
  if (!Array.isArray(data.pages)) errors.push('pages must be an array');
  if (!isObject(data.search_groups)) errors.push('search_groups must be an object');

  if (isObject(data.search_groups)) {
    requiredGroups.forEach((group) => {
      if (!String(data.search_groups[group] || '').trim()) errors.push(`search_groups is missing label for ${group}`);
    });
    Object.keys(data.search_groups).forEach((group) => {
      if (!requiredGroups.has(group)) errors.push(`search_groups contains unknown group ${group}`);
    });
  }

  if (Array.isArray(data.pages) && Number.isInteger(data.total) && data.pages.length !== data.total) {
    errors.push(`total must match pages length: total ${data.total}, pages ${data.pages.length}`);
  }

  const paths = new Set();
  const urls = new Set();
  const pageByPath = new Map();

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
      const searchGroup = page.search_group || '';
      const contentOrigin = page.content_origin || '';

      if (!pagePath) errors.push(`${line}: missing path`);
      if (!url) errors.push(`${line}: missing url`);
      if (!title) errors.push(`${line}: missing title`);
      if (!description) errors.push(`${line}: missing description`);
      if (!section) errors.push(`${line}: missing section`);
      if (!requiredGroups.has(searchGroup)) errors.push(`${line}: invalid search_group ${searchGroup || '(empty)'}`);
      if (!allowedOrigins.has(contentOrigin)) errors.push(`${line}: invalid content_origin ${contentOrigin || '(empty)'}`);

      if (pagePath) {
        if (pagePath.startsWith('/')) errors.push(`${line}: path must be relative ${pagePath}`);
        if (pagePath.includes('..')) errors.push(`${line}: path must not contain .. ${pagePath}`);
        if (!pagePath.endsWith('index.html')) errors.push(`${line}: path must end with index.html ${pagePath}`);
        if (paths.has(pagePath)) errors.push(`${line}: duplicate path ${pagePath}`);
        paths.add(pagePath);
        pageByPath.set(pagePath, page);
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

  requiredPaths.forEach((requiredPath) => {
    if (!paths.has(requiredPath)) errors.push(`missing required page index path ${requiredPath}`);
  });

  ['index.html', 'tos/index.html', 'news/index.html', 'projects/index.html', 'done/index.html', 'needs/index.html', 'search/index.html'].forEach((referencePath) => {
    const page = pageByPath.get(referencePath);
    if (page && page.content_origin !== 'reference') {
      errors.push(`${referencePath}: collection and service index pages must be reference`);
    }
  });

  const expectedCounts = { verified: 0, editorial: 0, starter: 0, request: 0 };
  let expectedMaterialPages = 0;

  Object.entries(collectionConfigs).forEach(([collection, config]) => {
    const items = readJson(config.file, []);
    if (!Array.isArray(items)) {
      errors.push(`${config.file} must be an array`);
      return;
    }

    items.filter((item) => item && item.id && item.status !== 'draft').forEach((item) => {
      const expectedPath = `${config.route}/${item.id}/index.html`;
      const page = pageByPath.get(expectedPath);
      const origin = inferContentOrigin(item, collection);
      expectedMaterialPages += 1;
      expectedCounts[origin] += 1;

      if (!page) {
        errors.push(`missing indexed material page ${expectedPath}`);
        return;
      }
      if (page.search_group !== config.group) {
        errors.push(`${expectedPath}: expected search_group ${config.group}, got ${page.search_group}`);
      }
      if (page.content_origin !== origin) {
        errors.push(`${expectedPath}: expected content_origin ${origin}, got ${page.content_origin}`);
      }
    });
  });

  const actualMaterialPages = (Array.isArray(data.pages) ? data.pages : []).filter((page) => page.content_origin !== 'reference');
  if (actualMaterialPages.length !== expectedMaterialPages) {
    errors.push(`material origin coverage mismatch: expected ${expectedMaterialPages}, got ${actualMaterialPages.length}`);
  }

  const reportTotals = originReport?.totals || {};
  ['verified', 'editorial', 'starter', 'request'].forEach((origin) => {
    if (expectedCounts[origin] !== reportTotals[origin]) {
      errors.push(`content origin report mismatch for ${origin}: index expected ${expectedCounts[origin]}, report ${reportTotals[origin]}`);
    }
  });

  if (errors.length) {
    throw new Error(`Page index audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Page index OK: ${data.total} pages, ${expectedMaterialPages} materials with trusted origin metadata`);
}

main();
