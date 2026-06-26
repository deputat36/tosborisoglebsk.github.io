const fs = require('fs');
const path = require('path');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const donePath = path.join(process.cwd(), 'data', 'done.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStatuses = new Set(['published', 'draft', 'archived']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function isInternalPath(value) {
  return /^\/[a-z0-9][\w./?=&%\u0400-\u04FF-]*\/?$/.test(value || '');
}

function internalTargetExists(value) {
  const target = (value || '').split('#')[0].split('?')[0];
  return repoPathExists(target || value);
}

function main() {
  if (!fs.existsSync(donePath)) {
    throw new Error(`Missing file: ${donePath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const doneItems = JSON.parse(fs.readFileSync(donePath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(doneItems)) {
    throw new Error('Done integrity audit failed:\ndata/done.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);
  const seenIds = new Set();
  const seenTitles = new Set();

  doneItems.forEach((item, index) => {
    const line = `done ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = item.id || '';
    const status = item.status || '';
    const date = item.date || '';
    const tosSlug = item.tos_slug || '';
    const type = item.type || '';
    const title = item.title || '';
    const summary = item.summary || '';
    const before = item.before || '';
    const done = item.done || '';
    const result = item.result || '';
    const participants = item.participants || '';
    const sourceLabel = item.source_label || '';
    const sourceUrl = item.source_url || '';
    const needsDetails = item.needs_details || '';

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!isIsoDate(date)) errors.push(`${line}: invalid date ${date}`);
    if (!tosSlug) errors.push(`${line}: missing tos_slug`);
    if (tosSlug && !tosSlugs.has(tosSlug)) errors.push(`${line}: unknown tos_slug ${tosSlug}`);
    if (tosSlug && !repoPathExists(`/tos/${tosSlug}/`)) errors.push(`${line}: missing TOS page /tos/${tosSlug}/`);

    if (!type) errors.push(`${line}: missing type`);
    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 10) errors.push(`${line}: title is too short`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);

    if (!summary) errors.push(`${line}: missing summary`);
    if (summary && summary.length < 50) errors.push(`${line}: summary is too short`);
    if (!before) errors.push(`${line}: missing before`);
    if (before && before.length < 40) errors.push(`${line}: before is too short`);
    if (!done) errors.push(`${line}: missing done`);
    if (done && done.length < 30) errors.push(`${line}: done is too short`);
    if (!result) errors.push(`${line}: missing result`);
    if (result && result.length < 40) errors.push(`${line}: result is too short`);
    if (!participants) errors.push(`${line}: missing participants`);
    if (!sourceLabel) errors.push(`${line}: missing source_label`);
    if (!needsDetails) errors.push(`${line}: missing needs_details`);

    if (sourceUrl && !isHttpUrl(sourceUrl) && !isInternalPath(sourceUrl)) {
      errors.push(`${line}: invalid source_url ${sourceUrl}`);
    }
    if (sourceUrl && isInternalPath(sourceUrl) && !internalTargetExists(sourceUrl)) {
      errors.push(`${line}: missing internal source_url target ${sourceUrl}`);
    }

    if (status === 'published' && id && !repoPathExists(`/done/${id}/`)) {
      errors.push(`${line}: missing generated page /done/${id}/`);
    }
  });

  if (errors.length) {
    throw new Error(`Done integrity audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Done integrity OK: ${doneItems.length} items`);
}

main();