'use strict';
const assert=require('node:assert/strict');
const {observe,inspect,sources}=require('./check_support_sources');
async function main(){
 const row={url:'https://example.test/rules',title:'Rules',used_by:['call'],verified_at:'2026-11-14'};
 const before=JSON.stringify(row);
 const first=await observe(row,[],async()=>new Response('version 1'));
 assert.equal(first.state,'first_observation');assert.equal(first.needs_editor,false);
 const same=await observe(row,[first],async()=>new Response('version 1'));
 assert.equal(same.state,'unchanged');
 const changed=await observe(row,[first],async()=>new Response('version 2'));
 assert.equal(changed.state,'changed');assert(changed.needs_editor);
 const unavailable=await observe(row,[first],async()=>new Response('',{status:503}));
 assert.equal(unavailable.state,'unavailable');assert(unavailable.needs_editor);
 const large=await observe(row,[first],async()=>new Response('x',{headers:{'content-length':'10000000'}}));
 assert.equal(large.state,'manual_large_document');
 const report=await inspect([row],[first],async()=>new Response('changed'));
 assert.equal(report.review_queue.length,1);assert.equal(report.results[0].verified_at,row.verified_at);
 assert.equal(JSON.stringify(row),before,'observation never edits source facts or review dates');
 assert.equal(sources([{id:'one',source_documents:[{url:row.url,title:'a',checked_at:'2026-11-14'}]},{id:'two',source_documents:[{url:row.url,title:'a',checked_at:'2026-11-14'}]}],[]).length,1);
 console.log('Source review OK: change queue, unavailable/large sources, deduplication and immutable public verification');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
