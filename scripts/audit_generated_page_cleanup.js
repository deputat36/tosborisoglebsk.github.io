const fs = require('fs');
const path = require('path');
const { findStaleGeneratedDirectories } = require('./lib/generated_page_cleanup');
const { GENERATED_COLLECTIONS, readPublishedIds } = require('./lib/generated_collection_pages');

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const DOC_PATH = path.join(ROOT, 'docs', 'GENERATED-PAGE-CLEANUP-2026-07-14.md');
const HELPER_PATH = path.join(ROOT, 'scripts', 'lib', 'generated_page_cleanup.js');
const CLEANUP_PATH = path.join(ROOT, 'scripts', 'cleanup_generated_collection_pages.js');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_generated_page_cleanup.js');
const errors = [];

function read(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

const workflow = read(WORKFLOW_PATH, 'generation workflow');
const packageText = read(PACKAGE_PATH, 'package.json');
const projectMode = read(PROJECT_MODE_PATH, 'project-mode audit');
const projectModeFull = read(PROJECT_MODE_FULL_PATH, 'full project-mode audit');
const documentation = read(DOC_PATH, 'generated page cleanup documentation');
const helper = read(HELPER_PATH, 'generated page cleanup helper');
const cleanup = read(CLEANUP_PATH, 'generated page cleanup command');
const selfTest = read(TEST_PATH, 'generated page cleanup self-test');

for (const collection of GENERATED_COLLECTIONS) {
  let validIds = [];
  try {
    validIds = readPublishedIds(collection);
  } catch (error) {
    errors.push(`${collection.name}: ${error.message}`);
    continue;
  }

  const stale = findStaleGeneratedDirectories({
    rootDir: collection.rootDir,
    validIds,
    marker: collection.marker
  });

  stale.forEach((entry) => {
    errors.push(`${collection.name}: stale generated page ${collection.route}${entry.id}/`);
  });
}

requireTokens(helper, [
  'function findStaleGeneratedDirectories',
  'html.includes(marker)',
  'fs.rmSync(entry.directory, { recursive: true, force: true })'
], 'generated page cleanup helper');

if (/fs\.rmSync\s*\(\s*rootDir/.test(helper) || /fs\.rmSync\s*\(\s*collection\.rootDir/.test(cleanup)) {
  errors.push('cleanup must never remove an entire collection root');
}

requireTokens(cleanup, [
  "require('./lib/generated_page_cleanup')",
  "require('./lib/generated_collection_pages')",
  'removeStaleGeneratedDirectories',
  'readPublishedIds(collection)'
], 'generated page cleanup command');

requireTokens(selfTest, [
  "writePage('current-page', marker)",
  "writePage('stale-page', marker)",
  "writePage('manual-page', 'Manual page without generated marker')",
  "assert.strictEqual(fs.existsSync(path.join(tempRoot, 'manual-page', 'index.html')), true)"
], 'generated page cleanup self-test');

requireTokens(workflow, [
  "'scripts/**/*.js'",
  'Test generated page cleanup safety',
  'node scripts/test_generated_page_cleanup.js',
  'Clean stale generated collection pages',
  'node scripts/cleanup_generated_collection_pages.js',
  'Audit generated collection pages',
  'node scripts/audit_generated_page_cleanup.js'
], 'generation workflow');

let packageJson = null;
try {
  packageJson = JSON.parse(packageText);
} catch (error) {
  errors.push(`package.json is invalid JSON: ${error.message}`);
}
if (packageJson) {
  const scripts = packageJson.scripts || {};
  if (scripts['test:generated-pages'] !== 'node scripts/test_generated_page_cleanup.js') {
    errors.push('package.json must define test:generated-pages');
  }
  if (scripts['cleanup:generated-pages'] !== 'node scripts/cleanup_generated_collection_pages.js') {
    errors.push('package.json must define cleanup:generated-pages');
  }
  if (scripts['audit:generated-pages'] !== 'node scripts/audit_generated_page_cleanup.js') {
    errors.push('package.json must define audit:generated-pages');
  }
  const auditAll = String(scripts['audit:all'] || '');
  if (
    !auditAll.includes('npm run test:generated-pages')
    || !auditAll.includes('npm run cleanup:generated-pages')
    || !auditAll.includes('npm run audit:generated-pages')
  ) {
    errors.push('audit:all must include generated page self-test, cleanup and audit');
  }
}

requireTokens(projectMode, [
  "['Generated page cleanup self-test', 'scripts/test_generated_page_cleanup.js']",
  "['Generated collection pages', 'scripts/audit_generated_page_cleanup.js']"
], 'project-mode audit');
requireTokens(projectModeFull, [
  "['Generated page cleanup self-test', 'scripts/test_generated_page_cleanup.js']",
  "['Generated collection pages audit', 'scripts/audit_generated_page_cleanup.js']"
], 'full project-mode audit');

requireTokens(documentation, [
  'Охваченные коллекции',
  'Защита ручных страниц',
  'пяти наборов',
  'scripts/**/*.js',
  'Удаление ручных страниц без маркера намеренно запрещено'
], 'generated page cleanup documentation');

if (GENERATED_COLLECTIONS.length !== 5) {
  errors.push(`expected 5 generated collections, found ${GENERATED_COLLECTIONS.length}`);
}

if (errors.length) {
  throw new Error(`Generated page cleanup audit failed:\n${errors.join('\n')}`);
}

console.log(`Generated page cleanup audit OK: ${GENERATED_COLLECTIONS.length} collections, stale pages 0, manual pages protected`);
