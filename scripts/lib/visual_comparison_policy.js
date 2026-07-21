const DEFAULT_VISUAL_THRESHOLDS = Object.freeze({
  maxLowDeltaRatio: 0.005,
  maxSubpixelChannelDelta: 4,
  maxSubpixelRatio: 0.1,
  maxBroadSubpixelChannelDelta: 3,
  maxBroadSubpixelRatio: 0.3
});

function numeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classifyVisualEquivalence(metrics = {}, thresholds = {}) {
  const sizeEqual = Boolean(metrics.sizeEqual ?? metrics.size_equal);
  const significantChangedPixels = numeric(
    metrics.significantChangedPixels ?? metrics.significant_changed_pixels,
    0
  );
  const changedPixelRatio = numeric(
    metrics.changedPixelRatio ?? metrics.changed_pixel_ratio,
    1
  );
  const maxChannelDelta = numeric(
    metrics.maxChannelDelta ?? metrics.max_channel_delta,
    Number.POSITIVE_INFINITY
  );
  const maxLowDeltaRatio = numeric(
    thresholds.maxLowDeltaRatio ?? thresholds.max_low_delta_ratio,
    DEFAULT_VISUAL_THRESHOLDS.maxLowDeltaRatio
  );
  const maxSubpixelChannelDelta = numeric(
    thresholds.maxSubpixelChannelDelta ?? thresholds.max_subpixel_channel_delta,
    DEFAULT_VISUAL_THRESHOLDS.maxSubpixelChannelDelta
  );
  const maxSubpixelRatio = numeric(
    thresholds.maxSubpixelRatio ?? thresholds.max_subpixel_ratio,
    DEFAULT_VISUAL_THRESHOLDS.maxSubpixelRatio
  );
  const maxBroadSubpixelChannelDelta = numeric(
    thresholds.maxBroadSubpixelChannelDelta ?? thresholds.max_broad_subpixel_channel_delta,
    DEFAULT_VISUAL_THRESHOLDS.maxBroadSubpixelChannelDelta
  );
  const maxBroadSubpixelRatio = numeric(
    thresholds.maxBroadSubpixelRatio ?? thresholds.max_broad_subpixel_ratio,
    DEFAULT_VISUAL_THRESHOLDS.maxBroadSubpixelRatio
  );

  if (!sizeEqual) return { equivalent: false, reason: 'size_mismatch' };
  if (significantChangedPixels > 0) return { equivalent: false, reason: 'significant_pixels' };
  if (changedPixelRatio === 0) return { equivalent: true, reason: 'exact' };
  if (changedPixelRatio <= maxLowDeltaRatio) {
    return { equivalent: true, reason: 'bounded_antialias' };
  }
  if (maxChannelDelta <= maxSubpixelChannelDelta && changedPixelRatio <= maxSubpixelRatio) {
    return { equivalent: true, reason: 'subpixel_rendering' };
  }
  if (maxChannelDelta <= maxBroadSubpixelChannelDelta && changedPixelRatio <= maxBroadSubpixelRatio) {
    return { equivalent: true, reason: 'broad_subpixel_rendering' };
  }
  return { equivalent: false, reason: 'changed' };
}

module.exports = {
  DEFAULT_VISUAL_THRESHOLDS,
  classifyVisualEquivalence
};
