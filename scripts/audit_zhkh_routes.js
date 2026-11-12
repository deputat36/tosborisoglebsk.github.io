const assert = require('node:assert/strict');
const fs = require('node:fs');
const data = JSON.parse(fs.readFileSync('data/zhkh_routes.json','utf8'));
const articles = JSON.parse(fs.readFileSync('data/articles.json','utf8'));
const html = fs.readFileSync('residents/zhkh/index.html','utf8');
const sources = new Map(data.sources.map(source=>[source.id,source]));
const channels = new Set(data.channels.map(channel=>channel.id));
assert.equal(new Set(data.scenarios.map(item=>item.id)).size,data.scenarios.length);
for(const item of data.scenarios) {
  assert(articles.some(article=>article.id===item.article&&article.topic==='zhkh'),`existing housing instruction: ${item.article}`);
  assert(fs.existsSync(`downloads/zhkh/${item.worksheet}.txt`),`working sheet: ${item.worksheet}`);
  assert(item.collect.length>=2&&item.first&&item.recipient&&item.ask&&item.result&&item.tos);
  assert(item.channel_ids.every(id=>channels.has(id)),`recipient route exists: ${item.id}`);
  assert(html.includes(`data-zhkh-case="${item.id}"`),'all cases are present without fetching data');
}
for(const id of ['building','capital']) {
  assert.deepEqual(data.scenarios.find(item=>item.id===id).housing,['mkd'],'common MKD property is not assigned to a private house');
}
for(const channel of data.channels) {
  assert(channel.source_ids.length&&channel.source_ids.every(id=>sources.has(id)),'official directions have inspectable source boundaries');
  for(const link of channel.links)assert.equal(new URL(link.url).protocol,'https:');
}
assert(sources.get('gis-create').url.endsWith('t_add-grazhd.html'),'citizen help, not an organization role');
assert(sources.get('gis-send').url.endsWith('t_send-grazhd.html'));
assert(sources.get('rpn-local').basis.includes('Прямая загрузка'));
assert(sources.get('bgo-site').basis.includes('не были доступны'));
assert(!html.includes('<form'),'no official request or identity collection');
assert.equal(articles.filter(article=>article.topic==='zhkh').length,12);
const localScript = fs.readFileSync('assets/js/zhkh-guide.js','utf8');
assert(!/\bfetch\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon/.test(localScript),'selection does not send or persist data');
console.log(`ЖКХ: ${data.scenarios.length} статических маршрутов, границы МКД/частного дома и первичные источники проверены`);
