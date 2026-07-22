const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CAPTURE_PATH = path.join(ROOT, 'scripts', 'capture_visual_baseline.js');
const MARKER = 'const FOCUS_TARGETS = Object.freeze({';

const FOCUS_CONSTANTS = `const FOCUS_TARGETS = Object.freeze({
  'focus-catalog': Object.freeze({ selector: '#catalog', readySelector: '#tos-list .card' }),
  'focus-places': Object.freeze({ selector: '#places-browser', readySelector: '#places-grid .card' })
});`;

const POSITION_FUNCTION = `async function positionPageForCapture(page, item) {
  const target = FOCUS_TARGETS[item.interaction];
  if (!target) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    return null;
  }

  const focusElement = page.locator(target.selector);
  await focusElement.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator(target.readySelector).first().waitFor({ state: 'visible', timeout: 5000 });
  const readyCount = await page.locator(target.readySelector).count();

  await focusElement.evaluate((element) => {
    element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
  });
  const headerOffset = await page.evaluate(() => {
    const headerHeight = document.querySelector('.header')?.getBoundingClientRect().height || 0;
    return Math.ceil(headerHeight) + 16;
  });
  await page.evaluate((offset) => window.scrollBy(0, -offset), headerOffset);
  await page.waitForTimeout(200);

  const metrics = await focusElement.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight,
      scrollY: Math.round(window.scrollY)
    };
  });

  if (!metrics.visible) throw new Error(\`Focus target is outside viewport: \${target.selector}\`);
  if (readyCount < 1) throw new Error(\`Dynamic content did not load: \${target.readySelector}\`);
  if (metrics.top < headerOffset - 2) throw new Error(\`Focus target is covered by the sticky header: \${target.selector}\`);

  return {
    selector: target.selector,
    ready_selector: target.readySelector,
    ready_count: readyCount,
    header_offset: headerOffset,
    ...metrics
  };
}`;

function patchSource(source) {
  if (source.includes(MARKER)) return { content: source, changed: false };

  let content = source;
  const baseUrlLine = "const BASE_URL = String(process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');";
  if (!content.includes(baseUrlLine)) throw new Error('capture_visual_baseline.js: BASE_URL marker not found');
  content = content.replace(baseUrlLine, `${baseUrlLine}\n\n${FOCUS_CONSTANTS}`);

  const interactionPattern = /(async function applyThemeAndInteraction\(page, item\) \{[\s\S]*?\n\})\n\nfunction buildTechnicalViolations/;
  const interactionMatch = content.match(interactionPattern);
  if (!interactionMatch) throw new Error('capture_visual_baseline.js: interaction function not found');
  content = content.replace(interactionPattern, `${interactionMatch[1]}\n\n${POSITION_FUNCTION}\n\nfunction buildTechnicalViolations`);

  const scrollBlock = `  await page.evaluate(() => window.scrollTo(0, 0));\n  await page.waitForTimeout(100);`;
  if (!content.includes(scrollBlock)) throw new Error('capture_visual_baseline.js: top-scroll block not found');
  content = content.replace(scrollBlock, '  const focusCapture = await positionPageForCapture(page, item);');

  const resultMarker = `    expected_check: item.expected_check,\n    screenshot: fileName,`;
  if (!content.includes(resultMarker)) throw new Error('capture_visual_baseline.js: result marker not found');
  content = content.replace(resultMarker, `    expected_check: item.expected_check,\n    focus_capture: focusCapture,\n    screenshot: fileName,`);

  return { content, changed: true };
}

function patchVisualFocusCapture() {
  if (!fs.existsSync(CAPTURE_PATH)) throw new Error(`Missing capture script: ${CAPTURE_PATH}`);
  const current = fs.readFileSync(CAPTURE_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(CAPTURE_PATH, result.content, 'utf8');
  console.log(`Visual focus capture patch OK: ${result.changed ? 'capture script updated' : 'already current'}`);
  return result.changed;
}

if (require.main === module) patchVisualFocusCapture();

module.exports = { MARKER, patchSource, patchVisualFocusCapture };
