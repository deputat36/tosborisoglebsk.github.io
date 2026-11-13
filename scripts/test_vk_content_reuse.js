'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../assets/js/collection-browser-core');
const resident = require('../assets/js/resident-area-core');
const {coverageFor, coverageMap} = require('./lib/content_coverage');
const {mergeImportedNews} = require('./import_vk_news');
const {applyEditorialLinks, safeEditorialLinks} = require('./lib/vk_editorial_links');
const {renderExperience} = require('./lib/content_experience');
const read = name => JSON.parse(fs.readFileSync('data/' + name + '.json','utf8'));
const toses = read('toses'), slugs = new Set(toses.map(tos => tos.slug));
const news = read('news'), links = read('vk_editorial_links'), practices = read('tos_practices').practices;
const road = read('done').find(item => item.id === 'uyutnyy-prostornyy-road-2026');
assert.equal(new Set(practices.map(item => item.id)).size, practices.length);
assert.equal(new Set(links.entries.map(item => item.id)).size, links.entries.length);
for (const item of links.entries) {
  const actual = news.find(record => record.id === item.id);
  assert(actual && actual.imported_from === 'vk', `Missing source ${item.id}`);
  assert([actual.source_url, ...(actual.reposts || []).map(part => part.source_url)].includes(item.source_url), 'Editorial source must belong to the reviewed record');
  assert(item.tos_slugs.length && item.tos_slugs.every(slug => slugs.has(slug)));
  assert(item.tos_slugs.every(slug => core.belongsToTos(actual,slug)), `Lost relationship ${item.id}`);
  assert.equal(actual.content_origin,'editorial','Relationships cannot upgrade trust');
  assert.deepEqual(safeEditorialLinks(item.links),item.links,'All configured links must pass the renderer safety policy');
}
assert.deepEqual(core.tosSlugs({tos_slug:'uyutnyy',tos_slugs:['uyutnyy','prostornyy','../bad',null]}),['uyutnyy','prostornyy']);
for (const slug of ['uyutnyy','prostornyy']) {
  assert(core.belongsToTos(road,slug));
  assert.equal(coverageFor([road],slug,'done').all,1);
  assert.equal(coverageMap([road],'done').get(slug).all,1,'One case counts once in each participating card');
  const html = fs.readFileSync(`tos/${slug}/index.html`,'utf8');
  assert(html.includes('/done/' + road.id + '/'),`Shared case missing from ${slug}`);
}
assert.equal(read('done').filter(item => item.id === road.id).length,1,'Do not duplicate a shared result');
assert(!core.belongsToTos(road,'gubari'));
const vk = news.find(item => item.id === 'vk-238997964-938');
const fresh = {...vk, tos_slug:'', tos_slugs:[], editorial_links:[], title:'Исправленный автором заголовок', text:['Исправленный автором текст']};
const imported = mergeImportedNews([], [fresh]);
assert.equal(imported.length,1,'Editorial table must not resurrect absent VK posts');
assert.deepEqual(imported[0].text,fresh.text,'A re-import preserves current author text');
assert.equal(imported[0].title,fresh.title);
assert.deepEqual(core.tosSlugs(imported[0]),['uyutnyy','prostornyy'],'Full re-import retains reviewed participants');
assert.deepEqual(imported[0].images,vk.images,'Remote media is not copied or rewritten');
assert.deepEqual(applyEditorialLinks(imported),imported,'Editorial enrichment is idempotent');
const contextual = news.find(item => item.id === 'vk-238997964-819');
assert(contextual.relation_note.includes('2027') && contextual.relation_note.includes('ДК'));
const generated = fs.readFileSync('news/vk-238997964-584/index.html','utf8');
for (const slug of ['mechta','pervomayskiy']) assert(generated.includes(`/tos/${slug}/`));
const fixture = {...vk, id:'joint-news', date:'2026-10-16'};
for (const slug of ['uyutnyy','prostornyy']) assert(resident.overview({toses,news:[fixture]},slug,new Date('2026-11-13')).news.some(item => item.id === fixture.id));
for (const [file,fn] of [['news','newsCard'],['done','doneCard'],['projects','projectCard']]) {
  const context = vm.createContext({window:{CollectionBrowserCore:core},document:{querySelector:()=>null},URLSearchParams,URL});
  vm.runInContext(fs.readFileSync(`assets/js/${file}.js`,'utf8'),context);
  const render = vm.runInContext(fn,context);
  const html = render({...road,lead:road.summary,description:road.summary},toses);
  for (const slug of road.tos_slugs) assert(html.includes(`/tos/${slug}/`),`${file} renderer must expose every participant`);
}
const page = fs.readFileSync('projects/practices/index.html','utf8');
for (const practice of practices) {
  assert(practice.tos_slugs.every(slug => slugs.has(slug)));
  assert(practice.steps.length >= 3 && practice.resources.length >= 2 && practice.measure);
  assert(practice.examples.length > 0);
  assert(page.includes(`id="${practice.id}"`),'Practices work as deep links without scripts');
  for (const example of practice.examples) {
    assert(news.some(item => `/news/${item.id}/` === example.href));
    assert(/^https:\/\/vk\.com\/wall-?\d+_\d+$/.test(example.source_url));
  }
}
assert(page.includes('data-practice-controls hidden'),'No-script reading does not show unusable filters');
assert(page.includes('role="status"') && page.includes('<details>'));
assert.equal((page.match(/data-practice data-topic=/g)||[]).length,practices.length);
const project = read('projects').find(item => item.id === 'mirolyubie-igray-i-pobezhday-2026');
assert(project.grant_amount.includes('запрашиваемая сумма'),'Winner list does not prove disbursement');
assert.deepEqual(project.milestones.map(stage=>stage.date),['2026-07-27','2026-08-07','2026-09-04']);
assert.equal(project.milestones[2].source_date,'2026-09-05','Event date differs from publication date');
const unsafe = renderExperience({editorial_links:[{href:'javascript:alert(1)',label:'Bad'},{href:'/projects/practices/#eco-game',label:'<script>bad</script>'}],milestones:[{date:'2026-11-13',title:'<img src=x>',source_url:'javascript:alert(1)'}]});
assert(!unsafe.includes('javascript:') && !unsafe.includes('<img') && !unsafe.includes('<script>bad'));
assert(unsafe.includes('&lt;script&gt;'));
console.log(`VK reuse OK: ${links.entries.length} reviewed news, ${practices.length} practices; shared cards, import persistence, source roles, chronology and safe rendering`);
