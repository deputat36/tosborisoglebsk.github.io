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

const MENU_BUTTON_MARKER = `  const menuButton = $('[data-action=menu]');`;
const MENU_FOCUS_ORDER = `${MENU_BUTTON_MARKER}
  const menuFocusOrder = () => {
    const links = [...(nav?.querySelectorAll('a[href]') || [])]
      .filter((link) => link.getAttribute('aria-hidden') !== 'true' && !link.hasAttribute('disabled'));
    return menuButton ? [menuButton, ...links] : links;
  };`;

const MENU_CLICK_OLD = `    document.body.classList.toggle('menu-open', Boolean(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });`;

const MENU_CLICK_NEW = `    document.body.classList.toggle('menu-open', Boolean(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen) window.requestAnimationFrame(() => nav?.querySelector('a')?.focus());
  });`;

const ESCAPE_ORIGINAL = `  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });`;

const ESCAPE_FOCUS_RESTORE = `  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });`;

const KEYBOARD_MENU_TRAP = `  document.addEventListener('keydown', (event) => {
    if (!nav?.classList.contains('open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      return;
    }

    if (event.key !== 'Tab') return;
    const focusOrder = menuFocusOrder();
    if (focusOrder.length < 2) return;

    const trigger = menuButton;
    const firstLink = focusOrder[1] || focusOrder[0];
    const lastLink = focusOrder[focusOrder.length - 1];
    const active = document.activeElement;
    let target = null;

    if (event.shiftKey) {
      if (active === firstLink) target = trigger;
      else if (active === trigger) target = lastLink;
      else if (!focusOrder.includes(active)) target = lastLink;
    } else {
      if (active === lastLink) target = trigger;
      else if (active === trigger) target = firstLink;
      else if (!focusOrder.includes(active)) target = firstLink;
    }

    if (target) {
      event.preventDefault();
      target.focus();
    }
  });`;

function replaceMarker(content, oldMarker, newMarker, label) {
  if (content.includes(newMarker)) return { content, changed: false };
  if (!content.includes(oldMarker)) throw new Error(`${label}: source marker not found`);
  return { content: content.replace(oldMarker, newMarker), changed: true };
}

function replaceAnyMarker(content, oldMarkers, newMarker, label) {
  if (content.includes(newMarker)) return { content, changed: false };
  const oldMarker = oldMarkers.find((candidate) => content.includes(candidate));
  if (!oldMarker) throw new Error(`${label}: source marker not found`);
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
    [MENU_BUTTON_MARKER, MENU_FOCUS_ORDER, 'menu focus order'],
    [MENU_CLICK_OLD, MENU_CLICK_NEW, 'menu open focus management']
  ]) {
    const result = replaceMarker(content, oldMarker, newMarker, label);
    content = result.content;
    changed = changed || result.changed;
  }

  const keyboardResult = replaceAnyMarker(
    content,
    [ESCAPE_FOCUS_RESTORE, ESCAPE_ORIGINAL],
    KEYBOARD_MENU_TRAP,
    'menu keyboard focus trap'
  );
  content = keyboardResult.content;
  changed = changed || keyboardResult.changed;

  const required = [
    'function enhanceKeyboardAccessibility()',
    "main.setAttribute('tabindex', '-1')",
    'main.focus({ preventScroll: true })',
    'enhanceKeyboardAccessibility();',
    'restoreFocus = false',
    'const menuFocusOrder = () =>',
    "nav?.querySelectorAll('a[href]')",
    "nav?.querySelector('a')?.focus()",
    "if (event.key !== 'Tab') return;",
    'focusOrder.includes(active)',
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
