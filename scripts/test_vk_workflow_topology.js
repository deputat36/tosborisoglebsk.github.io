const { runSelfTest } = require('./audit_vk_workflow_topology');
const { mergeImportedNews } = require('./import_vk_news');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runMergeRetentionTest() {
  const canonical = Array.from({ length: 125 }, (_, index) => ({
    id: `canonical-${index + 1}`,
    status: 'published',
    date: `2025-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    title: `Canonical ${index + 1}`,
    content_origin: index % 2 ? 'editorial' : 'verified'
  }));
  const existingVk = [
    { id: 'vk-1-1', status: 'published', date: '2026-01-01', imported_from: 'vk', title: 'Old one' },
    { id: 'vk-1-2', status: 'published', date: '2026-02-01', imported_from: 'vk', title: 'Old two' },
    { id: 'vk-1-3', status: 'published', date: '2026-03-01', imported_from: 'vk', title: 'Old three' }
  ];
  const incomingVk = [
    { id: 'vk-1-1', status: 'published', date: '2026-04-01', imported_from: 'vk', title: 'Updated one' },
    { id: 'vk-1-4', status: 'published', date: '2026-05-01', imported_from: 'vk', title: 'New four' }
  ];

  const merged = mergeImportedNews([...canonical, ...existingVk], incomingVk, 2);
  const canonicalIds = new Set(canonical.map((item) => item.id));
  const preservedCanonical = merged.filter((item) => canonicalIds.has(item.id));
  const vkItems = merged.filter((item) => item.imported_from === 'vk');

  assert(preservedCanonical.length === canonical.length, `canonical news truncated: expected ${canonical.length}, got ${preservedCanonical.length}`);
  assert(vkItems.length === 2, `VK limit not applied independently: expected 2, got ${vkItems.length}`);
  assert(vkItems.some((item) => item.id === 'vk-1-4'), 'newest VK item was not retained');
  assert(vkItems.some((item) => item.id === 'vk-1-1' && item.title === 'Updated one'), 'existing VK item was not updated by stable ID');
  assert(merged.filter((item) => item.id === 'vk-1-1').length === 1, 'updated VK item was duplicated');
  assert(merged.length === canonical.length + 2, `unexpected merged length: ${merged.length}`);

  for (let index = 1; index < merged.length; index += 1) {
    assert(String(merged[index - 1].date || '') >= String(merged[index].date || ''), 'merged news are not sorted by date descending');
  }

  const withoutVk = mergeImportedNews([...canonical, ...existingVk], [], 0);
  assert(withoutVk.length === canonical.length, 'VK limit 0 must preserve every canonical item');
  assert(withoutVk.every((item) => item.imported_from !== 'vk'), 'VK limit 0 must remove only VK-imported items');

  console.log('VK news merge retention self-test OK');
}

runSelfTest();
runMergeRetentionTest();
