'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../assets/js/grants-core');
const {grantCard,grantSources}=require('../assets/js/grants');
const materials=require('../assets/js/materials-core');
const read=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
const grants=read('grants'), checklists=read('contest_checklists');
const current=Date.parse('2026-11-14T17:00:00+03:00');
for(const row of grants){
 assert(core.TYPES[row.opportunity_type],`${row.id}: missing opportunity type`);
 assert(['day','minute','none'].includes(row.deadline_precision));
 assert(row.eligibility && Array.isArray(row.eligibility.applicant_types));
 for(const kind of row.eligibility.applicant_types)assert(core.APPLICANTS[kind],`${row.id}: unknown applicant`);
 for(const theme of row.eligibility.themes)assert(core.THEMES[theme],`${row.id}: unknown theme`);
 if(row.deadline_precision==='day'){assert(core.dayStamp(row.deadline_date)!==null);assert(!row.deadline_at,'an unknown public hour is not stored as a claimed midnight');}
 if(row.deadline_precision==='minute')assert(core.deadline(row)!==null);
 for(const doc of row.source_documents||[]){assert(core.safeUrl(doc.url));assert(core.dayStamp(doc.checked_at)!==null);assert(doc.title);}
}
const main=grants.find(x=>x.id==='tos-voronezh-projects-2026');
assert.equal(main.deadline_date,'2026-02-11');assert.equal(main.operator,'АНО «Образ Будущего»');
assert(main.source.includes('Novaya_redaktsia'));assert(main.source_history.length);
assert(!core.matches(main,{applicant:'tos-entity'},current));assert(core.matches(main,{applicant:'tos-no-entity',theme:'landscaping'},current));
const pfki=grants.find(x=>x.id==='pfki-2027-second');
assert.equal(core.state(pfki,current),'announced');
assert.equal(core.state(pfki,Date.parse('2026-12-07T23:30:01+03:00')),'closed');
assert(!core.matches(pfki,{applicant:'tos-no-entity'},current));assert(core.matches(pfki,{applicant:'nonprofit',theme:'culture',geography:'bgo'},current));
assert(!core.matches(pfki,{theme:'landscaping'},current));
assert(core.matches(pfki,{q:'ПФКИ 27-2'},current));
assert.equal(core.state(grants.find(x=>x.id==='fpg-2027-first'),current),'closed');
const local=grants.find(x=>x.id==='fond-borisoglebsk-second-2026');
assert(core.matches(local,{applicant:'tos-no-entity'},current));assert.equal(core.eligibility(local,'tos-no-entity'),'unknown');
assert.equal(core.state(local,Date.parse('2026-11-30T23:59:59+03:00')),'announced');
assert.equal(core.state(local,Date.parse('2026-12-01T00:00:00+03:00')),'closed');
assert.equal(core.deadline({...local,deadline_date:'2026-02-30'}),null);
assert.equal(core.moscowDay(Date.parse('2026-11-14T21:05:00Z')),'2026-11-15');
assert(!grantSources({source_documents:[{url:'javascript:alert(1)',title:'bad'}]}).includes('javascript'));
assert(!grantCard({id:'safe',title:'test',source:'javascript:alert(1)',conditions_url:'data:text/plain,x',prepare:[]}).includes('href="javascript'));
const ids=new Set(grants.map(x=>x.id));
const kit=fs.readFileSync('grant-application-kit/index.html','utf8');
assert.equal((kit.match(/\bid="contest-check"/g)||[]).length,1,'the interactive checklist has one unambiguous root');
for(const list of checklists.checklists){
 assert(list.items.length>=5);assert.equal(new Set(list.items.map(x=>x.id)).size,list.items.length);
 for(const id of list.opportunities)assert(ids.has(id));
 for(const item of list.items){
  assert(fs.existsSync('.'+item.tool+'index.html'),`${list.id}: missing working form ${item.tool}`);
  if(list.id!=='general')assert(core.safeUrl(list.sources[item.source_index]?.url),`${list.id}: question without document`);
 }
}
const catalog=materials.buildCatalog(read('materials'),read('articles'));
assert(catalog.some(x=>materials.matches(x,{type:'book',q:'Вагина'})));
assert(catalog.filter(x=>materials.matches(x,{type:'form',region:'voronezh'})).some(x=>x.id==='voronezh-tos-document-method-2025'));
assert(catalog.find(x=>x.id==='community-manager-book-2021').review_scope.includes('полный текст не изучен'));
assert.equal(read('learning_paths').modules.length,6);
for(const row of read('learning_paths').modules)assert(fs.existsSync('.'+row.url+'index.html'));
assert.equal(read('regional_practice_examples').examples.length,3);
console.log('Support research OK: source versions, Moscow date precision, applicant routes, 4 sourced checklists, books, lessons and regional examples');
