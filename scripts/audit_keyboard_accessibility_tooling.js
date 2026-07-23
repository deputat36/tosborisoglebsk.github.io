const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { patchKeyboardAccessibility } = require('./patch_keyboard_accessibility');

const ROOT = process.cwd();
const SITE_SCRIPT_PATH = path.join(ROOT, 'assets', 'js', 'site.js');
const PATCHER_PATH = path.join(ROOT, 'scripts', 'patch_keyboard_accessibility.js');
const TEST_PATH = path.join(ROOT, 'scripts', 'test_keyboard_accessibility.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const FULL_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function main() {
  patchKeyboardAccessibility();

  const errors = [];
  const siteScript = read(SITE_SCRIPT_PATH);
  const patcher = read(PATCHER_PATH);
  const test = read(TEST_PATH);
  const workflow = read(WORKFLOW_PATH);
  const fullAudit = read(FULL_AUDIT_PATH);

  requireFragments(errors, 'site.js keyboard behavior', siteScript, [
    'function enhanceKeyboardAccessibility()',
    "main.setAttribute('tabindex', '-1')",
    'main.focus({ preventScroll: true })',
    'enhanceKeyboardAccessibility();',
    'restoreFocus = false',
    "nav?.querySelector('a')?.focus()",
    'closeMenu({ restoreFocus: true })'
  ]);

  requireFragments(errors, 'keyboard patcher', patcher, [
    'function patchKeyboardAccessibility()',
    'Keyboard accessibility patch OK',
    "module.exports = { patchKeyboardAccessibility }"
  ]);

  requireFragments(errors, 'keyboard browser test', test, [
    "require('playwright')",
    "require('./patch_keyboard_accessibility')",
    'KEYBOARD_ACCESSIBILITY_REPORT',
    "['skip-link-focus'",
    "['mobile-menu-focus'",
    "['theme-keyboard-toggle'",
    "['catalog-tab-order'",
    "page.keyboard.press('Tab')",
    "page.keyboard.press('Enter')",
    "page.keyboard.press('Escape')",
    "page.keyboard.press('Shift+Tab')",
    'Keyboard accessibility OK'
  ]);

  requireFragments(errors, 'visual workflow', workflow, [
    "- 'scripts/patch_keyboard_accessibility.js'",
    "- 'scripts/test_keyboard_accessibility.js'",
    "- 'scripts/audit_keyboard_accessibility_tooling.js'",
    'Check keyboard accessibility tooling syntax',
    'node --check scripts/patch_keyboard_accessibility.js',
    'node --check scripts/test_keyboard_accessibility.js',
    'Apply keyboard accessibility behavior',
    'node scripts/patch_keyboard_accessibility.js',
    'Test keyboard accessibility',
    'KEYBOARD_ACCESSIBILITY_REPORT: .artifacts/visual-baseline/keyboard-accessibility.json',
    'node scripts/test_keyboard_accessibility.js'
  ]);

  requireFragments(errors, 'full project-mode', fullAudit, [
    "require('./patch_keyboard_accessibility')",
    'patchKeyboardAccessibility();',
    "['Keyboard accessibility tooling audit', 'scripts/audit_keyboard_accessibility_tooling.js']"
  ]);

  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(workflow)) {
    errors.push('keyboard accessibility workflow must remain read-only');
  }

  const scenarioMatches = [...test.matchAll(/\['(?:skip-link-focus|mobile-menu-focus|theme-keyboard-toggle|catalog-tab-order)'/g)];
  if (scenarioMatches.length !== 4) errors.push(`keyboard browser test must declare 4 scenarios, received ${scenarioMatches.length}`);

  try {
    [PATCHER_PATH, TEST_PATH, __filename].forEach((filePath) => {
      execFileSync(process.execPath, ['--check', filePath], { cwd: ROOT, stdio: 'pipe' });
    });
  } catch (error) {
    errors.push(`keyboard accessibility syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Keyboard accessibility tooling audit failed:\n${errors.join('\n')}`);
  console.log('Keyboard accessibility tooling OK: skip-link focus, mobile menu focus restoration, theme keyboard toggle and catalog tab order');
}

main();
