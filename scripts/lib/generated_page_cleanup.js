const fs = require('fs');
const path = require('path');

function normalizeIds(values) {
  return new Set(
    Array.from(values || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  );
}

function findStaleGeneratedDirectories({ rootDir, validIds, marker }) {
  if (!rootDir || !marker || !fs.existsSync(rootDir)) return [];

  const expected = normalizeIds(validIds);
  const stale = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || expected.has(entry.name)) continue;

    const directory = path.join(rootDir, entry.name);
    const indexPath = path.join(directory, 'index.html');
    if (!fs.existsSync(indexPath)) continue;

    const html = fs.readFileSync(indexPath, 'utf8');
    if (!html.includes(marker)) continue;

    stale.push({ id: entry.name, directory, indexPath });
  }

  return stale.sort((left, right) => left.id.localeCompare(right.id, 'ru'));
}

function removeStaleGeneratedDirectories(options) {
  const stale = findStaleGeneratedDirectories(options);
  stale.forEach((entry) => fs.rmSync(entry.directory, { recursive: true, force: true }));
  return stale.map((entry) => entry.id);
}

module.exports = {
  findStaleGeneratedDirectories,
  removeStaleGeneratedDirectories
};
