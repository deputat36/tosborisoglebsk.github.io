const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules']);

const CONTROL_LABELS = {
  'event-search': 'Поиск событий и дедлайнов',
  'event-type-filter': 'Фильтр событий по типу',
  'event-tos-filter': 'Фильтр событий по ТОС',
  'update-search': 'Поиск карточек ТОС',
  'update-status': 'Фильтр карточек по статусу заполнения',
  'update-type': 'Фильтр карточек по типу ТОС',
  'done-search': 'Поиск историй результата',
  'done-type-filter': 'Фильтр историй по типу',
  'done-tos-filter': 'Фильтр историй по ТОС',
  'done-year-filter': 'Фильтр историй по году',
  'done-status-filter': 'Фильтр историй по статусу',
  'needs-search': 'Поиск потребностей',
  'needs-type-filter': 'Фильтр потребностей по типу помощи',
  'needs-tos-filter': 'Фильтр потребностей по ТОС',
  'needs-priority-filter': 'Фильтр потребностей по приоритету',
  'needs-status-filter': 'Фильтр потребностей по статусу',
  'news-search': 'Поиск новостей',
  'news-category-filter': 'Фильтр новостей по теме',
  'news-tos-filter': 'Фильтр новостей по ТОС',
  'site-search': 'Поиск по сайту',
  search: 'Поиск по каталогу ТОС',
  'location-filter': 'Фильтр ТОС по территории',
  'type-filter': 'Фильтр ТОС по типу',
  'contact-filter': 'Фильтр ТОС по наличию контактов',
  'activity-filter': 'Фильтр ТОС по активности',
  'fill-filter': 'Фильтр ТОС по заполненности',
  'sort-filter': 'Сортировка каталога ТОС'
};

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (path.extname(entry.name).toLowerCase() === '.html') files.push(fullPath);
  }
  return files;
}

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

function typePrintButtons(html) {
  return html.replace(/<button\b(?=[^>]*\bonclick\s*=\s*(["'])[^"']*window\.print\(\)[^"']*\1)[^>]*>/gi, (tag) => addAttribute(tag, 'type', 'button'));
}

function main() {
  let changedFiles = 0;
  let labeledControls = 0;
  let typedButtons = 0;

  for (const filePath of walk(ROOT)) {
    const before = fs.readFileSync(filePath, 'utf8');
    const beforeLabeled = (before.match(/\baria-label\s*=/gi) || []).length;
    const beforeTypedPrintButtons = (before.match(/<button\b(?=[^>]*\btype\s*=)(?=[^>]*window\.print\(\))[^>]*>/gi) || []).length;

    let after = labelKnownControls(before);
    after = typePrintButtons(after);

    if (after !== before) {
      fs.writeFileSync(filePath, after, 'utf8');
      changedFiles += 1;
      labeledControls += Math.max(0, (after.match(/\baria-label\s*=/gi) || []).length - beforeLabeled);
      typedButtons += Math.max(0, (after.match(/<button\b(?=[^>]*\btype\s*=)(?=[^>]*window\.print\(\))[^>]*>/gi) || []).length - beforeTypedPrintButtons);
    }
  }

  console.log(`Public controls patched: ${changedFiles} files, controls labeled ${labeledControls}, print buttons typed ${typedButtons}`);
}

main();
