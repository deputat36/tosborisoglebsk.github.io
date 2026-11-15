'use strict';
const fs=require('node:fs');
const {publicHtml}=require('./sync_site_icons'),M=require('./sync_search_metadata');
const errors=[];let pages=0;
for(const file of publicHtml()){
 const html=fs.readFileSync(file,'utf8');
 if(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)||!M.canonical(html))continue;
 pages++;
 if(M.normalize(html,file)!==html)errors.push(file+': search metadata is stale');
 const own=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*data-portal-[^>]*>([\s\S]*?)<\/script>/g)];
 if(own.length!==1)errors.push(file+': expected one static site-name or breadcrumb node');
 for(const m of own){try{const d=JSON.parse(m[1]);if(file==='index.html'&&d['@type']!=='WebSite')errors.push(file+': missing WebSite');if(file!=='index.html'&&d['@type']!=='BreadcrumbList')errors.push(file+': missing BreadcrumbList');}catch{errors.push(file+': invalid JSON-LD');}}
 if(/property="og:image" content="https:\/\/tosborisoglebsk\.ru\/assets\/img\/og-cover\.svg"/.test(html))errors.push(file+': SVG is still used as the default social image');
}
if(errors.length)throw Error(errors.slice(0,30).join('\n'));
console.log('Static discovery OK: '+pages+' pages, crawlable site name/breadcrumbs, current PNG sharing image and RSS discovery');
