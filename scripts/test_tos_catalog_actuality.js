const assert=require('assert');
const core=require('../assets/js/tos-catalog-core.js');

assert.strictEqual(core.normalize('Подстёпки'), 'подстепки');
const state=core.stateFromSearch('?q=Чигорак&trust=partial&sort=attention&type=Сельский');
assert.deepStrictEqual(state,{q:'Чигорак',location:'',type:'Сельский',trust:'partial',sort:'attention'});
assert.strictEqual(core.stateToSearch(state),'?q=%D0%A7%D0%B8%D0%B3%D0%BE%D1%80%D0%B0%D0%BA&type=%D0%A1%D0%B5%D0%BB%D1%8C%D1%81%D0%BA%D0%B8%D0%B9&trust=partial&sort=attention');

const rows=[
  {slug:'verified',name:'Альфа',location:'с. Один',boundaries:'улица Садовая',chairperson:'Иванова',description:'Описание',verification_status:'verified',updated_at:'2026-07-01',phones:['12345'],emails:['a@example.test']},
  {slug:'partial',name:'Бета',location:'с. Два',boundaries:'улица Полевая',chairperson:'Петрова',description:'Описание',verification_status:'partial',updated_at:'2026-07-10'},
  {slug:'review',name:'Гамма',location:'с. Три',boundaries:'улица Лесная',chairperson:'Сидорова',description:'Описание',verification_status:'needs_review',updated_at:'2026-05-01'},
  {slug:'draft',name:'Черновик',location:'с. Три',status:'draft',verification_status:'needs_review',updated_at:'2026-01-01'}
];
const locationFor=item=>item.location;
assert.deepStrictEqual(core.filterAndSort(rows,{q:'Садовая',sort:'name'},locationFor).map(item=>item.slug),['verified']);
assert.strictEqual(core.filterAndSort(rows,{q:'12345',sort:'name'},locationFor).length,0,'phone values must not be searchable');
assert.strictEqual(core.filterAndSort(rows,{q:'example.test',sort:'name'},locationFor).length,0,'email values must not be searchable');
assert.deepStrictEqual(core.filterAndSort(rows,{sort:'attention'},locationFor).map(item=>item.slug),['review','partial','verified']);
assert.deepStrictEqual(core.filterAndSort(rows,{sort:'updated_desc'},locationFor).map(item=>item.slug),['partial','verified','review']);
assert.strictEqual(core.activeFilterCount({q:'село',trust:'partial',sort:'attention'}),3);
assert.strictEqual(core.formatDateRu('2026-07-18').includes('2026'),true);
console.log('TOS catalog actuality controls OK');