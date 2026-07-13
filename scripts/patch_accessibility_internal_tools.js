const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_FILES = [
  path.join(ROOT, 'admin', 'index.html'),
  path.join(ROOT, 'tools', 'import.html')
];

const CONTROL_LABELS = {
  importJsonFile: 'Загрузить JSON-файл',
  searchInput: 'Поиск по записям',
  quickFilter: 'Быстрый фильтр записей',
  file: 'Выберите Excel или CSV-файл',
  out: 'Сгенерированный код tos.data.js'
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addAttribute(tag, name, value) {
  if (new RegExp(`\\b${name}\\s*=`, 'i').test(tag)) return tag;
  const escapedValue = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return tag.replace(/\s*\/?>$/, (ending) => ` ${name}="${escapedValue}"${ending}`);
}

function labelKnownControls(html) {
  let patched = html;
  for (const [id, label] of Object.entries(CONTROL_LABELS)) {
    const idPattern = escapeRegExp(id);
    const pattern = new RegExp(`<(input|select|textarea)\\b(?=[^>]*\\bid\\s*=\\s*(["'])${idPattern}\\2)[^>]*>`, 'gi');
    patched = patched.replace(pattern, (tag) => addAttribute(tag, 'aria-label', label));
  }
  return patched;
}

function typeTabButtons(html) {
  return html.replace(/<button\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\btab\b[^"']*\1)[^>]*>/gi, (tag) => addAttribute(tag, 'type', 'button'));
}

function main() {
  let changedFiles = 0;
  let labeledControls = 0;
  let typedButtons = 0;

  for (const filePath of TARGET_FILES) {
    if (!fs.existsSync(filePath)) continue;
    const before = fs.readFileSync(filePath, 'utf8');
    const beforeLabels = (before.match(/\baria-label\s*=/gi) || []).length;
    const beforeTypedTabs = (before.match(/<button\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\btab\b[^"']*\1)(?=[^>]*\btype\s*=)[^>]*>/gi) || []).length;

    let after = labelKnownControls(before);
    after = typeTabButtons(after);

    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      changedFiles += 1;
      labeledControls += Math.max(0, (after.match(/\baria-label\s*=/gi) || []).length - beforeLabels);
      typedButtons += Math.max(0, (after.match(/<button\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\btab\b[^"']*\1)(?=[^>]*\btype\s*=)[^>]*>/gi) || []).length - beforeTypedTabs);
    }
  }

  console.log(`Internal tools patched: ${changedFiles} files, controls labeled ${labeledControls}, tab buttons typed ${typedButtons}`);
}

main();
