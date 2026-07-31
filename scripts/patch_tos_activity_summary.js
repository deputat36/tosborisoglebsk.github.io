const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const MARKER = "const TOS_ACTIVITY_SUMMARY_VERSION = '2026-07-25';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS activity summary patch marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (current.includes(MARKER) && current.includes('data-request-count=')) return { content: current, changed: false };

  let source = current;
  if (!source.includes("require('./lib/content_coverage')")) {
    source = replaceOrFail(
      source,
      /(const \{ inferContentOrigin[^\n]+require\('\.\/lib\/content_origin'\);)/,
      `$1\nconst { coverageFor } = require('./lib/content_coverage');`,
      'content coverage import'
    );
  }

  source = replaceOrFail(
    source,
    /const TOS_ACTIVITY_SUMMARY_VERSION = '[^']+';/,
    MARKER,
    'version marker'
  );

  source = replaceOrFail(
    source,
    /function publishedCount\(items, slug\) \{[\s\S]*?\n\}\nfunction block/,
    `function requestAnchor(states) {
  if (states.news.requests > 0) return 'tos-news';
  if (states.done.requests > 0) return 'tos-done';
  if (states.needs.requests > 0) return 'tos-needs';
  if (states.projects.requests > 0) return 'tos-projects';
  return '';
}
function activityTile(key, label, count, anchor = '') {
  const body = \`<b>\${esc(count)}</b><span>\${esc(label)}</span>\`;
  const ariaLabel = \`\${label}: \${count}\`;
  return count > 0 && anchor
    ? \`<a class="tile" data-activity-key="\${esc(key)}" href="#\${esc(anchor)}" aria-label="\${esc(ariaLabel)}">\${body}</a>\`
    : \`<div class="tile" data-activity-key="\${esc(key)}" aria-label="\${esc(ariaLabel)}">\${body}</div>\`;
}
function activitySummary(tos, data) {
  const states = {
    news: coverageFor(data.news, tos.slug, 'news'),
    events: coverageFor(data.events, tos.slug, 'events'),
    projects: coverageFor(data.projects, tos.slug, 'projects'),
    done: coverageFor(data.done, tos.slug, 'done'),
    needs: coverageFor(data.needs, tos.slug, 'needs')
  };
  const counts = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.substantive]));
  const requests = states.news.requests + states.projects.requests + states.done.requests + states.needs.requests;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const allRecords = total + requests;
  const tiles = [
    activityTile('news', 'содержательных публикаций', counts.news, 'tos-news'),
    activityTile('events', 'событий и дат', counts.events, 'tos-events'),
    activityTile('projects', 'проектов и идей', counts.projects, 'tos-projects'),
    activityTile('done', 'историй результата', counts.done, 'tos-done'),
    activityTile('needs', 'актуальных потребностей', counts.needs, 'tos-needs'),
    activityTile('requests', 'редакционных запросов', requests, requestAnchor(states))
  ].join('');
  return \`<section class="section tight" id="tos-activity-summary" data-tos-activity-summary data-tos-slug="\${esc(tos.slug)}" data-news-count="\${counts.news}" data-events-count="\${counts.events}" data-projects-count="\${counts.projects}" data-done-count="\${counts.done}" data-needs-count="\${counts.needs}" data-request-count="\${requests}" data-total-count="\${total}" data-all-records-count="\${allRecords}"><div class="container section-head"><div><h2>Материалы ТОС на портале</h2><p>Содержательные публикации учитываются отдельно от редакционных запросов на сбор и уточнение сведений.</p></div></div><div class="container kpi">\${tiles}</div><div class="container notice" data-activity-summary-notice><b>Как читать счётчики:</b> новости, результаты и потребности не засчитываются, если запись является только просьбой редакции прислать или уточнить материал. Таких запросов в карточке: \${requests}. Ноль не означает отсутствие работы ТОС — он означает, что на портале пока нет соответствующей содержательной публикации.</div></section>\`;
}
function block`,
    'origin-aware activity helpers'
  );

  if (!source.includes("const { coverageFor } = require('./lib/content_coverage');")) throw new Error('Patched generator is missing content coverage import');
  if (!source.includes('data-request-count=')) throw new Error('Patched generator is missing request count');
  if (!source.includes('редакционных запросов')) throw new Error('Patched generator is missing request tile');
  return { content: source, changed: true };
}

function regeneratePagesWithoutChangingSitemap() {
  const hadSitemap = fs.existsSync(SITEMAP_PATH);
  const sitemapBefore = hadSitemap ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';

  try {
    execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });
  } finally {
    if (hadSitemap) fs.writeFileSync(SITEMAP_PATH, sitemapBefore, 'utf8');
    else fs.rmSync(SITEMAP_PATH, { force: true });
  }
}

function patchTosActivitySummary({ regenerate = true } = {}) {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);
  const current = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(GENERATOR_PATH, result.content, 'utf8');

  if (regenerate) regeneratePagesWithoutChangingSitemap();

  console.log(`TOS activity summary patch ${result.changed ? 'applied' : 'already current'}${regenerate ? '; pages regenerated, sitemap preserved' : ''}`);
  return result.changed;
}

if (require.main === module) patchTosActivitySummary();

module.exports = { MARKER, patchSource, patchTosActivitySummary };
