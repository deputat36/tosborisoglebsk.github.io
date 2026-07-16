const assert = require('assert');
const validation = require('../assets/js/personal-data-decision-validation.js');

function baseRow(overrides = {}) {
  return {
    decision_id: 'operator_assignment',
    sequence: '1',
    decision_status: 'pending',
    recommended_prerequisite_ids: '',
    decision_owner_role: '',
    legal_reviewer_role: '',
    selected_option_code: '',
    decision_ref: '',
    legal_review_ref: '',
    approved_at: '',
    approved_by_role: '',
    implementation_status: 'not_started',
    implementation_ref: '',
    implemented_at: '',
    implemented_by_role: '',
    blocker: 'не назначены роли',
    next_step: 'назначить роли',
    ...overrides
  };
}

const canonicalPending = {
  id: 'operator_assignment',
  status: 'pending',
  decision_ref: '',
  legal_review_ref: '',
  approved_at: '',
  approved_by: ''
};

assert.deepStrictEqual(validation.validationIssues(baseRow(), canonicalPending, [baseRow()]), []);
assert.strictEqual(validation.isReadyForReview(baseRow(), [baseRow()]), false);

const reviewRow = baseRow({
  decision_status: 'in_review',
  decision_owner_role: 'role:portal-owner',
  legal_reviewer_role: 'role:legal-reviewer'
});
const canonicalReview = { ...canonicalPending, status: 'in_review' };
assert.deepStrictEqual(validation.validationIssues(reviewRow, canonicalReview, [reviewRow]), []);
assert.strictEqual(validation.isReadyForReview(reviewRow, [reviewRow]), true);

const incompleteApproval = baseRow({ decision_status: 'approved' });
assert(validation.validationIssues(incompleteApproval, { ...canonicalPending, status: 'approved' }, [incompleteApproval]).length >= 6);

const approvedRow = baseRow({
  decision_status: 'approved',
  decision_owner_role: 'role:portal-owner',
  legal_reviewer_role: 'role:legal-reviewer',
  selected_option_code: 'option:approved-model',
  decision_ref: 'decision:pd-001',
  legal_review_ref: 'evidence:legal-001',
  approved_at: '2026-07-16',
  approved_by_role: 'role:authorized-body'
});
const canonicalApproved = {
  id: 'operator_assignment',
  status: 'approved',
  decision_ref: 'decision:pd-001',
  legal_review_ref: 'evidence:legal-001',
  approved_at: '2026-07-16',
  approved_by: 'role:authorized-body'
};
assert.deepStrictEqual(validation.validationIssues(approvedRow, canonicalApproved, [approvedRow]), []);
assert.strictEqual(validation.isApprovalComplete(approvedRow), true);

const completedWithoutEvidence = { ...approvedRow, implementation_status: 'completed' };
assert(validation.validationIssues(completedWithoutEvidence, canonicalApproved, [completedWithoutEvidence]).some((item) => item.includes('implementation_ref')));

const completedRow = {
  ...approvedRow,
  implementation_status: 'completed',
  implementation_ref: 'evidence:implementation-001',
  implemented_at: '2026-07-17',
  implemented_by_role: 'role:implementation-owner'
};
assert.deepStrictEqual(validation.validationIssues(completedRow, canonicalApproved, [completedRow]), []);

const dependency = baseRow({ decision_id: 'operator_assignment', sequence: '1' });
const dependent = baseRow({
  decision_id: 'purposes_and_data_categories',
  sequence: '2',
  recommended_prerequisite_ids: 'operator_assignment',
  decision_owner_role: 'role:portal-owner',
  legal_reviewer_role: 'role:legal-reviewer'
});
assert.strictEqual(validation.prerequisitesResolved(dependent, [dependency, dependent]), false);
assert.strictEqual(validation.isReadyForReview(dependent, [dependency, dependent]), false);
assert.strictEqual(validation.prerequisitesResolved(dependent, [{ ...dependency, decision_status: 'approved' }, dependent]), true);

const wrongCanonical = validation.validationIssues(approvedRow, { ...canonicalApproved, decision_ref: 'decision:other' }, [approvedRow]);
assert(wrongCanonical.some((item) => item.includes('decision_ref')));

console.log('Personal data decision packet state contract OK');
