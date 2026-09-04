const fs = require('fs');
const path = require('path');
const { isIsoDate } = require('./lib/date_checks');
const { repoPathExists } = require('./lib/path_checks');

const newsPath = path.join(process.cwd(), 'data', 'news.json');
const tosesPath = path.join(process.cwd(), 'data', 'toses.json');
const siteUrl = 'https://tosborisoglebsk.ru';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requiredNewsIds = [
  'mirolyubie-project-winner-2026',
  'gubari-beautiful-village-2026',
  'chkalovec-neighborhood-projects-2026',
  'tretyaki-seven-projects-news-2026',
  'tancyrey-improvement-news-2026',
  'kalinka-playground-2024',
  'bogana-sports-ground-2023',
  'mahrovka-project-experience-news-2026',
  'mayak-chigorak-projects-2025',
  'petrovskoe-water-well-2023',
  'vostochnyy-cleanups-news-2026',
  'severnyy-39-playground-2021',
  'ulyanovka-sports-projects-2020',
  'ivanovka-lighting-competition-2021',
  'podstepki-cemetery-fence-competition-2021',
  'chigorak-pedestrian-bridge-2019',
  'port-artur-cemetery-competition-2021',
  'pervomayskiy-stage-competition-2021',
  'khoperskiy-bereg-sports-ground-competition-2021',
  'znamenie-created-2024',
  'uyutny-cultural-festival-2025',
  'severnyy-41-territory-competition-2021',
  'ipas-playground-application-2023'
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(value || '');
}

function isInternalPath(value) {
  return /^\/[a-z0-9][\w./-]*\/?$/.test(value || '');
}

function main() {
  if (!fs.existsSync(newsPath)) {
    throw new Error(`Missing file: ${newsPath}`);
  }

  if (!fs.existsSync(tosesPath)) {
    throw new Error(`Missing file: ${tosesPath}`);
  }

  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const toses = JSON.parse(fs.readFileSync(tosesPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(news)) {
    throw new Error('News data audit failed:\ndata/news.json must be an array');
  }

  const tosSlugs = new Set(Array.isArray(toses) ? toses.map((tos) => tos.slug).filter(Boolean) : []);
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
    const tosSlug = item.tos_slug || '';
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
    if (tosSlug && !tosSlugs.has(tosSlug)) errors.push(`${line}: unknown tos_slug ${tosSlug}`);
    if (tosSlug && !repoPathExists(`/tos/${tosSlug}/`)) errors.push(`${line}: missing TOS page /tos/${tosSlug}/`);
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
    if (sourceUrl && !isHttpUrl(sourceUrl) && !isInternalPath(sourceUrl)) {
      errors.push(`${line}: invalid source_url ${sourceUrl}`);
    }
    if (sourceUrl && isInternalPath(sourceUrl) && !repoPathExists(sourceUrl)) {
      errors.push(`${line}: missing internal source_url target ${sourceUrl}`);
    }

    if (id && !repoPathExists(`/news/${id}/`)) {
      errors.push(`${line}: missing generated page /news/${id}/`);
    }

    if (seenUrls.has(publicUrl)) errors.push(`${line}: duplicate public url ${publicUrl}`);
    seenUrls.add(publicUrl);
  });

  requiredNewsIds.forEach((id) => {
    if (!seenIds.has(id)) errors.push(`missing required news id ${id}`);
    if (!repoPathExists(`/news/${id}/`)) errors.push(`missing required news page /news/${id}/`);
  });

  if (errors.length) {
    throw new Error(`News data audit failed:\n${errors.join('\n')}`);
  }

  console.log(`News data OK: ${news.length} items, ${requiredNewsIds.length} required IDs`);
}

main();
