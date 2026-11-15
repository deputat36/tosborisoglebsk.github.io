'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const growth=require('../assets/js/portal-growth-core'),lastmod=require('./lib/content_lastmod'),metadata=require('./sync_search_metadata'),readiness=require('./generate_portal_readiness');
const tasks=JSON.parse(fs.readFileSync('data/portal_tasks.json','utf8'));
assert.equal(tasks.length,9);assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
for(const t of tasks){assert(t.title&&t.description&&t.keywords&&t.audience.length);const route=t.href.split(/[?#]/)[0];assert(route.startsWith('/')&&!route.startsWith('//'));assert(fs.existsSync('.'+route+'index.html'),t.href);}
assert.deepEqual(tasks.filter(t=>growth.matches(t,'СМЕТА','')).map(t=>t.id),['project']);
assert.equal(tasks.filter(t=>growth.matches(t,'несуществующая задача 123','')).length,0);
assert.equal(growth.matches(tasks.find(t=>t.id==='learning'),'','partner'),false);
assert.equal(growth.normalize(' Соседи ЁЛКА '),'соседи елка');
const r=readiness.report();assert.equal(r.metrics.length,6);assert(r.metrics.every(m=>Number.isInteger(m.value)&&m.value>=0));
assert.equal(r.metrics.find(m=>m.id==='forms').value,9);assert(!Object.hasOwn(r.traffic,'visits'));assert.match(r.scope,/не статистика пользователей/);
const brief=readiness.writeBrief(r);assert(brief.includes(r.checked_at));assert(brief.includes('не выводятся из этих чисел'));assert(!/экономия\s+\d+/i.test(brief));
const html='<html><head><title>Название страницы</title><meta name="description" content="Описание"/><meta property="og:title" content="Название"/><meta property="og:image" content="https://tosborisoglebsk.ru/assets/img/og-cover.svg"/><link rel="canonical" href="https://tosborisoglebsk.ru/"/></head><body><header>Меню</header><main><h1>Реальная задача</h1><p>Одинаковое содержание</p><a href="/tos/">Каталог</a></main><footer>2025</footer><script src="/site.js?v=1"></script></body></html>';
const normalized=metadata.normalize(html,'index.html');assert.equal(metadata.normalize(normalized,'index.html'),normalized);
const {ensureRelayScript}=require('./patch_tos_contact_fallback');
for(const fixture of ['<head></head><body><script src="/assets/js/site.js"></script></body>', '<head></head><body><script defer src="/assets/js/site.js?v=123"></script><p>Другой блок</p></body>']){
 const relay=ensureRelayScript(fixture);assert(relay.changed);assert.equal(ensureRelayScript(relay.content).content,relay.content);assert.equal((relay.content.match(/contact-relay\.js/g)||[]).length,1);
 const hashed=relay.content.replace('contact-relay.js','contact-relay.js?v=abc');assert.equal(ensureRelayScript(hashed).content,hashed);
}
assert.throws(()=>ensureRelayScript('<head></head><body></body>'),/source marker not found/);
assert.throws(()=>ensureRelayScript('<script src="/assets/js/contact-relay.js"></script>'.repeat(2)),/duplicate/);
const metrica=require('./sync_metrica');const combined=metadata.normalize(metrica.normalize(normalized,'index.html'),'index.html');assert.equal(metrica.normalize(combined,'index.html'),combined,'independent shared blocks keep their position');assert.equal(metadata.normalize(combined,'index.html'),combined);
assert.equal((normalized.match(/data-portal-website-schema/g)||[]).length,1);assert(normalized.includes('og-cover.png'));assert(!normalized.includes('SearchAction'));
assert.equal(metadata.normalize(html.replace('</head>','<meta name="robots" content="noindex"/></head>'),'index.html'),html.replace('</head>','<meta name="robots" content="noindex"/></head>'));
const old=lastmod.entry(normalized,null,'2026-11-10','2026-11-15');
const shell=normalized.replace('>Меню<','>Новое меню<').replace('>2025<','>2026<').replace('/site.js?v=1','/site.js?v=2');
assert.equal(lastmod.entry(shell,old,'2026-11-15','2026-11-16').lastmod,'2026-11-10','header/footer/script changes are not a content refresh');
const content=normalized.replace('Одинаковое содержание','Новое проверенное содержание');assert.equal(lastmod.entry(content,old,'2026-11-15','2026-11-16').lastmod,'2026-11-16');
assert.notEqual(lastmod.signature(normalized.replace('href="/tos/"','href="/materials/"')),old.digest,'changed useful link is significant');
assert.notEqual(lastmod.signature(normalized.replace('<h1>Реальная задача</h1>','<h1>Другая задача</h1>')),old.digest);
console.log('Portal readiness OK: task relevance, real content metrics, reproducible brief, static metadata and significant-content sitemap dates');
