const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_tos_detail_pages_content.js');
const MARKER = "const TOS_CONTENT_ACTION_DETAIL_AUDIT_VERSION = '2026-07-31';";

function replaceOrFail(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`TOS detail audit content-actions marker not found: ${label}`);
  return source.replace(pattern, replacement);
}

function patchSource(current) {
  if (
    current.includes(MARKER) &&
    current.includes("const requiredUpdateTypes = ['card', 'project', 'event'];") &&
    current.includes('Что полезно прислать следующим')
  ) {
    return { content: current, changed: false };
  }

  let source = current;
  source = replaceOrFail(
    source,
    /const requiredUpdateTypes = \[[^\n]+\];/,
    `${MARKER}\nconst requiredUpdateTypes = ['card', 'project', 'event'];`,
    'required update types'
  );

  source = replaceOrFail(
    source,
    /const requiredSections = \[[\s\S]*?\n\];/,
    `const requiredSections = [
  'Паспорт ТОС',
  'Что нужно уточнить',
  'Материалы ТОС на портале',
  'Что полезно прислать следующим',
  'Другие способы участия'
];`,
    'required sections'
  );

  source = replaceOrFail(
    source,
    /const needRenderer = \(generator\.match\(\/function needCard\\\(n\\\) \\\{\[\\s\\S\]\*\?\\n\\\}\\nfunction block\/\) \|\| \[\]\)\[0\] \|\| '';/,
    "const needRenderer = (generator.match(/function needCard\\(n\\) \\{[\\s\\S]*?\\n\\}\\nfunction (?:contentActionCard|block)/) || [])[0] || '';",
    'needCard renderer boundary'
  );

  const required = [
    MARKER,
    "const requiredUpdateTypes = ['card', 'project', 'event'];",
    'Что полезно прислать следующим',
    'Другие способы участия',
    'function (?:contentActionCard|block)'
  ];
  required.forEach((fragment) => {
    if (!source.includes(fragment)) throw new Error(`Patched TOS detail audit is missing ${fragment}`);
  });

  return { content: source, changed: true };
}

function patchTosDetailAuditContentActions() {
  if (!fs.existsSync(AUDIT_PATH)) throw new Error(`Missing audit: ${AUDIT_PATH}`);
  const current = fs.readFileSync(AUDIT_PATH, 'utf8');
  const result = patchSource(current);
  if (result.changed) fs.writeFileSync(AUDIT_PATH, result.content, 'utf8');
  console.log(`TOS detail audit content-actions patch ${result.changed ? 'applied' : 'already current'}`);
  return result.changed;
}

if (require.main === module) patchTosDetailAuditContentActions();

module.exports = { MARKER, patchSource, patchTosDetailAuditContentActions };
