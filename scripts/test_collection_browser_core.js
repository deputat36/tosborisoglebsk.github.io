const assert = require('assert');
const core = require('../assets/js/collection-browser-core');

assert.deepStrictEqual(core.ORIGINS, ['verified', 'editorial', 'starter', 'request']);
assert.strictEqual(core.normalizeText(' Ёлка '), 'елка');
assert.strictEqual(core.normalizeOrigin('verified'), 'verified');
assert.strictEqual(core.normalizeOrigin('unknown'), 'editorial');
assert.strictEqual(core.originLabel('request'), 'Запрос материалов');
assert.strictEqual(core.originLabel('request', { request: 'Запрос данных' }), 'Запрос данных');

const fields = ['q', 'origin', 'tos'];
const state = core.parseState('?q=%D1%81%D0%BA%D0%B2%D0%B5%D1%80&origin=verified&unused=1', fields);
assert.deepStrictEqual(state, { q: 'сквер', origin: 'verified', tos: '' });
assert.strictEqual(core.serializeState(state, fields), 'q=%D1%81%D0%BA%D0%B2%D0%B5%D1%80&origin=verified');
assert.strictEqual(core.activeFilterCount(state), 2);

const counts = core.countOrigins([
  { origin: 'verified' },
  { origin: 'editorial' },
  { origin: 'request' },
  { origin: 'unknown' }
], (item) => item.origin);
assert.deepStrictEqual(counts, { verified: 1, editorial: 2, starter: 0, request: 1 });

const controls = {
  q: { value: '' },
  origin: { value: '' }
};
core.applyControls({ q: 'парк', origin: 'starter' }, controls);
assert.deepStrictEqual(core.readControls(controls), { q: 'парк', origin: 'starter' });
core.resetControls(controls);
assert.deepStrictEqual(core.readControls(controls), { q: '', origin: '' });

const status = { textContent: '' };
core.setStatus(status, 3, 10, 2);
assert.strictEqual(status.textContent, 'Показано 3 из 10. Активных фильтров: 2.');

console.log('Collection browser core self-test OK');
