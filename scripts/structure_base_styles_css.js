const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const CSS_PATH = path.join(ROOT, 'assets', 'css', 'styles.css');
const REPORT_PATH = path.join(ROOT, 'data', 'base_css_structure_report.json');

const SECTIONS = [
  { number: '01', title: 'Design tokens', marker: ':root{' },
  { number: '02', title: 'Dark theme tokens', marker: '[data-theme=dark]{' },
  { number: '03', title: 'Base and accessibility', marker: '*{box-sizing:border-box}' },
  { number: '04', title: 'Header and navigation', marker: '.header{' },
  { number: '05', title: 'Buttons and menu control', marker: '.btn{' },
  { number: '06', title: 'Hero and action groups', marker: '.hero{' },
  { number: '07', title: 'Sections, grids and cards', marker: '.section{' },
  { number: '08', title: 'Status, metrics, forms and media', marker: '.meta{' },
  { number: '09', title: 'Content, footer, lists and tables', marker: '.prose{' },
  { number: '10', title: 'Statistics', marker: '.stats-grid{' },
  { number: '11', title: 'Homepage-specific blocks', marker: '.home-panel{' },
  { number: '12', title: 'Responsive layout', marker: '@media(max-width:900px){' },
  { number: '13', title: 'Supporting utilities', marker: '.quick-list{' },
  { number: '14', title: 'Semantic badges and template accents', marker: '.badge-city{' },
  { number: '15', title: 'Print', marker: '.print-only{' }
];

const SECTION_COMMENT_RE = /(?:^|\n)[ \t]*\/\*\s*\d{2}\.\s+[^*\n]+\*\/[ \t]*(?=\n|$)/g;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stripStructureComments(css) {
  return String(css || '').replace(/\r\n/g, '\n').replace(SECTION_COMMENT_RE, '');
}

function semanticCss(css) {
  const source = String(css || '').replace(/\r\n/g, '\n');
  let output = '';
  let quote = '';
  let escaped = false;
  let inComment = false;
  let pendingSpace = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        index += 1;
        pendingSpace = true;
      }
      continue;
    }

    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      index += 1;
      pendingSpace = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (pendingSpace && output && !output.endsWith('}') && !output.endsWith('{')) output += ' ';
      pendingSpace = false;
      quote = char;
      output += char;
      continue;
    }

    if (/\s/.test(char)) {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace && output && !output.endsWith('}') && !output.endsWith('{')) output += ' ';
    pendingSpace = false;
    output += char;
  }

  return output.trim().replace(/}\s+/g, '}');
}

function semanticHash(css) {
  return sha256(semanticCss(css));
}

function buildStructured(css) {
  const clean = stripStructureComments(css).trim();
  const positions = SECTIONS.map((section) => ({
    ...section,
    index: clean.indexOf(section.marker)
  }));

  const errors = [];
  positions.forEach((section, index) => {
    if (section.index < 0) errors.push(`missing marker for section ${section.number}: ${section.marker}`);
    if (index > 0 && section.index <= positions[index - 1].index) {
      errors.push(`section ${section.number} is not after section ${positions[index - 1].number}`);
    }
    if (clean.indexOf(section.marker, section.index + 1) >= 0) {
      errors.push(`marker is not unique for section ${section.number}: ${section.marker}`);
    }
  });
  if (errors.length) throw new Error(`Base CSS structure failed:\n${errors.join('\n')}`);

  const chunks = positions.map((section, index) => {
    const end = positions[index + 1]?.index ?? clean.length;
    const body = clean.slice(section.index, end).trim();
    return `/* ${section.number}. ${section.title} */\n${body}`;
  });

  return {
    css: `${chunks.join('\n\n')}\n`,
    sections: positions.map(({ number, title, marker }) => ({ number, title, marker }))
  };
}

function readExistingReport() {
  if (!fs.existsSync(REPORT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(CSS_PATH)) throw new Error(`Missing CSS file: ${CSS_PATH}`);

  const before = fs.readFileSync(CSS_PATH, 'utf8');
  const beforeSemanticSha256 = semanticHash(before);
  const result = buildStructured(before);
  const after = result.css;
  const afterSemanticSha256 = semanticHash(after);

  if (beforeSemanticSha256 !== afterSemanticSha256) {
    throw new Error(`Base CSS semantic hash changed: ${beforeSemanticSha256} -> ${afterSemanticSha256}`);
  }

  const existing = readExistingReport();
  const stableReport = existing
    && existing.after_semantic_sha256 === afterSemanticSha256
    && existing.sections_count === result.sections.length;
  const report = {
    schema_version: 1,
    generated_at: stableReport ? existing.generated_at : new Date().toISOString(),
    css_path: 'assets/css/styles.css',
    report_path: 'data/base_css_structure_report.json',
    sections_count: result.sections.length,
    sections: result.sections,
    before_bytes: Buffer.byteLength(before),
    after_bytes: Buffer.byteLength(after),
    before_semantic_sha256: beforeSemanticSha256,
    after_semantic_sha256: afterSemanticSha256,
    semantic_equal: beforeSemanticSha256 === afterSemanticSha256,
    idempotent: buildStructured(after).css === after,
    note: 'Only section comments and formatting are added; selectors, declarations, values and rule order are preserved.'
  };

  if (!report.idempotent) throw new Error('Base CSS structure is not idempotent');

  if (before !== after) fs.writeFileSync(CSS_PATH, after, 'utf8');
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Base CSS structure OK: ${result.sections.length} sections, semantic SHA-256 ${afterSemanticSha256}, ${before === after ? 'already structured' : 'updated'}`);
}

if (require.main === module) main();

module.exports = {
  CSS_PATH,
  REPORT_PATH,
  SECTIONS,
  buildStructured,
  semanticCss,
  semanticHash,
  stripStructureComments
};
