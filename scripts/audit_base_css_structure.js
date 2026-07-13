const fs = require('fs');
const path = require('path');
const {
  CSS_PATH,
  REPORT_PATH,
  SECTIONS,
  buildStructured,
  semanticHash
} = require('./structure_base_styles_css');

const ROOT = process.cwd();
const RESPONSIVE_CSS_PATH = path.join(ROOT, 'assets', 'css', 'tos-detail-responsive.css');

function main() {
  const errors = [];
  [CSS_PATH, REPORT_PATH, RESPONSIVE_CSS_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Base CSS structure audit failed:\n${errors.join('\n')}`);

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const responsiveCss = fs.readFileSync(RESPONSIVE_CSS_PATH, 'utf8');

  let previousIndex = -1;
  SECTIONS.forEach((section) => {
    const comment = `/* ${section.number}. ${section.title} */`;
    const commentIndex = css.indexOf(comment);
    const markerIndex = css.indexOf(section.marker);

    if (commentIndex < 0) errors.push(`missing section comment ${comment}`);
    if (css.indexOf(comment, commentIndex + 1) >= 0) errors.push(`duplicate section comment ${comment}`);
    if (commentIndex <= previousIndex) errors.push(`section comment out of order ${comment}`);
    if (markerIndex < 0) errors.push(`missing section marker ${section.marker}`);
    if (commentIndex >= 0 && markerIndex >= 0 && markerIndex < commentIndex) {
      errors.push(`section marker precedes comment ${section.number}`);
    }
    if (commentIndex >= 0 && markerIndex >= 0) {
      const between = css.slice(commentIndex + comment.length, markerIndex);
      if (!/^\s*$/.test(between)) errors.push(`unexpected CSS between section ${section.number} comment and marker`);
    }
    previousIndex = commentIndex;
  });

  const sectionComments = css.match(/\/\*\s*\d{2}\.\s+[^*\n]+\*\//g) || [];
  if (sectionComments.length !== SECTIONS.length) {
    errors.push(`expected ${SECTIONS.length} numbered section comments, received ${sectionComments.length}`);
  }
  if (/\/\*\s*(16|17)\./.test(css)) errors.push('draft-only section 16 or 17 must not be present in base CSS');

  const rebuilt = buildStructured(css).css;
  if (rebuilt !== css) errors.push('base CSS structure is not idempotent');

  const currentSemanticSha256 = semanticHash(css);
  if (report.schema_version !== 1) errors.push(`unsupported report schema_version ${report.schema_version}`);
  if (report.css_path !== 'assets/css/styles.css') errors.push('report.css_path must reference assets/css/styles.css');
  if (report.sections_count !== SECTIONS.length) errors.push(`report.sections_count must equal ${SECTIONS.length}`);
  if (!Array.isArray(report.sections) || report.sections.length !== SECTIONS.length) {
    errors.push(`report.sections must contain ${SECTIONS.length} items`);
  }
  if (report.before_semantic_sha256 !== report.after_semantic_sha256) errors.push('report semantic hashes must match');
  if (report.after_semantic_sha256 !== currentSemanticSha256) errors.push('current CSS semantic hash does not match report');
  if (report.semantic_equal !== true) errors.push('report.semantic_equal must be true');
  if (report.idempotent !== true) errors.push('report.idempotent must be true');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(report.generated_at || '')) errors.push('report.generated_at must be an ISO timestamp');

  const reportSections = Array.isArray(report.sections) ? report.sections : [];
  SECTIONS.forEach((section, index) => {
    const actual = reportSections[index] || {};
    if (actual.number !== section.number || actual.title !== section.title || actual.marker !== section.marker) {
      errors.push(`report section ${index + 1} does not match structure definition`);
    }
  });

  if (/\/\*\s*16\. Intermediate desktop header/.test(css)) {
    errors.push('intermediate desktop header from draft must not be copied into base CSS');
  }
  if (/\/\*\s*17\. Mobile header/.test(css)) {
    errors.push('draft mobile header must not be copied into base CSS');
  }
  if (/\[data-action=theme\][^{]*\{[^}]*display:\s*none/s.test(css)) {
    errors.push('base CSS must not hide the theme control');
  }

  if (!responsiveCss.includes('@media (max-width: 620px)')) {
    errors.push('separate TOS responsive stylesheet must remain present');
  }
  if (!responsiveCss.includes('.actions [data-action="theme"]::after')) {
    errors.push('separate TOS responsive stylesheet must preserve the compact interactive theme control');
  }

  if (errors.length) throw new Error(`Base CSS structure audit failed:\n${errors.join('\n')}`);

  console.log(`Base CSS structure OK: ${SECTIONS.length} ordered sections, semantic SHA-256 ${currentSemanticSha256}, idempotent and visual-specific responsive CSS remains separate`);
}

main();
