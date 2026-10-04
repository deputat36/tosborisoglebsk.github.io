const assert = require('node:assert/strict');
const media = require('../assets/js/news-media');
for (const value of ['javascript:alert(1)', 'data:image/png,x', 'http://example.com/x.jpg', '//example.com/x.jpg', '/a/../secret', '/a\\b.jpg', 'https://user:password@example.com/x.jpg']) assert.equal(media.safeUrl(value), '');
const item = {title:'Фото <события>',image:'/assets/img/a.jpg',images:['/assets/img/a.jpg',{src:'https://example.com/b.jpg',alt:'" alt',caption:'<script>alert(1)</script>'}]};
assert.equal(media.images(item).length,2);
assert.equal(media.images({...item,images:Array.from({length:20},(_,i)=>'/assets/img/'+i+'.jpg')}).length,8);
const html=media.render(item); assert.equal((html.match(/<img /g)||[]).length,2);assert.ok(html.includes('loading="lazy"'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.equal((media.render(item,true).match(/<img /g)||[]).length,1);
assert.equal(media.render({title:'Без фото'}),'');
console.log('News media validation, deduplication, gallery and escaping OK');
