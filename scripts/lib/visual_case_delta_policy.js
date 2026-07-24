const MAX_APPROVED_CASES = 10;
const MAX_APPROVED_RATIO = 0.4;
const MAX_APPROVED_CHANNEL_DELTA = 10;

function finiteNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number`);
  return parsed;
}

function validateApprovalDocument(document, baselineCaseIds = []) {
  if (!document || document.schema_version !== 1) {
    throw new Error(`Unsupported visual case-delta schema: ${document?.schema_version}`);
  }

  const cases = document.cases && typeof document.cases === 'object' ? document.cases : {};
  const entries = Object.entries(cases);
  if (!entries.length) throw new Error('Visual case-delta registry has no cases');
  if (entries.length > MAX_APPROVED_CASES) throw new Error(`Visual case-delta registry exceeds ${MAX_APPROVED_CASES} cases`);

  const known = new Set(baselineCaseIds);
  const normalized = new Map();

  entries.forEach(([caseId, raw]) => {
    if (!caseId || !raw || typeof raw !== 'object') throw new Error(`Invalid visual case-delta entry: ${caseId || '(empty)'}`);
    if (known.size && !known.has(caseId)) throw new Error(`Visual case-delta references unknown baseline case: ${caseId}`);
    if (!/^[a-f0-9]{64}$/i.test(String(raw.baseline_sha256 || ''))) throw new Error(`${caseId}: baseline_sha256 must be a SHA-256`);
    if (!String(raw.route || '').startsWith('/')) throw new Error(`${caseId}: route must be an absolute site path`);
    if (!['light', 'dark'].includes(raw.theme)) throw new Error(`${caseId}: unsupported theme ${raw.theme}`);
    if (!String(raw.interaction || '')) throw new Error(`${caseId}: interaction is required`);
    if (!String(raw.mode || '')) throw new Error(`${caseId}: mode is required`);
    if (String(raw.reason || '').trim().length < 20) throw new Error(`${caseId}: reason must explain the approved change`);

    const maxSignificant = finiteNumber(raw.max_significant_changed_pixels, `${caseId}.max_significant_changed_pixels`);
    const maxRatio = finiteNumber(raw.max_changed_pixel_ratio, `${caseId}.max_changed_pixel_ratio`);
    const maxDelta = finiteNumber(raw.max_channel_delta, `${caseId}.max_channel_delta`);

    if (maxSignificant !== 0) throw new Error(`${caseId}: significant changed pixels must remain zero`);
    if (maxRatio < 0 || maxRatio > MAX_APPROVED_RATIO) throw new Error(`${caseId}: approved ratio must be between 0 and ${MAX_APPROVED_RATIO}`);
    if (maxDelta < 0 || maxDelta > MAX_APPROVED_CHANNEL_DELTA) throw new Error(`${caseId}: approved channel delta must be between 0 and ${MAX_APPROVED_CHANNEL_DELTA}`);

    normalized.set(caseId, {
      case_id: caseId,
      baseline_sha256: String(raw.baseline_sha256).toLowerCase(),
      route: raw.route,
      theme: raw.theme,
      interaction: raw.interaction,
      mode: raw.mode,
      max_significant_changed_pixels: maxSignificant,
      max_changed_pixel_ratio: maxRatio,
      max_channel_delta: maxDelta,
      reason: String(raw.reason).trim()
    });
  });

  return normalized;
}

function applyApprovedCaseDelta(comparison, approval) {
  if (!approval || comparison.pixel_equivalent) return comparison;

  const matchesIdentity = comparison.case_id === approval.case_id
    && comparison.route === approval.route
    && comparison.theme === approval.theme
    && comparison.interaction === approval.interaction
    && comparison.mode === approval.mode
    && String(comparison.baseline_sha256 || '').toLowerCase() === approval.baseline_sha256;

  const withinLimits = comparison.size_equal === true
    && Number(comparison.significant_changed_pixels) <= approval.max_significant_changed_pixels
    && Number(comparison.changed_pixel_ratio) <= approval.max_changed_pixel_ratio
    && Number(comparison.max_channel_delta) <= approval.max_channel_delta;

  if (!matchesIdentity || !withinLimits) return comparison;

  return {
    ...comparison,
    pixel_equivalent: true,
    equivalence_reason: 'approved_case_delta',
    approved_case_delta: {
      baseline_sha256: approval.baseline_sha256,
      max_significant_changed_pixels: approval.max_significant_changed_pixels,
      max_changed_pixel_ratio: approval.max_changed_pixel_ratio,
      max_channel_delta: approval.max_channel_delta,
      reason: approval.reason
    }
  };
}

module.exports = {
  MAX_APPROVED_CASES,
  MAX_APPROVED_RATIO,
  MAX_APPROVED_CHANNEL_DELTA,
  validateApprovalDocument,
  applyApprovedCaseDelta
};
