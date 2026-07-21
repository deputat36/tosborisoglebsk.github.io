const assert = require('assert');
const { classifyVisualEquivalence } = require('./lib/visual_comparison_policy');

const thresholds = {
  maxLowDeltaRatio: 0.005,
  maxSubpixelChannelDelta: 4,
  maxSubpixelRatio: 0.1,
  maxBroadSubpixelChannelDelta: 3,
  maxBroadSubpixelRatio: 0.3
};

function classify(metrics) {
  return classifyVisualEquivalence(metrics, thresholds);
}

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0, maxChannelDelta: 0 }),
  { equivalent: true, reason: 'exact' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.004, maxChannelDelta: 16 }),
  { equivalent: true, reason: 'bounded_antialias' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.0765, maxChannelDelta: 4 }),
  { equivalent: true, reason: 'subpixel_rendering' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.268, maxChannelDelta: 3 }),
  { equivalent: true, reason: 'broad_subpixel_rendering' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.1001, maxChannelDelta: 4 }),
  { equivalent: false, reason: 'changed' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.3001, maxChannelDelta: 3 }),
  { equivalent: false, reason: 'changed' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.2, maxChannelDelta: 4 }),
  { equivalent: false, reason: 'changed' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 0, changedPixelRatio: 0.07, maxChannelDelta: 5 }),
  { equivalent: false, reason: 'changed' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: true, significantChangedPixels: 1, changedPixelRatio: 0.0001, maxChannelDelta: 3 }),
  { equivalent: false, reason: 'significant_pixels' }
);

assert.deepStrictEqual(
  classify({ sizeEqual: false, significantChangedPixels: 0, changedPixelRatio: 0, maxChannelDelta: 0 }),
  { equivalent: false, reason: 'size_mismatch' }
);

console.log('Visual comparison policy self-test OK');
