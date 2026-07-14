const path = require('path');
const { removeStaleGeneratedDirectories } = require('./lib/generated_page_cleanup');
const { GENERATED_COLLECTIONS, readPublishedIds } = require('./lib/generated_collection_pages');

const ROOT = process.cwd();

function main() {
  let totalRemoved = 0;

  for (const collection of GENERATED_COLLECTIONS) {
    const removed = removeStaleGeneratedDirectories({
      rootDir: collection.rootDir,
      validIds: readPublishedIds(collection),
      marker: collection.marker
    });

    totalRemoved += removed.length;
    const details = removed.length ? `: ${removed.join(', ')}` : '';
    console.log(`${collection.name}: removed stale generated pages ${removed.length}${details}`);
  }

  console.log(`Generated collection cleanup complete: ${totalRemoved} directories removed from ${GENERATED_COLLECTIONS.length} collections`);
}

try {
  main();
} catch (error) {
  console.error(`Generated collection cleanup failed: ${error.stack || error.message}`);
  console.error(`Working directory: ${path.relative(ROOT, process.cwd()) || '.'}`);
  process.exitCode = 1;
}
