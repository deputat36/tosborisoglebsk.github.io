const decisionStatuses = new Set(['assumed_default', 'waiting', 'not_needed_now', 'done']);
const manualTaskStatuses = new Set(['open', 'closed', 'paused']);
const priorities = new Set(['high', 'medium', 'low']);
const evidenceLevels = new Set(['low', 'medium', 'high']);
const workModes = new Set(['assistant', 'mixed']);
const planStatuses = new Set([
  'active',
  'done',
  'planned',
  'waiting_for_confirmed_data',
  'waiting_for_send_confirmation',
  'waiting_for_source',
  'waiting_for_manual_check',
  'waiting_for_files',
  'needs_review'
]);
const manualTaskGroups = new Set([
  'data-verification',
  'technical-ops',
  'frontend',
  'outreach',
  'project-control'
]);
const outreachStatuses = new Set([
  'draft',
  'sent',
  'waiting',
  'follow_up',
  'received',
  'closed',
  'resolved'
]);
const outreachGroups = new Set([
  'registry',
  'priority_card',
  'candidate_registry',
  'project_result'
]);
const requestSourceStatuses = new Set([
  'draft',
  'sent',
  'waiting',
  'follow_up',
  'received',
  'closed',
  'resolved_without_outreach'
]);

module.exports = {
  decisionStatuses,
  manualTaskStatuses,
  priorities,
  evidenceLevels,
  workModes,
  planStatuses,
  manualTaskGroups,
  outreachStatuses,
  outreachGroups,
  requestSourceStatuses
};
