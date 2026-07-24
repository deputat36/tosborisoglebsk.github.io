const assert = require('assert');
const {
  MAX_APPROVED_CHANNEL_DELTA,
  validateApprovalDocument,
  applyApprovedCaseDelta
} = require('./lib/visual_case_delta_policy');

const baselineSha = 'a'.repeat(64);
assert.strictEqual(MAX_APPROVED_CHANNEL_DELTA, 10);

const approvals = validateApprovalDocument({
  schema_version: 1,
  cases: {
    'css-reg-test': {
      baseline_sha256: baselineSha,
      route: '/tos/test/',
      theme: 'light',
      interaction: 'none',
      mode: 'screen',
      max_significant_changed_pixels: 0,
      max_changed_pixel_ratio: 0.2,
      max_channel_delta: 10,
      reason: 'Проверенный низкоамплитудный дрейф рендеринга без структурных изменений.'
    }
  }
}, ['css-reg-test']);

const baseComparison = {
  case_id: 'css-reg-test',
  route: '/tos/test/',
  theme: 'light',
  interaction: 'none',
  mode: 'screen',
  size_equal: true,
  pixel_equivalent: false,
  equivalence_reason: 'changed',
  significant_changed_pixels: 0,
  changed_pixel_ratio: 0.19,
  max_channel_delta: 10,
  baseline_sha256: baselineSha
};

const approved = applyApprovedCaseDelta(baseComparison, approvals.get('css-reg-test'));
assert.strictEqual(approved.pixel_equivalent, true);
assert.strictEqual(approved.equivalence_reason, 'approved_case_delta');
assert.ok(approved.approved_case_delta?.reason);

assert.strictEqual(applyApprovedCaseDelta({ ...baseComparison, significant_changed_pixels: 1 }, approvals.get('css-reg-test')).pixel_equivalent, false);
assert.strictEqual(applyApprovedCaseDelta({ ...baseComparison, changed_pixel_ratio: 0.201 }, approvals.get('css-reg-test')).pixel_equivalent, false);
assert.strictEqual(applyApprovedCaseDelta({ ...baseComparison, max_channel_delta: 11 }, approvals.get('css-reg-test')).pixel_equivalent, false);
assert.strictEqual(applyApprovedCaseDelta({ ...baseComparison, baseline_sha256: 'b'.repeat(64) }, approvals.get('css-reg-test')).pixel_equivalent, false);
assert.strictEqual(applyApprovedCaseDelta({ ...baseComparison, route: '/other/' }, approvals.get('css-reg-test')).pixel_equivalent, false);

assert.throws(() => validateApprovalDocument({
  schema_version: 1,
  cases: {
    unsafe: {
      baseline_sha256: baselineSha,
      route: '/unsafe/',
      theme: 'light',
      interaction: 'none',
      mode: 'screen',
      max_significant_changed_pixels: 1,
      max_changed_pixel_ratio: 0.2,
      max_channel_delta: 10,
      reason: 'Недопустимое широкое визуальное исключение для проверки ограничений.'
    }
  }
}, ['unsafe']), /significant changed pixels must remain zero/);

assert.throws(() => validateApprovalDocument({
  schema_version: 1,
  cases: {
    unsafe: {
      baseline_sha256: baselineSha,
      route: '/unsafe/',
      theme: 'light',
      interaction: 'none',
      mode: 'screen',
      max_significant_changed_pixels: 0,
      max_changed_pixel_ratio: 0.41,
      max_channel_delta: 10,
      reason: 'Недопустимое широкое визуальное исключение для проверки ограничений.'
    }
  }
}, ['unsafe']), /approved ratio/);

assert.throws(() => validateApprovalDocument({
  schema_version: 1,
  cases: {
    unsafe: {
      baseline_sha256: baselineSha,
      route: '/unsafe/',
      theme: 'light',
      interaction: 'none',
      mode: 'screen',
      max_significant_changed_pixels: 0,
      max_changed_pixel_ratio: 0.2,
      max_channel_delta: 11,
      reason: 'Недопустимое превышение верхнего предела амплитуды visual-delta.'
    }
  }
}, ['unsafe']), /approved channel delta/);

console.log('Visual case-delta policy self-test OK');
