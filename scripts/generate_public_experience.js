const fs=require('node:fs');
const path=require('node:path');
const view=require('../assets/js/home-view');
const homeCore=require('../assets/js/home-discovery-core');
const materials=require('../assets/js/materials-core');
const root=process.cwd();
const read=name=>JSON.parse(fs.readFileSync(name,'utf8'));
const navLinks=[['/tos/','Каталог ТОС'],['/residents/','Жителям'],['/chairperson/','Председателю'],['/projects/','Проекты'],['/documents/','Документы'],['/contacts/','Контакты'],['/sections/','Все разделы']];
function block(html,key,value){const begin=`<!-- public:${key}:start -->`,end=`<!-- public:${key}:end -->`;const pattern=new RegExp(begin+'[\\s\\S]*?'+end);if(!pattern.test(html))throw Error('Missing public block '+key);return html.replace(pattern,()=>begin+value+end);}
function allHtml(dir='') {return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(x=>x.isDirectory()?['.git','.github','.artifacts','.openai','node_modules','scripts','docs','admin'].includes(x.name)?[]:allHtml(path.join(dir,x.name)):x.name.endsWith('.html')?[path.join(dir,x.name)]:[]);}
function main(){
 const toses=read('data/toses.json').filter(x=>x.status!=='draft');
 let html=fs.readFileSync('index.html','utf8');
 html=block(html,'finder',view.directory(toses));
 const fields=['slug','name','location','boundaries','chairperson','description','verification_status','verified_at','verification_source','trust'];
 const directory=toses.map(x=>Object.fromEntries(fields.filter(k=>Object.hasOwn(x,k)).map(k=>[k,x[k]])));
 html=block(html,'finder-data','<script type="application/json" id="home-directory-data">'+JSON.stringify(directory).replace(/</g,'\\u003c')+'</script>');
 html=block(html,'current',view.overview(homeCore.buildCurrentOverview({events:read('data/events.json'),news:read('data/news.json'),grants:read('data/grants.json')})));
 const stats=[['Карточек ТОС',toses.length,'Рабочая подборка портала'],['Статей',read('data/articles.json').filter(x=>x.status!=='draft').length,'Инструкции и рекомендации'],['Рабочих форм проекта',9,'От проблемы до итогового отчёта'],['Материалов и инструментов',materials.buildCatalog(read('data/materials.json'),read('data/articles.json')).length,'Без повторных карточек одной страницы']];
 html=block(html,'stats',stats.map(([label,value,hint])=>`<article class="stat-card"><b>${value}</b><span>${view.esc(label)}</span><em>${view.esc(hint)}</em></article>`).join(''));
 html=html.replace(/<div class="proof-card big"><b>\d+<\/b><span>ТОС(?:а|ов) в каталоге<\/span>/,`<div class="proof-card big"><b>${toses.length}</b><span>ТОСов в каталоге</span>`).replace(/в каталоге опубликованы \d+ рабочие карточки ТОС/g,`в каталоге опубликованы ${toses.length} рабочие карточки ТОС`);
 fs.writeFileSync('index.html',html);
 let about=fs.readFileSync('methodology/index.html','utf8');
 about=block(about,'capabilities',`<ul><li>${toses.length} рабочих карточек ТОС с опубликованными сведениями и статусами проверки.</li><li>Девять связанных форм проекта: от описания проблемы до итогового отчёта.</li><li>Расчёт сметы, сохранение проекта в файл и подготовка общего комплекта для печати.</li><li>Инструкции и рабочие листы по дому и двору, сведения о конкурсах и организациях поддержки.</li></ul>`);
 fs.writeFileSync('methodology/index.html',about);
 let changed=0;
 for(const file of allHtml()){
  let source=fs.readFileSync(file,'utf8');
  if(!source.includes('id="site-nav"')||/name="robots"[^>]*noindex/i.test(source)||file.startsWith('culinary-battle/'))continue;
  const before=source;
  const route='/'+file.replace(/index\.html$/,'').replace(/\\/g,'/');
  const status=source.match(/<section class="section tight" data-portal-working-status>[\s\S]*?<\/section>/);
  if(status){
    const inside=status[0].replace(/^<section[^>]*><div class="container notice">/,'').replace(/<\/div><\/section>$/,'');
    const note=`<section class="section tight portal-status-note" data-portal-working-status><details class="container"><summary>Источники и актуальность сведений</summary><div class="notice">${inside}</div></details></section>`;
    source=source.replace(status[0],'');
    source=source.replace(/(<section class="hero">[\s\S]*?<\/section>)/,(_,hero)=>hero+note);
  }
  source=source.replace(/(<nav\b[^>]*id="site-nav"[^>]*>)\s*<\/nav>/,(_,open)=>open+navLinks.map(([href,label])=>`<a href="${href}"${route.startsWith(href)?' class="active" aria-current="page"':''}>${label}</a>`).join('')+'</nav>');
  if(!source.includes('/assets/css/portal-usability.css'))source=source.replace('</head>','<link rel="stylesheet" href="/assets/css/portal-usability.css"/></head>');
  source=source.replace(/Сайт работает на GitHub Pages\. Данные хранятся в JSON-файлах и могут обновляться без сервера\./g,'Информационный проект для жителей, активистов и председателей ТОС.');
  source=source.replace('Истории хранятся в data/done.json и уточняются по материалам председателей и актива ТОС.','Истории уточняются по материалам председателей и актива ТОС.')
    .replace('События загружаются из data/events.json. ','')
    .replace('Потребности хранятся в data/needs.json и проходят ручную проверку перед публикацией.','Потребности проходят ручную проверку перед публикацией.');
  if(source!==before){fs.writeFileSync(file,source);changed++;}
 }
 console.log(`Public experience generated: ${toses.length} TOS, readable homepage, ${changed} public page shells`);
}
if(require.main===module)main();
module.exports={main,block,navLinks};
