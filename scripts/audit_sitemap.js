const fs = require('fs');
const path = require('path');

const sitemapPath = path.join(process.cwd(), 'sitemap.xml');
const pageIndexPath = path.join(process.cwd(), 'data', 'page_index.json');
const siteUrl = 'https://tosborisoglebsk.ru';
const requiredUrls = [
  `${siteUrl}/`,
  `${siteUrl}/tos/`,
  `${siteUrl}/news/`,
  `${siteUrl}/projects/`,
  `${siteUrl}/needs/`,
  `${siteUrl}/done/`,
  `${siteUrl}/open-data/`,
  `${siteUrl}/data-quality/`,
  `${siteUrl}/places/`,
  `${siteUrl}/map/`
];

function extractTagValues(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'g');
  const values = [];
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    values.push(match[1]);
  }

  return values;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function main() {
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Missing file: ${sitemapPath}`);
  }

  if (!fs.existsSync(pageIndexPath)) {
    throw new Error(`Missing file: ${pageIndexPath}`);
  }

  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const pageIndex = JSON.parse(fs.readFileSync(pageIndexPath, 'utf8'));
  const errors = [];

  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push('sitemap must start with XML declaration');
  }

  if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    errors.push('sitemap must contain urlset namespace');
  }

  if (!xml.trim().endsWith('</urlset>')) {
    errors.push('sitemap must end with closing urlset tag');
  }

  const urls = extractTagValues(xml, 'loc');
  const lastmods = extractTagValues(xml, 'lastmod');
  const pageIndexUrls = Array.isArray(pageIndex.pages) ? pageIndex.pages.map((page) => page.url) : [];
  const urlSet = new Set();

  if (!Array.isArray(pageIndex.pages)) {
    errors.push('page_index pages must be an array');
  }

  if (urls.length === 0) errors.push('sitemap must contain at least one url');
  if (urls.length !== lastmods.length) errors.push('each sitemap url must have one lastmod');
  if (urls.length !== pageIndexUrls.length) {
    errors.push(`sitemap url count must match page_index pages: sitemap ${urls.length}, page_index ${pageIndexUrls.length}`);
  }

  urls.forEach((url, index) => {
    const line = `url ${index + 1}`;

    if (!url.startsWith(`${siteUrl}/`)) errors.push(`${line}: loc must start with ${siteUrl}/`);
    if (urlSet.has(url)) errors.push(`${line}: duplicate loc ${url}`);
    urlSet.add(url);
  });

  lastmods.forEach((lastmod, index) => {
    if (!isIsoDate(lastmod)) errors.push(`url ${index + 1}: invalid lastmod ${lastmod}`);
  });

  pageIndexUrls.forEach((url) => {
    if (!urlSet.has(url)) errors.push(`page_index url is absent in sitemap: ${url}`);
  });

  const pageIndexUrlSet = new Set(pageIndexUrls);
  urls.forEach((url) => {
    if (!pageIndexUrlSet.has(url)) errors.push(`sitemap url is absent in page_index: ${url}`);
  });

  requiredUrls.forEach((url) => {
    if (!urlSet.has(url)) errors.push(`missing required sitemap url ${url}`);
  });

  if (errors.length) {
    throw new Error(`Sitemap audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Sitemap OK: ${urls.length} urls, ${requiredUrls.length} required URLs`);
}

main();
