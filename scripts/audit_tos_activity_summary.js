const fs = require('fs');
const path = require('path');
const { patchTosActivitySummary, MARKER } = require('./patch_tos_activity_summary');
const { coverageFor } = require('./lib/content_coverage');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const COLLECTIONS = {
  news: { path: path.join(ROOT, 'data', 'news.json'), anchor: 'tos-news', originAware: true },
  events: { path: path.join(ROOT, 'data', 'events.json'), anchor: 'tos-events', originAware: false },
  projects: { path: path.join(ROOT, 'data', 'projects.json'), anchor: 'tos-projects', originAware: true },
  done: { path: path.join(ROOT, 'data', 'done.json'), anchor: 'tos-done', originAware: true },
  needs: { path: path.join(ROOT, 'data', 'needs.json'), anchor: 'tos-needs', originAware: true }
};

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function requireIncludes(errors, content, fragment, label) {
  if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
}

function expectedState(collectionData, slug) {
  return Object.fromEntries(Object.entries(COLLECTIONS).map(([key, config]) => [
    key,
    coverageFor(collectionData[key], slug, config.originAware ? key : 'events')
  ]));
}

function requestTarget(states) {
  for (const key of ['news', 'done', 'needs', 'projects']) {
    if (states[key].requests > 0) return COLLECTIONS[key].anchor;
  }
  return '';
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
  requireIncludes(errors, generator, "require('./lib/content_coverage')", 'generator content coverage import');
  requireIncludes(errors, generator, 'function activitySummary(tos, data)', 'generator helper');
  requireIncludes(errors, generator, 'data-request-count=', 'generator request count');
  requireIncludes(errors, generator, 'data-all-records-count=', 'generator all records count');
  requireIncludes(errors, generator, 'содержательных публикаций', 'generator substantive label');
  requireIncludes(errors, generator, 'редакционных запросов', 'generator request label');
  requireIncludes(errors, generator, 'Ноль не означает отсутствие работы ТОС', 'generator neutral wording');
  requireIncludes(errors, generator, 'не засчитываются, если запись является только просьбой редакции', 'generator request boundary');

  let linkedTiles = 0;
  let zeroTiles = 0;
  let substantiveRecords = 0;
  let requestRecords = 0;

  toses.forEach((tos) => {
    const pagePath = path.join(ROOT, 'tos', tos.slug, 'index.html');
    const html = read(pagePath);
    const states = expectedState(collectionData, tos.slug);
    const counts = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.substantive]));
    const requests = states.news.requests + states.projects.requests + states.done.requests + states.needs.requests;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const allRecords = total + requests;
    substantiveRecords += total;
    requestRecords += requests;

    requireIncludes(errors, html, 'id="tos-activity-summary" data-tos-activity-summary', `${tos.slug} summary`);
    requireIncludes(errors, html, `data-tos-slug="${tos.slug}"`, `${tos.slug} summary slug`);
    requireIncludes(errors, html, `data-news-count="${counts.news}"`, `${tos.slug} news count`);
    requireIncludes(errors, html, `data-events-count="${counts.events}"`, `${tos.slug} events count`);
    requireIncludes(errors, html, `data-projects-count="${counts.projects}"`, `${tos.slug} projects count`);
    requireIncludes(errors, html, `data-done-count="${counts.done}"`, `${tos.slug} done count`);
    requireIncludes(errors, html, `data-needs-count="${counts.needs}"`, `${tos.slug} needs count`);
    requireIncludes(errors, html, `data-request-count="${requests}"`, `${tos.slug} request count`);
    requireIncludes(errors, html, `data-total-count="${total}"`, `${tos.slug} substantive total`);
    requireIncludes(errors, html, `data-all-records-count="${allRecords}"`, `${tos.slug} all records count`);
    requireIncludes(errors, html, `Таких запросов в карточке: ${requests}.`, `${tos.slug} request explanation`);
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

    const target = requestTarget(states);
    if (requests > 0) {
      linkedTiles += 1;
      requireIncludes(errors, html, `<a class="tile" data-activity-key="requests" href="#${target}"`, `${tos.slug} request linked tile`);
      requireIncludes(errors, html, `id="${target}"`, `${tos.slug} request target section`);
    } else {
      zeroTiles += 1;
      requireIncludes(errors, html, '<div class="tile" data-activity-key="requests"', `${tos.slug} request zero tile`);
    }

    if (/ТОС (?:не работает|ничего не делает|не вед[её]т работу)/iu.test(html)) {
      errors.push(`${tos.slug}: page must not infer inactivity from missing portal materials`);
    }
  });

  if (!linkedTiles) errors.push('expected at least one linked activity tile across published TOS pages');
  if (!zeroTiles) errors.push('expected at least one zero activity tile to verify neutral empty-state wording');
  if (!requestRecords) errors.push('expected editorial requests to exercise separate request counters');

  if (errors.length) throw new Error(`TOS activity summary audit failed:\n${errors.join('\n')}`);
  console.log(`TOS activity summaries OK: ${toses.length} pages, ${substantiveRecords} substantive records, ${requestRecords} editorial requests, ${linkedTiles} linked tiles, ${zeroTiles} zero tiles`);
}

if (require.main === module) auditTosActivitySummary();

module.exports = { auditTosActivitySummary };
