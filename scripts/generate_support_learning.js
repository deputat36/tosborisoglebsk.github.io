'use strict';
const fs=require('node:fs');
const path=require('node:path');
const core=require('../assets/js/grants-core');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=name=>JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'));
function block(html,key,body){const a='<!-- learning:'+key+':start -->',b='<!-- learning:'+key+':end -->',value=a+body+b;return html.includes(a)?html.replace(new RegExp(a+'[\\s\\S]*?'+b),()=>value):html.replace('</main>',value+'</main>');}
function page(template,route,title,description,main){
  return template.replace(/<title>[\s\S]*?<\/title>/,'<title>'+esc(title)+' | ТОС БГО</title>')
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g,'$1'+esc(description))
    .replace(/(<meta property="og:title" content=")[^"]*/g,'$1'+esc(title))
    .replace(/https:\/\/tosborisoglebsk\.ru\/grant-application-kit\//g,'https://tosborisoglebsk.ru'+route)
    .replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,'')
    .replace(/<main\b[^>]*>[\s\S]*?<\/main>/,()=>main)
    .replace(/<script\b[^>]*src="\/assets\/js\/(?:grants-core|contest-check)\.js[^"\s]*"[^>]*>\s*<\/script>/g,'');
}
function main(){
  const data=read('contest_checklists'),general=data.checklists.find(row=>row.id==='general');
  let kit=fs.readFileSync('grant-application-kit/index.html','utf8');
  kit=kit.replace(/<section\b[^>]*\bid="contest-check"[^>]*>/g,tag=>/class="[^"]*\bcontest-check\b/.test(tag)?tag:tag.replace('id="contest-check"','id="contest-overview"'));
  const section=`<section class="section contest-check" id="contest-check" aria-labelledby="contest-check-title"><div class="container"><div class="section-head"><div><h2 id="contest-check-title">Проверить комплект по конкретному конкурсу</h2><p>Выберите сезон и пройдите его список. Основные сведения проекта остаются в едином комплекте документов.</p></div></div><div data-contest-controls hidden><label for="contest-choice">Возможность и сезон</label><select class="input" id="contest-choice" data-contest-choice></select></div><p class="notice" data-contest-state>${esc(general.notice)}</p><div class="check-layout"><div><p role="status" aria-live="polite" data-contest-count>Общий список подготовки</p><ol class="check-list" data-contest-items>${general.items.map(item=>`<li>${esc(item.text)} <a href="${esc(item.tool)}">Рабочая форма</a></li>`).join('')}</ol></div><aside><h3>Официальные документы выбранного сезона</h3><ul data-contest-sources><li><a href="/grants/">Выберите возможность в каталоге</a></li></ul><p class="tiny">Отметки остаются на этой вкладке. Скачайте список или распечатайте его. Эта проверка не отправляет заявку и не оценивает вероятность победы.</p><a class="btn" href="/documents/templates/project-kit/">Открыть мой проект и формы</a></aside></div><div class="check-actions" data-contest-controls hidden><button type="button" class="btn" data-contest-print>Распечатать проверку</button><button type="button" class="btn" data-contest-download>Скачать список</button><button type="button" class="btn" data-contest-reset>Снять отметки</button></div></div></section>`;
  kit=block(kit,'contest-check',section);
  if(!kit.includes('/assets/css/support-learning.css'))kit=kit.replace('</head>','<link rel="stylesheet" href="/assets/css/support-learning.css"/></head>');
  if(!kit.includes('/assets/js/contest-check.js'))kit=kit.replace('</body>','<script src="/assets/js/grants-core.js" defer></script><script src="/assets/js/contest-check.js" defer></script></body>');
  fs.writeFileSync('grant-application-kit/index.html',kit);
  const learning=read('learning_paths');
  const cards=learning.modules.map(row=>`<article class="learning-card" id="${esc(row.id)}"><span class="tag">Шаг ${row.step} из ${learning.modules.length}</span><h2>${esc(row.title)}</h2><p>${esc(row.result)}</p><div class="card-actions"><a class="btn primary" href="${esc(row.url)}">Пройти шаг</a>${row.tools.map(tool=>`<a class="btn" href="${esc(tool.href)}">${esc(tool.label)}</a>`).join('')}</div></article>`).join('');
  const body=`<main id="main" class="support-learning"><section class="hero"><div class="container hero-card"><a class="chip" href="/chairperson/">← Председателю</a><div class="eyebrow">Практика общего дела</div><h1>Шесть шагов: от идеи ТОС до отчёта</h1><p class="lead">Короткие занятия заканчиваются рабочим документом или понятным действием. Можно начать с нужного шага и продолжать один общий проект.</p><div class="hero-actions"><a class="btn primary" href="#learning-route">Выбрать шаг</a><a class="btn" href="/documents/templates/project-kit/">Мой проект и формы</a><a class="btn" href="/materials/?type=book">Книги</a></div></div></section><section class="section"><div class="container"><p class="notice">Это редакционный маршрут самостоятельной подготовки. Условия конкурсов и юридические процедуры проверяются по действующим документам.</p><div class="learning-grid" id="learning-route">${cards}</div></div></section></main>`;
  fs.mkdirSync('chairperson/learning',{recursive:true});
  fs.writeFileSync('chairperson/learning/index.html',page(kit,'/chairperson/learning/','Шесть шагов: от идеи ТОС до отчёта','Самостоятельная подготовка проекта ТОС: жители, конкурс, документы, смета, реализация и отчёт. Короткие занятия связаны с рабочими формами.',body));
  let chair=fs.readFileSync('chairperson/index.html','utf8');
  chair=block(chair,'route',`<section class="section tight"><div class="container notice"><h2>От идеи до отчёта: шесть рабочих шагов</h2><p>Короткие занятия, документы и проверка подготовки по конкретному конкурсу.</p><div class="card-actions"><a class="btn primary" href="/chairperson/learning/">Начать с нужного шага</a><a class="btn" href="/grant-application-kit/#contest-check">Проверить комплект</a></div></div></section>`);
  fs.writeFileSync('chairperson/index.html',chair);
  const packetFile='documents/templates/project-kit/index.html';
  let packet=fs.readFileSync(packetFile,'utf8');
  if(!packet.includes('data-packet-result'))packet=packet.replace(/(<button\b[^>]*data-packet-prepare[^>]*>)/,'<button class="btn" type="button" data-packet-result>Выбрать комплект результата</button>$1');
  fs.writeFileSync(packetFile,packet);
  const examples=read('regional_practice_examples');
  let practices=fs.readFileSync('projects/practices/index.html','utf8');
  const cases=`<section class="section" id="regional-examples"><div class="container"><h2>Опыт Воронежской области</h2><p>Аннотированные примеры по сообщениям оператора. Полные сметы, акты и последующая эксплуатация не подтверждены.</p><div class="grid">${examples.examples.map(row=>`<article class="card"><div class="card-inner"><div class="meta"><span class="tag">Региональный пример</span></div><h3>${esc(row.title)}</h3><p>${esc(row.summary)}</p><p class="tiny">${esc(row.location)} · источник от ${esc(row.source_date)}</p><a class="btn" href="${esc(row.url)}">Разобрать пример</a></div></article>`).join('')}</div></div></section>`;
  practices=block(practices,'regional',cases);fs.writeFileSync('projects/practices/index.html',practices);
  console.log(`Support learning: ${learning.modules.length} modules, ${data.checklists.length} checklists, ${examples.examples.length} regional examples`);
}
if(require.main===module)main();
module.exports={main,block,page};
