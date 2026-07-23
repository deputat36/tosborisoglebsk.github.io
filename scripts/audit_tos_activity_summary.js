const fs = require('fs');
const path = require('path');
const { patchTosActivitySummary, MARKER } = require('./patch_tos_activity_summary');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const COLLECTIONS = {
  news: { path: path.join(ROOT, 'data', 'news.json'), anchor: 'tos-news' },
  events: { path: path.join(ROOT, 'data', 'events.json'), anchor: 'tos-events' },
  projects: { path: path.join(ROOT, 'data', 'projects.json'), anchor: 'tos-projects' },
  done: { path: path.join(ROOT, 'data', 'done.json'), anchor: 'tos-done' },
  needs: { path: path.join(ROOT, 'data', 'needs.json'), anchor: 'tos-needs' }
};

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function published(item) {
  return item && item.status !== 'draft';
}

function countFor(items, slug) {
  return (Array.isArray(items) ? items : []).filter((item) => published(item) && item.tos_slug === slug).length;
}

function requireIncludes(errors, content, fragment, label) {
  if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
}

function auditTosActivitySummary() {
  patchTosActivitySummary();

  const errors = [];
  const generator = read(GENERATOR_PATH);
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const collectionData = Object.fromEntries(
    Object.entries(COLLECTIONS).map(([key, config]) => [key, readJson(config.path)])
  );

  requireIncludes(errors, generator, MARKER, 'generator version');
  requireIncludes(errors, generator, 'function activitySummary(tos, data)', 'generator helper');
  requireIncludes(errors, generator, 'Ноль не означает отсутствие работы ТОС', 'generator neutral wording');
  requireIncludes(errors, generator, "'tos-news'", 'generator news anchor');
  requireIncludes(errors, generator, "'tos-events'", 'generator events anchor');
  requireIncludes(errors, generator, "'tos-projects'", 'generator projects anchor');
  requireIncludes(errors, generator, "'tos-done'", 'generator done anchor');
  requireIncludes(errors, generator, "'tos-needs'", 'generator needs anchor');

  let linkedTiles = 0;
  let zeroTiles = 0;
  let totalRecords = 0;

  toses.forEach((tos) => {
    const pagePath = path.join(ROOT, 'tos', tos.slug, 'index.html');
    const html = read(pagePath);
    const counts = Object.fromEntries(
      Object.keys(COLLECTIONS).map((key) => [key, countFor(collectionData[key], tos.slug)])
    );
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    totalRecords += total;

    requireIncludes(errors, html, 'id="tos-activity-summary" data-tos-activity-summary', `${tos.slug} summary`);
    requireIncludes(errors, html, `data-tos-slug="${tos.slug}"`, `${tos.slug} summary slug`);
    requireIncludes(errors, html, `data-news-count="${counts.news}"`, `${tos.slug} news count`);
    requireIncludes(errors, html, `data-events-count="${counts.events}"`, `${tos.slug} events count`);
    requireIncludes(errors, html, `data-projects-count="${counts.projects}"`, `${tos.slug} projects count`);
    requireIncludes(errors, html, `data-done-count="${counts.done}"`, `${tos.slug} done count`);
    requireIncludes(errors, html, `data-needs-count="${counts.needs}"`, `${tos.slug} needs count`);
    requireIncludes(errors, html, `data-total-count="${total}"`, `${tos.slug} total count`);
    requireIncludes(errors, html, 'Количество показывает только опубликованные и привязанные к карточке материалы в базе портала.', `${tos.slug} scope notice`);
    requireIncludes(errors, html, 'Ноль не означает отсутствие работы ТОС', `${tos.slug} zero notice`);

    const summaryPosition = html.indexOf('id="tos-activity-summary"');
    const helpPosition = html.indexOf('id="help-this-tos"');
    if (summaryPosition < 0 || helpPosition < 0 || summaryPosition > helpPosition) {
      errors.push(`${tos.slug}: activity summary must appear before contribution actions`);
    }

    Object.entries(COLLECTIONS).forEach(([key, config]) => {
      const count = counts[key];
      if (count > 0) {
        linkedTiles += 1;
        requireIncludes(errors, html, `<a class="tile" data-activity-key="${key}" href="#${config.anchor}"`, `${tos.slug} ${key} linked tile`);
        requireIncludes(errors, html, `id="${config.anchor}"`, `${tos.slug} ${key} target section`);
      } else {
        zeroTiles += 1;
        requireIncludes(errors, html, `<div class="tile" data-activity-key="${key}"`, `${tos.slug} ${key} zero tile`);
      }
    });

    if (/ТОС (?:не работает|ничего не делает|не вед[её]т работу)/iu.test(html)) {
      errors.push(`${tos.slug}: page must not infer inactivity from missing portal materials`);
    }
  });

  if (!linkedTiles) errors.push('expected at least one linked activity tile across published TOS pages');
  if (!zeroTiles) errors.push('expected at least one zero activity tile to verify neutral empty-state wording');

  if (errors.length) throw new Error(`TOS activity summary audit failed:\n${errors.join('\n')}`);
  console.log(`TOS activity summaries OK: ${toses.length} pages, ${totalRecords} linked records, ${linkedTiles} populated tiles, ${zeroTiles} zero tiles`);
}

if (require.main === module) auditTosActivitySummary();

module.exports = { auditTosActivitySummary };
