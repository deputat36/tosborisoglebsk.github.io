'use strict';
const fs=require('node:fs');
const HOST='tosborisoglebsk.ru',ENDPOINT='https://api.indexnow.org/indexnow';
function payload(urls,config,allowed){
 if(config.host!==HOST||!/^[a-zA-Z0-9-]{8,128}$/.test(config.key))throw Error('Invalid IndexNow configuration');
 if(config.key_location!=='https://'+HOST+'/'+config.key+'.txt')throw Error('The verification file must belong to the site root');
 const unique=[...new Set(urls)];if(!unique.length||unique.length>10000)throw Error('Select 1–10000 public URLs');
 for(const value of unique){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!==HOST||u.port||u.username||u.password||u.search||u.hash||!allowed.has(value))throw Error('Only canonical URLs from the current sitemap may be submitted');}
 return {host:HOST,key:config.key,keyLocation:config.key_location,urlList:unique};
}
function selection(allowed,mode){
 if(mode==='all')return [...allowed];if(mode!=='priority')throw Error('Mode must be priority or all');
 const routes=['/','/sections/','/methodology/','/tos/','/materials/','/grants/','/residents/','/residents/my-area/','/residents/zhkh/','/chairperson/','/chairperson/learning/','/create-tos/','/documents/','/projects/practices/','/meeting-kit/'];
 return [...allowed].filter(url=>routes.includes(new URL(url).pathname)||/^\/tos\/[^/]+\/$/.test(new URL(url).pathname));
}
async function main(){
 const config=JSON.parse(fs.readFileSync('data/indexnow.json','utf8'));
 const xml=fs.readFileSync('sitemap.xml','utf8'),allowed=new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]));
 const data=payload(selection(allowed,process.env.INDEXNOW_MODE||'priority'),config,allowed);
 if(!process.argv.includes('--submit')){console.log('IndexNow dry run: '+data.urlList.length+' canonical public URLs. No request sent.');return;}
 const keyResponse=await fetch(data.keyLocation,{signal:AbortSignal.timeout(30000)});
 if(!keyResponse.ok||keyResponse.url!==data.keyLocation||(await keyResponse.text()).trim()!==config.key)throw Error('Published verification file is not ready; no URLs submitted');
 const queue=[...data.urlList];
 await Promise.all(Array.from({length:5},async()=>{while(queue.length){const url=queue.shift(),r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok||r.url!==url)throw Error('Public page is not ready: '+url);const html=await r.text();if(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)||!html.includes('rel="canonical" href="'+url+'"'))throw Error('Canonical/indexability check failed: '+url);}}));
 const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
 const body=await r.text();
 const receipt={submitted_at:new Date().toISOString(),endpoint:ENDPOINT,status:r.status,url_count:data.urlList.length,urls:data.urlList,meaning:r.status===200?'The service received the URLs; indexing is not guaranteed':r.status===202?'The service received the URLs; key validation is pending':'Submission was not accepted',response:body.slice(0,1000)};
 fs.mkdirSync('.artifacts',{recursive:true});fs.writeFileSync('.artifacts/indexnow-receipt.json',JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({status:receipt.status,url_count:receipt.url_count,meaning:receipt.meaning}));
 if(![200,202].includes(r.status))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={payload,selection};
