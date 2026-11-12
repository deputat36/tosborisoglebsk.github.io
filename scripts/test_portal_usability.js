const assert=require('node:assert/strict'),fs=require('node:fs');
const workspace=require('../assets/js/project-workspace-core'),use=require('../assets/js/portal-use-case-core');
const state=workspace.fresh();
assert.equal(workspace.draftChecks(state).filter(x=>x.ready).length,0);
state.common={project:'Проект двора',territory:'Учебная территория',problem:'Потребность жителей',goal:'Место для встреч',beneficiaries:'Жители территории',responsible:'Руководитель проекта',start:'01.05.2027',end:'30.06.2027'};
assert(workspace.draftChecks(state).every(x=>x.ready));state.common.problem='нет';assert(!workspace.draftChecks(state).find(x=>x.key==='problem').ready);
state.documents['final-report']={f20:'Проверенный вручную план'};
assert.equal(workspace.fieldValue(state,'final-report',{key:'f20',budget:'total',default:''}),'Проверенный вручную план');
assert.equal(workspace.fieldValue(state,'final-report',{key:'f2',derived:'period',default:''}),'01.05.2027 — 30.06.2027');
assert.equal(workspace.fieldValue(state,'final-report',{key:'f40',default:''}),'','planned dates never become actual dates');
for(const [form,key] of [['photo-report','f3'],['support','f4']]){const s=fs.readFileSync(`documents/templates/project-${form}/index.html`,'utf8');const tag=s.match(new RegExp('<span\\b[^>]*data-project-field="'+key+'"[^>]*>'))[0];assert(!tag.includes('data-project-common'),'separate roles stay local');assert.equal(workspace.fieldValue(state,form,{key,default:''}),'');}
const record=use.fresh();assert(use.checks(record).length>0);record.fields={...record.fields,date:'2026-11-12',tos:'Учебная территория',tool:'Паспорт',task:'Подготовить документ',result:'Документ подготовлен',evidence:'Сохранённый документ'};
assert(use.checks(record).includes('Подтверждение автора о выполненном случае'));record.author_confirmed=true;assert.equal(use.checks(record).length,0);assert.match(use.toText(record),/Редакционная проверка: не проводилась/);
record.fields.before='20';assert(use.checks(record).some(x=>x.includes('замера')),'one number cannot become a comparison');
assert.deepEqual(use.normalize(JSON.parse(JSON.stringify(record))),record);
assert.throws(()=>use.normalize({...record,fields:{unknown:'x'}}));assert.throws(()=>use.normalize({...record,author_confirmed:'yes'}));assert.throws(()=>use.normalize({...record,fields:{...record.fields,result:'x'.repeat(5001)}}));
const page=fs.readFileSync('index.html','utf8'),count=JSON.parse(fs.readFileSync('data/toses.json')).filter(x=>x.status!=='draft').length;
const embedded=JSON.parse(page.match(/<script type="application\/json" id="home-directory-data">([\s\S]*?)<\/script>/)[1]);assert.equal(embedded.length,count);assert(!embedded.some(x=>x.phones||x.emails||x.contacts_raw),'search snapshot excludes direct contacts');assert(!page.includes('Загрузка каталога...'));


const impossible=use.fresh();impossible.fields.date="2026-02-30";assert(use.checks(impossible).some(x=>x.includes("Существующая дата")));
console.log('Portal usability checks OK: draft guidance, independent roles and actual dates, safe use records, complete static directory');
