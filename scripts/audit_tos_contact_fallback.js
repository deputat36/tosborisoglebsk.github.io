const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { patchTosContactFallback, directChannels } = require('./patch_tos_contact_fallback');

const ROOT = process.cwd();
const TOS_DATA_PATH = path.join(ROOT, 'data', 'toses.json');
const CONTACTS_PATH = path.join(ROOT, 'contacts', 'index.html');
const RELAY_SCRIPT_PATH = path.join(ROOT, 'assets', 'js', 'contact-relay.js');
const PATCHER_PATH = path.join(ROOT, 'scripts', 'patch_tos_contact_fallback.js');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_tos_contact_fallback.js');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const FULL_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function main() {
  const patchResult = patchTosContactFallback();
  const errors = [];
  const toses = JSON.parse(fs.readFileSync(TOS_DATA_PATH, 'utf8'))
    .filter((item) => item && item.slug && item.status !== 'draft');
  const withoutDirectContact = toses
    .filter((item) => directChannels(item).length === 0)
    .map((item) => item.slug)
    .sort();

  const generator = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const contacts = fs.readFileSync(CONTACTS_PATH, 'utf8');
  const relayScript = fs.readFileSync(RELAY_SCRIPT_PATH, 'utf8');
  const patcher = fs.readFileSync(PATCHER_PATH, 'utf8');
  const test = fs.readFileSync(TEST_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const fullAudit = fs.readFileSync(FULL_AUDIT_PATH, 'utf8');

  if (JSON.stringify(withoutDirectContact) !== JSON.stringify(patchResult.fallbackSlugs)) {
    errors.push(`patcher fallback set differs from data: ${patchResult.fallbackSlugs.join(', ')} vs ${withoutDirectContact.join(', ')}`);
  }
  if (!withoutDirectContact.length) errors.push('at least one current TOS must exercise the no-direct-contact fallback contract');

  requireFragments(errors, 'TOS generator', generator, [
    'function hasDirectPublicContact(tos)',
    'function contactFallback(tos)',
    'data-tos-contact-fallback',
    '/contacts/?tos=',
    'Передать сообщение через редакцию',
    'не является официальным обращением'
  ]);

  requireFragments(errors, 'contacts page', contacts, [
    'id="relay-tos"',
    'id="relay-tos-context"',
    'id="relay-tos-template"',
    'id="copy-relay-template"',
    'id="relay-copy-status"',
    '/assets/js/contact-relay.js',
    'Передача и ответ не гарантируются',
    'не заменяет официальную приёмную',
    'https://vk.ru/tosbgo',
    'tel:+79102498284'
  ]);

  requireFragments(errors, 'relay browser script', relayScript, [
    "new URLSearchParams(window.location.search)",
    "fetch('/data/toses.json'",
    'cleanParam',
    'requestMode',
    'requestedQuery',
    'requestedLocation',
    'genericTemplate()',
    'findTosTemplate()',
    'tosTemplate(item)',
    'showFindTosRequest()',
    'showCatalogReturnLink()',
    'navigator.clipboard',
    'Редакция не гарантирует передачу или ответ',
    'Он не отправлен автоматически',
    'лишних персональных данных'
  ]);

  requireFragments(errors, 'contact fallback patcher', patcher, [
    'function patchTosContactFallback()',
    'verifyMaterializedPages()',
    'module.exports = { patchTosContactFallback, directChannels }'
  ]);

  requireFragments(errors, 'contact fallback browser test', test, [
    "require('playwright')",
    "require('./patch_tos_contact_fallback')",
    'TOS_CONTACT_FALLBACK_REPORT',
    "['addressed-editorial-relay'",
    "['catalog-search-prefilled-relay'",
    "['direct-contact-without-fallback'",
    "['unknown-tos-generic-relay'",
    'Поисковый запрос:',
    'Вернуться к результатам поиска ТОС',
    'TOS contact fallback browser OK'
  ]);

  requireFragments(errors, 'visual workflow', workflow, [
    "- 'scripts/patch_tos_contact_fallback.js'",
    "- 'scripts/audit_tos_contact_fallback.js'",
    "- 'scripts/test_tos_contact_fallback.js'",
    'Check TOS contact fallback tooling syntax',
    'Apply TOS contact fallback',
    'Audit TOS contact fallback',
    'Test TOS contact fallback',
    'TOS_CONTACT_FALLBACK_REPORT: .artifacts/visual-baseline/tos-contact-fallback.json'
  ]);

  requireFragments(errors, 'full project-mode', fullAudit, [
    "require('./patch_tos_contact_fallback')",
    'patchTosContactFallback();',
    "['TOS contact fallback audit', 'scripts/audit_tos_contact_fallback.js']"
  ]);

  for (const tos of toses) {
    const html = fs.readFileSync(path.join(ROOT, 'tos', tos.slug, 'index.html'), 'utf8');
    const fallbackCount = (html.match(/data-tos-contact-fallback=/g) || []).length;
    const expected = directChannels(tos).length === 0;
    if (fallbackCount !== (expected ? 1 : 0)) {
      errors.push(`${tos.slug}: fallback count ${fallbackCount}, expected ${expected ? 1 : 0}`);
    }
    if (expected && !html.includes(`/contacts/?tos=${encodeURIComponent(tos.slug)}#relay-tos`)) {
      errors.push(`${tos.slug}: missing addressed relay URL`);
    }
  }

  ['sendBeacon', 'XMLHttpRequest', 'WebSocket'].forEach((signal) => {
    if (relayScript.includes(signal)) errors.push(`relay browser script must remain read-only: ${signal}`);
  });
  if (/fetch\([^)]*,\s*\{[^}]*method\s*:/s.test(relayScript)) {
    errors.push('relay browser script must not send network writes');
  }
  if (/localStorage|sessionStorage/.test(relayScript)) {
    errors.push('relay browser script must not store message or personal data');
  }
  if (!relayScript.includes('.slice(0, limit)')) {
    errors.push('relay browser script must bound URL-provided context length');
  }
  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('contact fallback visual workflow must remain read-only');
  }

  try {
    [PATCHER_PATH, RELAY_SCRIPT_PATH, TEST_PATH, __filename].forEach((filePath) => {
      execFileSync(process.execPath, ['--check', filePath], { cwd: ROOT, stdio: 'pipe' });
    });
  } catch (error) {
    errors.push(`contact fallback syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`TOS contact fallback audit failed:\n${errors.join('\n')}`);
  console.log(`TOS contact fallback OK: ${withoutDirectContact.length} addressed fallback pages, catalog search prefill guarded, ${toses.length - withoutDirectContact.length} direct-contact pages`);
}

main();
