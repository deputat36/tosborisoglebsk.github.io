const fs = require('fs');
const path = require('path');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const needsPath = path.join(process.cwd(), 'data', 'needs.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStatuses = new Set(['published', 'draft', 'archived']);
const allowedPriorities = new Set(['Высокий', 'Средний', 'Низкий']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function main() {
  if (!fs.existsSync(needsPath)) {
    throw new Error(`Missing file: ${needsPath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const needs = JSON.parse(fs.readFileSync(needsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(needs)) {
    throw new Error('Needs integrity audit failed:\ndata/needs.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);
  const seenIds = new Set();
  const seenTitles = new Set();

  needs.forEach((need, index) => {
    const line = `need ${index + 1}`;

    if (!isObject(need)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = need.id || '';
    const status = need.status || '';
    const date = need.date || '';
    const tosSlug = need.tos_slug || '';
    const title = need.title || '';
    const description = need.description || '';
    const needType = need.need_type || '';
    const priority = need.priority || '';
    const contact = need.contact || '';
    const source = need.source || '';
    const sourceUrl = need.source_url || '';

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!isIsoDate(date)) errors.push(`${line}: invalid date ${date}`);

    if (tosSlug && !tosSlugs.has(tosSlug)) errors.push(`${line}: unknown tos_slug ${tosSlug}`);

    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 10) errors.push(`${line}: title is too short`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);

    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 50) errors.push(`${line}: description is too short`);
    if (!needType) errors.push(`${line}: missing need_type`);
    if (!allowedPriorities.has(priority)) errors.push(`${line}: unsupported priority ${priority}`);
    if (!contact) errors.push(`${line}: missing contact`);
    if (!source) errors.push(`${line}: missing source`);
    if (sourceUrl && !isHttpUrl(sourceUrl)) errors.push(`${line}: invalid source_url ${sourceUrl}`);

    if (status === 'published' && id && !repoPathExists(`/needs/${id}/`)) {
      errors.push(`${line}: missing generated page /needs/${id}/`);
    }
  });

  if (errors.length) {
    throw new Error(`Needs integrity audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Needs integrity OK: ${needs.length} needs`);
}

main();
