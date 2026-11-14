'use strict';
// Read-only observation. A changed response queues an editorial check; it does
// not update grants, legal metadata, source_checked_at or publication status.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const MAX_BYTES=5*1024*1024;
function sources(grants,materials){
  const rows=grants.flatMap(item=>(item.source_documents||[]).map(doc=>({url:doc.url,title:doc.title,used_by:item.id,verified_at:doc.checked_at})));
  for(const item of materials)if(item.checked_at&&/^https:\/\//.test(item.url))rows.push({url:item.url,title:item.title,used_by:item.id,verified_at:item.checked_at});
  const unique=new Map();
  for(const row of rows){const url=new URL(row.url);if(url.protocol!=='https:')throw Error('Only HTTPS sources are supported');if(unique.has(url.href))unique.get(url.href).used_by.push(row.used_by);else unique.set(url.href,{...row,url:url.href,used_by:[row.used_by]});}
  return [...unique.values()];
}
async function observe(row,previous,fetcher){
  const result={...row,retrieved_at:new Date().toISOString(),needs_editor:false};
  try{
    const response=await fetcher(row.url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'TOS-BGO-source-check/1.0'}});
    result.http_status=response.status;
    if(!response.ok)return {...result,state:'unavailable',needs_editor:true};
    if(Number(response.headers.get('content-length'))>MAX_BYTES)return {...result,state:'manual_large_document',needs_editor:true};
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.byteLength;if(size>MAX_BYTES){await response.body.cancel?.().catch(()=>{});return {...result,state:'manual_large_document',needs_editor:true};}chunks.push(Buffer.from(chunk));}
    const hash=createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
    const old=previous.find(item=>item.url===row.url&&item.sha256);
    return {...result,bytes:size,sha256:hash,state:!old?'first_observation':old.sha256===hash?'unchanged':'changed',needs_editor:Boolean(old&&old.sha256!==hash)};
  }catch(error){return {...result,state:'unavailable',needs_editor:true,error:error.name||'FetchError'};}
}
async function inspect(rows,previous=[],fetcher=fetch){
  const results=new Array(rows.length);let next=0;
  await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{while(next<rows.length){const i=next++;results[i]=await observe(rows[i],previous,fetcher);}}));
  return {generated_at:new Date().toISOString(),notice:'Техническое наблюдение не подтверждает условия. Изменения и недоступные документы требуют редакционного чтения.',results,review_queue:results.filter(row=>row.needs_editor).map(row=>({url:row.url,title:row.title,reason:row.state,used_by:row.used_by}))};
}
async function main(){
  const args=process.argv.slice(2),pos=args.indexOf('--output');
  const output=path.resolve(pos>=0?args[pos+1]:'.artifacts/support-source-review.json');
  const baseline='data/support_source_baseline.json';
  const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')).results||[]:fs.existsSync(baseline)?JSON.parse(fs.readFileSync(baseline,'utf8')).results||[]:[];
  const read=file=>JSON.parse(fs.readFileSync('data/'+file+'.json','utf8'));
  const report=await inspect(sources(read('grants'),read('materials')),previous);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(`Source observations: ${report.results.length}; editorial checks: ${report.review_queue.length}; ${path.relative(process.cwd(),output)}`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={sources,observe,inspect,MAX_BYTES};
