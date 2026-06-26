const fs = require('fs');
const path = require('path');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const tosPath = path.join(process.cwd(), 'data', 'toses.json');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedTypes = new Set(['Городской', 'Сельский']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function validateStringArray(errors, line, label, value, itemValidator = null) {
  if (!Array.isArray(value)) {
    errors.push(`${line}: ${label} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      errors.push(`${line}: ${label}[${index}] must be a string`);
      return;
    }

    if (itemValidator && !itemValidator(item)) {
      errors.push(`${line}: invalid ${label}[${index}] ${item}`);
    }
  });
}

function main() {
  if (!fs.existsSync(tosPath)) {
    throw new Error(`Missing file: ${tosPath}`);
  }

  const toses = JSON.parse(fs.readFileSync(tosPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(toses)) {
    throw new Error('TOS integrity audit failed:\ndata/toses.json must be an array');
  }

  const seenSlugs = new Set();
  const seenTitles = new Set();

  toses.forEach((item, index) => {
    const line = `tos ${index + 1}`;

    if (!isObject(item)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const slug = item.slug || '';
    const name = item.name || '';
    const title = item.title || '';
    const type = item.type || '';
    const location = item.location || '';
    const boundaries = item.boundaries || '';
    const founded = item.founded || '';
    const chairperson = item.chairperson || '';
    const contactsRaw = item.contacts_raw || '';
    const groupsRaw = item.groups_raw || '';
    const population = item.population || '';
    const description = item.description || '';
    const logo = item.logo || '';
    const updatedAt = item.updated_at || '';

    if (!slug) errors.push(`${line}: missing slug`);
    if (slug && !slugPattern.test(slug)) errors.push(`${line}: invalid slug ${slug}`);
    if (slug && seenSlugs.has(slug)) errors.push(`${line}: duplicate slug ${slug}`);
    if (slug) seenSlugs.add(slug);

    if (!name) errors.push(`${line}: missing name`);
    if (!title) errors.push(`${line}: missing title`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);
    if (name && title && !title.includes(name)) errors.push(`${line}: title should include name`);

    if (!allowedTypes.has(type)) errors.push(`${line}: unsupported type ${type}`);
    if (!location) errors.push(`${line}: missing location`);
    if (!boundaries) errors.push(`${line}: missing boundaries`);
    if (founded && !/^\d{4}$/.test(founded)) errors.push(`${line}: invalid founded ${founded}`);
    if (!chairperson) errors.push(`${line}: missing chairperson`);
    if (!contactsRaw) errors.push(`${line}: missing contacts_raw`);
    if (typeof groupsRaw !== 'string') errors.push(`${line}: groups_raw must be a string`);
    if (!population) errors.push(`${line}: missing population`);
    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 50) errors.push(`${line}: description is too short`);
    if (logo && !(logo.startsWith('/') || isHttpUrl(logo))) errors.push(`${line}: invalid logo ${logo}`);
    if (!isIsoDate(updatedAt)) errors.push(`${line}: invalid updated_at ${updatedAt}`);

    validateStringArray(errors, line, 'phones', item.phones);
    validateStringArray(errors, line, 'emails', item.emails, (email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
    validateStringArray(errors, line, 'chairperson_links', item.chairperson_links, isHttpUrl);
    validateStringArray(errors, line, 'social_links', item.social_links, isHttpUrl);

    if (slug && !repoPathExists(`/tos/${slug}/`)) {
      errors.push(`${line}: missing generated page /tos/${slug}/`);
    }
  });

  if (errors.length) {
    throw new Error(`TOS integrity audit failed:\n${errors.join('\n')}`);
  }

  console.log(`TOS integrity OK: ${toses.length} cards`);
}

main();
