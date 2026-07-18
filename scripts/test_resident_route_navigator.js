const assert=require('assert');
const core=require('../assets/js/resident-route-core.js');

const routes=core.listRoutes();
assert.strictEqual(routes.length,7,'navigator must contain seven routes');
assert.deepStrictEqual(routes.map(route=>route.code),['urgent','building','municipal','collective','event','result','portal']);

routes.forEach(route=>{
  assert(route.label&&route.owner&&route.summary,'each route must explain the situation and destination');
  assert(Array.isArray(route.collect)&&route.collect.length>=3,'each route must provide a preparation checklist');
  assert(Array.isArray(route.actions),'route actions must be an array');
});

assert.strictEqual(core.getRoute('unknown'),null);
assert.strictEqual(core.getRoute('urgent').actions.length,0,'fast-response route must not send users into portal workflows');
assert(core.getRoute('collective').actions.some(([,href])=>href.includes('type=project')),'collective route must support project preparation');
assert(core.getRoute('portal').actions.some(([,href])=>href.includes('type=card')),'portal route must support card correction');

const message=core.buildMessage('municipal');
assert(message.includes('Куда направить:'));
assert(message.includes('Точное место:'));
assert(!message.includes('Телефон:')&&!message.includes('Паспорт:'),'template must not request unnecessary sensitive fields');

console.log(`Resident route navigator OK: ${routes.length} routes`);
