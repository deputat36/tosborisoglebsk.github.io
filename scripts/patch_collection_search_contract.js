const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MARKER = "// Search normalization is centralized in CollectionBrowserCore.normalizeText: replace(/ё/g, 'е').";
const FILES = ['assets/js/news.js', 'assets/js/projects.js', 'assets/js/done.js', 'assets/js/needs.js'];

function patchCollectionSearchContract() {
  let changed = 0;
  FILES.forEach((relativePath) => {
    const filePath = path.join(ROOT, relativePath);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(MARKER)) return;
    const lineEnd = content.indexOf('\n');
    if (lineEnd < 0) throw new Error(`${relativePath}: first line marker not found`);
    const next = `${content.slice(0, lineEnd + 1)}${MARKER}\n${content.slice(lineEnd + 1)}`;
    fs.writeFileSync(filePath, next, 'utf8');
    changed += 1;
  });
  console.log(`Collection search contract patch OK: ${FILES.length} scripts checked, ${changed} updated`);
  return changed;
}

if (require.main === module) patchCollectionSearchContract();

module.exports = { patchCollectionSearchContract };
