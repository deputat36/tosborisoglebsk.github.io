const decisionStatuses = new Set(['assumed_default', 'waiting', 'not_needed_now', 'done']);
const manualTaskStatuses = new Set(['open', 'closed', 'paused']);
const priorities = new Set(['high', 'medium', 'low']);
const workModes = new Set(['assistant', 'mixed']);
const planStatuses = new Set([
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

module.exports = {
  decisionStatuses,
  manualTaskStatuses,
  priorities,
  workModes,
  planStatuses,
  manualTaskGroups
};
