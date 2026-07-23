const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const MARKER = "const TOS_ACTIVITY_SUMMARY_VERSION = '2026-07-23';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS activity summary patch marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (current.includes(MARKER)) return { content: current, changed: false };

  let source = current;
  source = replaceOrFail(
    source,
    /(const RELATED_CONTENT_TRUST_VERSION = '2026-07-21';)/,
    `$1\n${MARKER}`,
    'version marker'
  );

  source = replaceOrFail(
    source,
    /function block\(title, subtitle, linkText, linkUrl, content, layout = 'list'\) \{[\s\S]*?\n\}\nfunction actionCard/,
    `function publishedCount(items, slug) {
  return arr(items).filter(item => isPublished(item) && item.tos_slug === slug).length;
}
function activityTile(key, label, count, anchor) {
  const body = \`<b>\${esc(count)}</b><span>\${esc(label)}</span>\`;
  return count > 0
    ? \`<a class="tile" data-activity-key="\${esc(key)}" href="#\${esc(anchor)}" aria-label="\${esc(\`${label}: ${count}\`)}">\${body}</a>\`
    : \`<div class="tile" data-activity-key="\${esc(key)}" aria-label="\${esc(\`${label}: ${count}\`)}">\${body}</div>\`;
}
function activitySummary(tos, data) {
  const counts = {
    news: publishedCount(data.news, tos.slug),
    events: publishedCount(data.events, tos.slug),
    projects: publishedCount(data.projects, tos.slug),
    done: publishedCount(data.done, tos.slug),
    needs: publishedCount(data.needs, tos.slug)
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const tiles = [
    activityTile('news', 'новостей и материалов', counts.news, 'tos-news'),
    activityTile('events', 'событий и дат', counts.events, 'tos-events'),
    activityTile('projects', 'проектов и идей', counts.projects, 'tos-projects'),
    activityTile('done', 'результатов и историй', counts.done, 'tos-done'),
    activityTile('needs', 'потребностей и запросов', counts.needs, 'tos-needs')
  ].join('');
  return \`<section class="section tight" id="tos-activity-summary" data-tos-activity-summary data-tos-slug="\${esc(tos.slug)}" data-news-count="\${counts.news}" data-events-count="\${counts.events}" data-projects-count="\${counts.projects}" data-done-count="\${counts.done}" data-needs-count="\${counts.needs}" data-total-count="\${total}"><div class="container section-head"><div><h2>Материалы ТОС на портале</h2><p>Сводка опубликованных записей, привязанных к этой карточке.</p></div></div><div class="container kpi">\${tiles}</div><div class="container notice" data-activity-summary-notice><b>Как читать счётчики:</b> количество показывает только опубликованные и привязанные к карточке материалы в базе портала. Ноль не означает отсутствие работы ТОС — это означает, что на портале пока нет соответствующих опубликованных записей.</div></section>\`;
}
function block(title, subtitle, linkText, linkUrl, content, layout = 'list', sectionId = '') {
  if (!content) return '';
  const idAttribute = sectionId ? \` id="\${esc(sectionId)}"\` : '';
  return \`<section class="section"\${idAttribute}><div class="container section-head"><div><h2>\${esc(title)}</h2><p>\${esc(subtitle)}</p></div>\${linkUrl ? \`<a class="btn" href="\${esc(linkUrl)}">\${esc(linkText || 'Открыть')}</a>\` : ''}</div><div class="container \${layout}">\${content}</div></section>\`;
}
function actionCard`,
    'activity helpers and section ids'
  );

  source = replaceOrFail(
    source,
    /(  const relNeeds = related\(data\.needs, tos\.slug, 6\)\.map\(needCard\)\.join\(''\);)/,
    `$1\n  const activitySummaryHtml = activitySummary(tos, data);`,
    'activity summary value'
  );

  source = replaceOrFail(
    source,
    /(    \$\{clarifyBlock\(tos, qualityScore, verification\)\}\n)/,
    `$1\n    \${activitySummaryHtml}\n`,
    'activity summary placement'
  );

  const sectionCalls = [
    ["relNews, 'list')}", "relNews, 'list', 'tos-news') }"],
    ["relEvents, 'list')}", "relEvents, 'list', 'tos-events') }"],
    ["relProjects, 'grid')}", "relProjects, 'grid', 'tos-projects') }"],
    ["relDone, 'list')}", "relDone, 'list', 'tos-done') }"],
    ["relNeeds, 'list')}", "relNeeds, 'list', 'tos-needs') }"],
  ];

  sectionCalls.forEach(([oldMarker, newMarker]) => {
    if (!source.includes(oldMarker)) throw new Error(`TOS activity summary patch marker not found: ${oldMarker}`);
    source = source.replace(oldMarker, newMarker);
  });

  return { content: source, changed: true };
}

function patchTosActivitySummary({ regenerate = true } = {}) {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);
  const current = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(GENERATOR_PATH, result.content, 'utf8');

  if (regenerate) execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: 'inherit' });

  console.log(`TOS activity summary patch ${result.changed ? 'applied' : 'already current'}${regenerate ? '; pages regenerated' : ''}`);
  return result.changed;
}

if (require.main === module) patchTosActivitySummary();

module.exports = { MARKER, patchSource, patchTosActivitySummary };
