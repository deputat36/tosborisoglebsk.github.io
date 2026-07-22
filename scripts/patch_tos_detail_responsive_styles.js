const fs = require('fs');
const path = require('path');
const { patchTosRelatedContentTrust } = require('./patch_tos_related_content_trust');
const { patchCalendarCurrentState } = require('./patch_calendar_current_state');
const { patchVisualFocusCapture } = require('./patch_visual_focus_capture');
const { patchVisualBaselineExtensions } = require('./patch_visual_baseline_extensions');

const ROOT = process.cwd();
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate_tos_pages.js');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const TOS_ROOT = path.join(ROOT, 'tos');
const BASE_LINK_RE = /<link\s+rel=["']stylesheet["']\s+href=["']\/assets\/css\/styles\.css["']\s*\/?>/;
const RESPONSIVE_LINK = '<link rel="stylesheet" href="/assets/css/tos-detail-responsive.css"/>';

function patchHtml(content, label) {
  if (content.includes(RESPONSIVE_LINK)) return { content, changed: false };
  const match = content.match(BASE_LINK_RE);
  if (!match) throw new Error(`${label} is missing the base stylesheet marker`);

  const indent = match.index > 0
    ? (content.slice(0, match.index).match(/(^|\n)([ \t]*)$/)?.[2] || '')
    : '';
  return {
    content: content.replace(BASE_LINK_RE, `${match[0]}\n${indent}${RESPONSIVE_LINK}`),
    changed: true
  };
}

function patchFile(filePath, label) {
  const current = fs.readFileSync(filePath, 'utf8');
  const result = patchHtml(current, label);
  if (result.changed) fs.writeFileSync(filePath, result.content, 'utf8');
  return result.changed;
}

function detailPages() {
  if (!fs.existsSync(TOSES_PATH)) throw new Error(`Missing TOS data: ${TOSES_PATH}`);
  const toses = JSON.parse(fs.readFileSync(TOSES_PATH, 'utf8'));
  return (Array.isArray(toses) ? toses : [])
    .filter((tos) => tos && tos.slug && tos.status !== 'draft')
    .map((tos) => path.join(TOS_ROOT, tos.slug, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath));
}

function main() {
  if (!fs.existsSync(GENERATOR_PATH)) throw new Error(`Missing generator: ${GENERATOR_PATH}`);

  patchTosRelatedContentTrust();
  patchCalendarCurrentState();
  patchVisualFocusCapture();
  patchVisualBaselineExtensions();

  let changed = 0;
  if (patchFile(GENERATOR_PATH, 'TOS page generator')) changed += 1;

  const pages = detailPages();
  pages.forEach((filePath) => {
    if (patchFile(filePath, path.relative(ROOT, filePath))) changed += 1;
  });

  console.log(`TOS responsive stylesheet patch OK: ${pages.length} detail pages checked, ${changed} files updated`);
}

main();
