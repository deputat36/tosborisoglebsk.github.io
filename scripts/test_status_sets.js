const {
  decisionStatuses,
  manualTaskStatuses,
  priorities,
  workModes,
  planStatuses,
  manualTaskGroups
} = require('./lib/status_sets');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(decisionStatuses.has('waiting'), 'decision status waiting is required');
assert(decisionStatuses.has('done'), 'decision status done is required');
assert(!decisionStatuses.has('unknown'), 'unknown decision status must not be allowed');

assert(manualTaskStatuses.has('open'), 'manual task status open is required');
assert(manualTaskStatuses.has('closed'), 'manual task status closed is required');
assert(!manualTaskStatuses.has('draft'), 'draft manual task status must not be allowed');

assert(priorities.has('high'), 'priority high is required');
assert(priorities.has('medium'), 'priority medium is required');
assert(priorities.has('low'), 'priority low is required');
assert(!priorities.has('urgent'), 'priority urgent must not be allowed');

assert(workModes.has('assistant'), 'work mode assistant is required');
assert(workModes.has('mixed'), 'work mode mixed is required');
assert(!workModes.has('external'), 'work mode external must not be allowed');

assert(planStatuses.has('planned'), 'plan status planned is required');
assert(planStatuses.has('done'), 'plan status done is required');
assert(planStatuses.has('needs_review'), 'plan status needs_review is required');
assert(!planStatuses.has('published'), 'plan status published must not be allowed');

assert(manualTaskGroups.has('data-verification'), 'manual task group data-verification is required');
assert(manualTaskGroups.has('project-control'), 'manual task group project-control is required');
assert(!manualTaskGroups.has('random'), 'random manual task group must not be allowed');

console.log('Status sets tests OK');
