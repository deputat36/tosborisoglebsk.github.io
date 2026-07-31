const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { coverageFor } = require('./lib/content_coverage');
const { patchSource, patchTosContentActions, MARKER } = require('./patch_tos_content_actions');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_tos_content_actions.js');
const ACTIVITY_PATCH_PATH = path.join(ROOT, 'scripts', 'patch_tos_activity_summary.js');
const ACTIVITY_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_tos_activity_summary.js');
const ACTIVITY_TEST_PATH = path.join(ROOT, 'scripts', 'test_tos_activity_summary.js');
const DATA_FILES = {
  toses: 'toses.json',
  news: 'news.json',
  done: 'done.json',
  needs: 'needs.json'
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8'));
}

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function expectedState(tos, data) {
  const states = {
    news: coverageFor(data.news, tos.slug, 'news'),
    done: coverageFor(data.done, tos.slug, 'done'),
    needs: coverageFor(data.needs, tos.slug, 'needs')
  };
  const needed = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.substantive === 0]));
  return {
    states,
    needed,
    actionCount: Object.values(needed).filter(Boolean).length,
    requestCount: Object.values(states).reduce((sum, value) => sum + value.requests, 0)
  };
}

function markerCount(content, marker) {
  return (content.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

function auditTosContentActions() {
  const errors = [];
  patchTosContentActions();

  const data = Object.fromEntries(Object.entries(DATA_FILES).map(([key, name]) => [key, readJson(name)]));
  const toses = data.toses.filter((item) => item && item.slug && item.status !== 'draft');
  const generator = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const test = fs.readFileSync(TEST_PATH, 'utf8');
  const activityPatch = fs.readFileSync(ACTIVITY_PATCH_PATH, 'utf8');
  const activityAudit = fs.readFileSync(ACTIVITY_AUDIT_PATH, 'utf8');
  const activityTest = fs.readFileSync(ACTIVITY_TEST_PATH, 'utf8');

  requireFragments(errors, 'generator', generator, [
    MARKER,
    "const { coverageFor } = require('./lib/content_coverage');",
    'function contentActionPlan(tos, data)',
    'data-tos-content-action-plan',
    'Что полезно прислать следующим',
    'После появления конкретной проверенной публикации соответствующий пункт исчезнет автоматически.',
    'Другие способы участия',
    "updateUrl(tos, 'event')"
  ]);

  const firstPatch = patchSource(generator);
  const secondPatch = patchSource(firstPatch.content);
  if (firstPatch.changed || secondPatch.changed) errors.push('content action patch must be idempotent after materialization');

  let maxActions = null;
  let minActions = null;

  toses.forEach((tos) => {
    const expected = expectedState(tos, data);
    const pagePath = path.join(ROOT, 'tos', tos.slug, 'index.html');
    if (!fs.existsSync(pagePath)) {
      errors.push(`${tos.slug}: generated page is missing`);
      return;
    }
    const html = fs.readFileSync(pagePath, 'utf8');
    const planMarker = `data-tos-content-action-plan data-tos-slug="${tos.slug}"`;
    if (markerCount(html, planMarker) !== 1) errors.push(`${tos.slug}: expected exactly one personalized content plan`);
    if (!html.includes(`data-news-needed="${expected.needed.news}"`)) errors.push(`${tos.slug}: incorrect news-needed state`);
    if (!html.includes(`data-done-needed="${expected.needed.done}"`)) errors.push(`${tos.slug}: incorrect done-needed state`);
    if (!html.includes(`data-needs-needed="${expected.needed.needs}"`)) errors.push(`${tos.slug}: incorrect needs-needed state`);
    if (!html.includes(`data-request-count="${expected.requestCount}"`)) errors.push(`${tos.slug}: incorrect editorial request count`);
    if (!html.includes(`data-action-count="${expected.actionCount}"`)) errors.push(`${tos.slug}: incorrect action count`);

    ['news', 'done', 'needs'].forEach((key) => {
      const count = markerCount(html, `data-content-action="${key}"`);
      if (count !== (expected.needed[key] ? 1 : 0)) {
        errors.push(`${tos.slug}: ${key} action count ${count}, expected ${expected.needed[key] ? 1 : 0}`);
      }
    });

    if (expected.needed.news && !html.includes(`/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=news#message-builder`)) {
      errors.push(`${tos.slug}: addressed news action is missing`);
    }
    if (expected.needed.done && !html.includes(`/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=photo#message-builder`)) {
      errors.push(`${tos.slug}: addressed result action is missing`);
    }
    if (expected.needed.needs && !html.includes(`/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=need#message-builder`)) {
      errors.push(`${tos.slug}: addressed need action is missing`);
    }

    requireFragments(errors, `${tos.slug} secondary actions`, html, [
      'Другие способы участия',
      `/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=card#message-builder`,
      `/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=project#message-builder`,
      `/update-tos/?tos=${encodeURIComponent(tos.slug)}&amp;type=event#message-builder`,
      'отсутствие записи на портале не означает, что ТОС не ведёт такую работу'
    ]);

    const summary = { slug: tos.slug, name: tos.name, ...expected };
    if (!maxActions || summary.actionCount > maxActions.actionCount) maxActions = summary;
    if (!minActions || summary.actionCount < minActions.actionCount) minActions = summary;
  });

  if (!maxActions || maxActions.actionCount < 2) errors.push('audit needs a current TOS with multiple content gaps');
  if (!minActions || minActions.actionCount > 1) errors.push('audit needs a current TOS with a focused single content gap');

  requireFragments(errors, 'browser test', test, [
    "require('playwright')",
    "require('./lib/content_coverage')",
    'TOS_CONTENT_ACTIONS_REPORT',
    'multi-gap-plan',
    'focused-plan',
    'addressed-content-action',
    'TOS content actions browser OK',
    'module.exports = { testTosContentActions }'
  ]);

  requireFragments(errors, 'activity patch integration', activityPatch, [
    "require('./patch_tos_content_actions')",
    'patchTosContentActions({ regenerate: false });'
  ]);
  requireFragments(errors, 'activity audit integration', activityAudit, [
    "require('./audit_tos_content_actions')",
    'auditTosContentActions();'
  ]);
  requireFragments(errors, 'activity browser integration', activityTest, [
    "require('./test_tos_content_actions')",
    'await testTosContentActions();'
  ]);

  try {
    [GENERATOR_PATH, TEST_PATH, __filename, path.join(ROOT, 'scripts', 'patch_tos_content_actions.js')].forEach((filePath) => {
      execFileSync(process.execPath, ['--check', filePath], { cwd: ROOT, stdio: 'pipe' });
    });
  } catch (error) {
    errors.push(`content action syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`TOS content actions audit failed:\n${errors.join('\n')}`);
  console.log(`TOS content actions OK: ${toses.length} plans; max ${maxActions.slug}=${maxActions.actionCount}, min ${minActions.slug}=${minActions.actionCount}`);
  return { total: toses.length, maxActions, minActions };
}

if (require.main === module) auditTosContentActions();

module.exports = { auditTosContentActions };
