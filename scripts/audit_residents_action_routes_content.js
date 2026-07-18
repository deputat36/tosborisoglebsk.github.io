const fs=require('fs');
const path=require('path');
const {repoPathExists}=require('./lib/path_checks');

const root=process.cwd();
const htmlPath=path.join(root,'residents','action-routes','index.html');
const corePath=path.join(root,'assets','js','resident-route-core.js');
const uiPath=path.join(root,'assets','js','resident-route-navigator.js');
const cssPath=path.join(root,'assets','css','design-upgrades.css');

function read(filePath){if(!fs.existsSync(filePath))throw new Error(`Missing file: ${filePath}`);return fs.readFileSync(filePath,'utf8');}
function need(errors,content,label,needle){if(!content.includes(needle))errors.push(`${label}: missing ${needle}`);}

function main(){
  const html=read(htmlPath);
  const core=read(corePath);
  const ui=read(uiPath);
  const css=read(cssPath);
  const errors=[];

  [
    '<title>Куда обратиться жителю — навигатор по вопросам территории и ТОС</title>',
    'id="resident-route-navigator"',
    'data-route-options',
    'data-route-result',
    'data-route-copy',
    'data-route-reset',
    'data-route-status',
    'aria-live="polite"',
    'Личные сведения вводить не нужно',
    'навигатор даёт общую подсказку',
    'Шесть основных действий через ТОС',
    'Универсальный шаблон сообщения',
    'Не уверены в выборе?',
    '/assets/js/resident-route-core.js',
    '/assets/js/resident-route-navigator.js'
  ].forEach(needle=>need(errors,html,'residents/action-routes/index.html',needle));

  const requiredLinks=['/residents/','/#find-tos','/tos/','/places/','/needs/','/projects/','/partners/','/calendar/','/done/','/contacts/','/field-checklist/','/update-tos/'];
  requiredLinks.forEach(link=>{need(errors,html,'residents/action-routes/index.html',`href="${link}`);if(!repoPathExists(link.split('#')[0].split('?')[0]||'/'))errors.push(`missing linked local page ${link}`);});

  ['type=need#message-builder','type=project#message-builder','type=event#message-builder','type=news#message-builder','type=photo#message-builder','type=card#message-builder'].forEach(route=>need(errors,html,'residents/action-routes/index.html',route));

  if(html.includes('href="/map/"'))errors.push('empty map must not be presented as a resident action route');
  if(html.includes('0</b><span>сложных формальностей'))errors.push('page must not promise zero formalities');

  ['urgent','building','municipal','collective','event','result','portal'].forEach(code=>need(errors,core,'resident-route-core.js',`${code}:`));
  need(errors,core,'resident-route-core.js','actions:[]');
  need(errors,core,'resident-route-core.js','function buildMessage');
  need(errors,ui,'resident-route-navigator.js','aria-pressed');
  need(errors,ui,'resident-route-navigator.js','navigator.clipboard.writeText');
  need(errors,css,'design-upgrades.css','.route-navigator-grid');
  need(errors,css,'design-upgrades.css','.route-choice[aria-pressed=true]');

  if(errors.length)throw new Error(`Residents action routes content audit failed:\n${errors.join('\n')}`);
  console.log('Residents action route navigator content OK');
}

main();
