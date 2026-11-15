'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { publicHtml } = require('./sync_site_icons');
const { decodeHtmlText } = require('./lib/html_text');
const SITE = 'https://tosborisoglebsk.ru';
const LABELS = { tos:'Каталог ТОС', news:'Новости', projects:'Проекты', done:'Результаты', needs:'Нужна помощь', materials:'Материалы', documents:'Документы', legal:'Правовая основа', places:'Территории', chairperson:'Председателю', residents:'Жителям', partners:'Партнёрам', grants:'Конкурсы', calendar:'Календарь', contacts:'Контакты', search:'Поиск', sections:'Все разделы', methodology:'Методика портала', privacy:'Публикация сведений', 'create-tos':'Как создать ТОС', map:'Карта территорий ТОС' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function value(html, property) { return decodeHtmlText((html.match(new RegExp('<meta\\b[^>]*(?:name|property)=["\']'+property+'["\'][^>]*content=["\']([^"\']*)["\']','i')) || [])[1] || ''); }
function canonical(html) { return (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || ''; }
function normalize(html, file, root=process.cwd()) {
  const slot='<!-- search:metadata:slot -->';let retained=false;
  let clean = html.replace(/<!-- search:metadata:start -->[\s\S]*?<!-- search:metadata:end -->/g,()=>{if(retained)return '';retained=true;return slot;});
  if (!/<\/head>/i.test(clean) || /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(clean)) return clean.replace(slot,'');
  const url = canonical(clean);
  if (!url.startsWith(SITE+'/') || /[?#]/.test(url)) return clean.replace(slot,'');
  clean = clean.replace(/https:\/\/tosborisoglebsk\.ru\/assets\/img\/og-cover\.svg/g, SITE+'/assets/img/og-cover.png');
  const image = value(clean, 'og:image');
  const title = value(clean, 'og:title') || decodeHtmlText((clean.match(/<title>([^<]*)<\/title>/i)||[])[1]||'');
  const description = value(clean, 'og:description') || value(clean, 'description');
  let tags = '<meta property="og:site_name" content="ТОС БГО"/><meta property="og:locale" content="ru_RU"/>';
  if (image === SITE+'/assets/img/og-cover.png') tags += '<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:type" content="image/png"/><meta property="og:image:alt" content="ТОС БГО — люди, территории, развитие"/>';
  if (!/name=["']twitter:card["']/.test(clean)) tags += '<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="'+esc(title)+'"/><meta name="twitter:description" content="'+esc(description)+'"/><meta name="twitter:image" content="'+esc(image)+'"/>';
  if (!/type=["']application\/rss\+xml/.test(clean)) tags += '<link rel="alternate" type="application/rss+xml" title="Новости ТОС БГО" href="/rss.xml"/>';
  const data = url === SITE+'/' ? { '@context':'https://schema.org', '@type':'WebSite', '@id':SITE+'/#website', url:SITE+'/', name:'ТОС БГО', alternateName:'ТОС Борисоглебского городского округа', inLanguage:'ru-RU' } : null;
  if (data) tags += '<script type="application/ld+json" data-portal-website-schema>'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';
  else {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const h1 = decodeHtmlText(((clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||title).replace(/<[^>]*>/g,'')).trim();
    const links = [{ name:'Главная', item:SITE+'/' }];
    if (parts.length>1 && fs.existsSync(path.join(root,parts[0],'index.html'))) links.push({name:LABELS[parts[0]]||h1,item:SITE+'/'+parts[0]+'/'});
    links.push({name:parts.length===1?(LABELS[parts[0]]||h1):h1,item:url});
    const breadcrumb = { '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement:links.map((x,i)=>({'@type':'ListItem',position:i+1,...x})) };
    tags += '<script type="application/ld+json" data-portal-breadcrumb-schema>'+JSON.stringify(breadcrumb).replace(/</g,'\\u003c')+'</script>';
  }
  const siteScript=path.join(root,'assets/js/site.js');
  if(fs.existsSync(siteScript)) {
    const hash=createHash('sha256').update(fs.readFileSync(siteScript)).digest('hex').slice(0,12);
    clean=clean.replace(/src=["']\/assets\/js\/site\.js(?:\?[^"']*)?["']/g,'src="/assets/js/site.js?v='+hash+'"');
  }
  const block='<!-- search:metadata:start -->'+tags+'<!-- search:metadata:end -->';
  return retained?clean.replace(slot,block):clean.replace(/<\/head>/i,block+'</head>');
}
function sync(root=process.cwd()) {
  let changed=0;
  for(const file of publicHtml(root)) {
    const full=path.join(root,file),html=fs.readFileSync(full,'utf8'),updated=normalize(html,file,root);
    if(html!==updated){fs.writeFileSync(full,updated);changed++;}
  }
  console.log('Static search and sharing metadata synchronized: '+changed+' pages');
}
if(require.main===module)sync();
module.exports={normalize, sync, value, canonical};
