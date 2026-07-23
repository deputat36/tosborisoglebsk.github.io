const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_SCRIPT_PATH = path.join(ROOT, 'assets', 'js', 'site.js');

const ENHANCE_FUNCTION = `function enhanceKeyboardAccessibility() {
  const skipLink = $('.skip-link');
  const main = $('#main');
  if (!skipLink || !main) return;

  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
  skipLink.addEventListener('click', () => {
    window.requestAnimationFrame(() => main.focus({ preventScroll: true }));
  });
}`;

const INIT_MARKER = 'function initCommonUi() {';
const INIT_CALL_MARKER = '  patchTosDetailRuntime();';
const INIT_CALL_REPLACEMENT = `${INIT_CALL_MARKER}\n  enhanceKeyboardAccessibility();`;

const CLOSE_MENU_OLD = `  const closeMenu = () => {
    nav?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
  };`;

const CLOSE_MENU_NEW = `  const closeMenu = ({ restoreFocus = false } = {}) => {
    const wasOpen = Boolean(nav?.classList.contains('open'));
    nav?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
    if (restoreFocus && wasOpen) menuButton?.focus();
  };`;

const MENU_CLICK_OLD = `    document.body.classList.toggle('menu-open', Boolean(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });`;

const MENU_CLICK_NEW = `    document.body.classList.toggle('menu-open', Boolean(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) window.requestAnimationFrame(() => nav?.querySelector('a')?.focus());
  });`;

const ESCAPE_OLD = `  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });`;

const ESCAPE_NEW = `  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });`;

function replaceMarker(content, oldMarker, newMarker, label) {
  if (content.includes(newMarker)) return { content, changed: false };
  if (!content.includes(oldMarker)) throw new Error(`${label}: source marker not found`);
  return { content: content.replace(oldMarker, newMarker), changed: true };
}

function patchKeyboardAccessibility() {
  if (!fs.existsSync(SITE_SCRIPT_PATH)) throw new Error(`Missing site script: ${SITE_SCRIPT_PATH}`);

  let content = fs.readFileSync(SITE_SCRIPT_PATH, 'utf8');
  let changed = false;

  if (!content.includes(ENHANCE_FUNCTION)) {
    if (!content.includes(INIT_MARKER)) throw new Error('Keyboard accessibility function insertion marker not found');
    content = content.replace(INIT_MARKER, `${ENHANCE_FUNCTION}\n\n${INIT_MARKER}`);
    changed = true;
  }

  for (const [oldMarker, newMarker, label] of [
    [INIT_CALL_MARKER, INIT_CALL_REPLACEMENT, 'keyboard accessibility initializer'],
    [CLOSE_MENU_OLD, CLOSE_MENU_NEW, 'menu close focus management'],
    [MENU_CLICK_OLD, MENU_CLICK_NEW, 'menu open focus management'],
    [ESCAPE_OLD, ESCAPE_NEW, 'menu Escape focus restoration']
  ]) {
    const result = replaceMarker(content, oldMarker, newMarker, label);
    content = result.content;
    changed = changed || result.changed;
  }

  const required = [
    'function enhanceKeyboardAccessibility()',
    "main.setAttribute('tabindex', '-1')",
    'main.focus({ preventScroll: true })',
    'enhanceKeyboardAccessibility();',
    'restoreFocus = false',
    "nav?.querySelector('a')?.focus()",
    'closeMenu({ restoreFocus: true })'
  ];
  required.forEach((fragment) => {
    if (!content.includes(fragment)) throw new Error(`Patched site.js is missing ${fragment}`);
  });

  if (changed) fs.writeFileSync(SITE_SCRIPT_PATH, content, 'utf8');
  console.log(`Keyboard accessibility patch OK: site.js ${changed ? 'updated' : 'already current'}`);
  return { changed };
}

if (require.main === module) patchKeyboardAccessibility();

module.exports = { patchKeyboardAccessibility };
