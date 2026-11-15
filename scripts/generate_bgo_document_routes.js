'use strict';
const fs=require('node:fs');
function block(html,key,body){
  const start='<!-- learning:'+key+':start -->',end='<!-- learning:'+key+':end -->';
  const value=start+body+end;
  return html.includes(start)?html.replace(new RegExp(start+'[\\s\\S]*?'+end),()=>value):html.replace('</main>',value+'</main>');
}
function main(){
  const section='<section class="section tight" id="bgo-local-documents"><div class="container notice"><h2>Местные документы: что уточнить до собрания</h2><p>Для своей ситуации соберите официальные акты о границах, собраниях и регистрации устава. Подготовлен список вопросов и текст запроса с учётом найденных сведений об отмене старого Положения.</p><div class="card-actions"><a class="btn primary" href="/materials/bgo-local-documents-2026/">Проверить комплект местных документов</a><a class="btn" href="/docs/templates/zapros-mestnyh-dokumentov-tos-bgo.txt" download>Скачать запрос документов</a></div></div></section>';
  for(const file of ['create-tos/index.html','legal/chairperson-practical-checklist/index.html']){
    let html=fs.readFileSync(file,'utf8');
    if(!html.includes('<!-- learning:bgo-documents:start -->')&&file.startsWith('create-tos/')){
      html=html.replace(/(<section class="hero">[\s\S]*?<\/section>)/,(_,hero)=>hero+'<!-- learning:bgo-documents:start -->'+section+'<!-- learning:bgo-documents:end -->');
    }else html=block(html,'bgo-documents',section);
    fs.writeFileSync(file,html);
  }
  console.log('BGO document routes: one editorial guide and request linked from existing creation and legal routes');
}
if(require.main===module)main();
module.exports={main};
