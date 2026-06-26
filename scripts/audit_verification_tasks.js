const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const tasksPath = path.join(process.cwd(), 'data', 'verification_tasks.csv');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const expectedHeaders = [
  'Приоритет',
  'ТОС',
  'Slug',
  'Территория',
  'Председатель / контактное лицо',
  'Заполненность',
  'Статус проверки',
  'Что уточнить',
  'Рекомендации',
  'Карточка',
  'Форма обновления',
  'Задача',
  'Шаблон сообщения председателю'
];
const allowedPriorities = new Set(['Высокий', 'Средний', 'Низкий']);
const allowedStatuses = new Set(['Требует проверки', 'Проверено частично', 'Проверено', 'Не начинали']);
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
    throw new Error('Verification tasks audit failed:\ndata/toses.json must be an array');
  }

  if (rows.length < 2) {
    throw new Error('Verification tasks audit failed:\ndata/verification_tasks.csv must contain a header and at least one row');
  }

  const headers = rows[0].map(normalizeHeader);
  if (headers.join('|') !== expectedHeaders.join('|')) {
    errors.push(`unexpected headers: ${headers.join(', ')}`);
  }

  const knownSlugs = new Set(toses.map((tos) => tos.slug).filter(Boolean));
  const seenSlugs = new Set();

  rows.slice(1).forEach((row, index) => {
    const line = `verification task row ${index + 2}`;
    const [priority, tosName, slug, territory, chairperson, completeness, verificationStatus, missingFields, recommendations, cardUrl, updateUrl, task, chairpersonMessage] = row.map((cell) => (cell || '').trim());

    if (!allowedPriorities.has(priority)) errors.push(`${line}: unsupported priority ${priority}`);
    if (!tosName) errors.push(`${line}: missing ТОС`);
    if (!slug) errors.push(`${line}: missing Slug`);
    if (slug && !slugPattern.test(slug)) errors.push(`${line}: invalid Slug ${slug}`);
    if (slug && !knownSlugs.has(slug)) errors.push(`${line}: unknown Slug ${slug}`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate Slug ${slug}`);
    if (slug) seenSlugs.add(slug);
    if (!territory) errors.push(`${line}: missing Территория`);
    if (!chairperson) errors.push(`${line}: missing Председатель / контактное лицо`);
    if (!/^\d+$/.test(completeness) || Number(completeness) < 0 || Number(completeness) > 100) {
      errors.push(`${line}: invalid Заполненность ${completeness}`);
    }
    if (!allowedStatuses.has(verificationStatus)) errors.push(`${line}: unsupported Статус проверки ${verificationStatus}`);
    if (!missingFields) errors.push(`${line}: missing Что уточнить`);
    if (!recommendations) errors.push(`${line}: missing Рекомендации`);
    if (!isHttpUrl(cardUrl)) errors.push(`${line}: invalid Карточка ${cardUrl}`);
    if (!isHttpUrl(updateUrl)) errors.push(`${line}: invalid Форма обновления ${updateUrl}`);
    if (!task || task.length < 40) errors.push(`${line}: Задача is too short`);
    if (!chairpersonMessage || chairpersonMessage.length < 120) errors.push(`${line}: Шаблон сообщения председателю is too short`);

    if (cardUrl) {
      const cardPath = getUrlPath(cardUrl);
      if (slug && cardPath !== `/tos/${slug}/`) errors.push(`${line}: Карточка URL does not match Slug`);
      if (cardPath && !repoPathExists(cardPath)) errors.push(`${line}: missing Карточка route ${cardPath}`);
    }

    if (updateUrl && slug && !updateUrl.includes(`tos=${slug}`)) {
      errors.push(`${line}: Форма обновления URL must include tos=${slug}`);
    }

    if (task && !task.includes('можно публиковать открыто')) {
      errors.push(`${line}: Задача must keep public-publication limitation`);
    }

    if (chairpersonMessage && !chairpersonMessage.includes('Данные можно публиковать открыто')) {
      errors.push(`${line}: Шаблон сообщения председателю must keep public-publication limitation`);
    }
  });

  knownSlugs.forEach((slug) => {
    if (!seenSlugs.has(slug)) {
      errors.push(`missing verification task for slug ${slug}`);
    }
  });

  if (errors.length) {
    throw new Error(`Verification tasks audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Verification tasks OK: ${rows.length - 1} rows`);
}

main();
