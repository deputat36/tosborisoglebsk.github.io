const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const tasksPath = path.join(process.cwd(), 'data', 'collection_tasks.csv');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const expectedHeaders = [
  'ТОС',
  'slug',
  'населённый пункт',
  'председатель',
  'приоритет',
  'заполненность',
  'что уточнить',
  'рекомендации',
  'карточка',
  'форма обновления',
  'короткое сообщение'
];
const allowedPriorities = new Set(['Высокий', 'Средний', 'Низкий']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = !quoted;
      continue;
    }

    if (ch === ';' && !quoted) {
      row.push(value);
      value = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += ch;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function getUrlPath(value) {
  try {
    return new URL(value).pathname;
  } catch (error) {
    return '';
  }
}

function main() {
  if (!fs.existsSync(tasksPath)) {
    throw new Error(`Missing file: ${tasksPath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const rows = parseSemicolonCsv(fs.readFileSync(tasksPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('Collection tasks audit failed:\ndata/toses.json must be an array');
  }

  if (rows.length < 2) {
    throw new Error('Collection tasks audit failed:\ndata/collection_tasks.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const knownSlugs = new Set(toses.map((tos) => tos.slug).filter(Boolean));
  const seenSlugs = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `collection row ${index + 2}`;
    const [tosName, slug, location, chairperson, priority, completeness, missingFields, recommendations, cardUrl, updateUrl, shortMessage] = row.map((cell) => (cell || '').trim());

    if (!tosName) errors.push(`${line}: missing ТОС`);
    if (!slug) errors.push(`${line}: missing slug`);
    if (slug && !slugPattern.test(slug)) errors.push(`${line}: invalid slug ${slug}`);
    if (slug && !knownSlugs.has(slug)) errors.push(`${line}: unknown slug ${slug}`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate slug ${slug}`);
    if (slug) seenSlugs.add(slug);
    if (!location) errors.push(`${line}: missing населённый пункт`);
    if (!chairperson) errors.push(`${line}: missing председатель`);
    if (!allowedPriorities.has(priority)) errors.push(`${line}: unsupported приоритет ${priority}`);
    if (!/^\d+$/.test(completeness) || Number(completeness) < 0 || Number(completeness) > 100) {
      errors.push(`${line}: invalid заполненность ${completeness}`);
    }
    if (!missingFields) errors.push(`${line}: missing что уточнить`);
    if (!recommendations) errors.push(`${line}: missing рекомендации`);
    if (!isHttpUrl(cardUrl)) errors.push(`${line}: invalid карточка ${cardUrl}`);
    if (!isHttpUrl(updateUrl)) errors.push(`${line}: invalid форма обновления ${updateUrl}`);
    if (!shortMessage || shortMessage.length < 80) errors.push(`${line}: короткое сообщение is too short`);

    if (cardUrl) {
      const cardPath = getUrlPath(cardUrl);
      if (slug && cardPath !== `/tos/${slug}/`) errors.push(`${line}: карточка URL does not match slug`);
      if (cardPath && !repoPathExists(cardPath)) errors.push(`${line}: missing карточка route ${cardPath}`);
    }

    if (updateUrl && slug && !updateUrl.includes(`tos=${slug}`)) {
      errors.push(`${line}: форма обновления URL must include tos=${slug}`);
    }

    if (shortMessage && !shortMessage.includes('можно публиковать открыто')) {
      errors.push(`${line}: короткое сообщение must keep public-publication limitation`);
    }
  });

  knownSlugs.forEach((slug) => {
    if (!seenSlugs.has(slug)) {
      errors.push(`missing collection task for slug ${slug}`);
    }
  });

  if (errors.length) {
    throw new Error(`Collection tasks audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Collection tasks OK: ${rows.length - 1} rows`);
}

main();
