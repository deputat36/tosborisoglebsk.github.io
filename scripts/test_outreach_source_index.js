const { buildSourceIndex } = require('./audit_outreach_register');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = buildSourceIndex();

assert(index.registry.has('registry-full'), 'registry-full source id is required');
assert(index.priority_card.has('ivanovka'), 'priority source id ivanovka is required');
assert(index.priority_card.has('gubari'), 'priority source id gubari is required');
assert(index.candidate_registry.has('cand-req-001'), 'candidate source id cand-req-001 is required');
assert(index.candidate_registry.has('cand-req-005'), 'candidate source id cand-req-005 is required');
assert(index.project_result.has('req-2026-001'), 'project result source id req-2026-001 is required');
assert(index.project_result.has('req-2026-006'), 'project result source id req-2026-006 is required');
assert(!index.priority_card.has('missing-priority'), 'missing priority source id must not be present');

console.log('Outreach source index tests OK');
