(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerritoryMapCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='tos-territory-map-v1',MAX_FEATURES=120,MAX_POINTS=10000,MAX_RING=1600,EPS=1e-13;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const text=(x,max=800)=>typeof x==='string'?x.trim().slice(0,max):'';
  const fail=message=>{throw new Error(message);};
  const same=(a,b)=>Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS;
  function coord(p){if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=='number'||!Number.isFinite(x))||Math.abs(p[0])>180||Math.abs(p[1])>85)fail('Координаты должны содержать долготу и широту в допустимом диапазоне.');return p.map(x=>Math.round(x*1e7)/1e7);}
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function onSegment(p,a,b){return Math.abs(cross(a,b,p))<=EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;}
  function intersects(a,b,c,d,proper=false){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);if(((x>EPS&&y< -EPS)||(x< -EPS&&y>EPS))&&((z>EPS&&w< -EPS)||(z< -EPS&&w>EPS)))return true;return !proper&&[onSegment(c,a,b),onSegment(d,a,b),onSegment(a,c,d),onSegment(b,c,d)].some(Boolean);}
  function ringHit(point,ring){let inside=false;for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){const a=ring[j],b=ring[i];if(onSegment(point,a,b))return 2;if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside?1:0;}
  function polygonHit(point,rings,strict=false){const outer=ringHit(point,rings[0]);if(!outer||strict&&outer===2)return false;for(const hole of rings.slice(1)){const hit=ringHit(point,hole);if(hit===1||strict&&hit===2)return false;}return true;}
  const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  const contains=(point,g)=>polygons(g).some(p=>polygonHit(point,p));
  function ringCross(a,b,proper=false){for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++)if(intersects(a[i],a[i+1],b[j],b[j+1],proper))return true;return false;}
  function signed(ring){let a=0;for(let i=0;i<ring.length-1;i++)a+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];return a/2;}
  function normalizeRing(raw){
    if(!Array.isArray(raw)||raw.length<3||raw.length>MAX_RING)fail('Контур должен содержать от 3 до '+(MAX_RING-1)+' вершин.');
    const ring=raw.map(coord);if(!same(ring[0],ring[ring.length-1]))ring.push([...ring[0]]);
    if(ring.length<4||Math.abs(signed(ring))<EPS)fail('Контур должен охватывать площадь, а не линию.');
    for(let i=0;i<ring.length-1;i++){
      if(same(ring[i],ring[i+1]))fail('Соседние вершины совпадают. Уберите повторную точку.');
      for(let j=i+1;j<ring.length-1;j++){
        if(j===i+1||i===0&&j===ring.length-2)continue;
        if(intersects(ring[i],ring[i+1],ring[j],ring[j+1]))fail('Линия пересекает сама себя. Исправьте порядок точек.');
      }
    }
    return ring;
  }
  function normalizePolygon(raw){
    if(!Array.isArray(raw)||!raw.length||raw.length>40)fail('У территории должен быть внешний контур и не более 39 исключений.');
    const rings=raw.map(normalizeRing);
    for(let i=1;i<rings.length;i++){
      if(rings[i].slice(0,-1).some(p=>ringHit(p,rings[0])!==1)||ringCross(rings[0],rings[i]))fail('Исключаемый участок должен целиком находиться внутри территории.');
      for(let j=1;j<i;j++)if(ringCross(rings[j],rings[i])||ringHit(rings[j][0],rings[i])||ringHit(rings[i][0],rings[j]))fail('Исключаемые участки не должны пересекаться или вкладываться друг в друга.');
    }
    return rings;
  }
  function normalize(raw,catalog){
    const value=raw&&raw.kind==='tos-territory-map'?(raw.version===1?raw.featureCollection:fail('Неподдерживаемая версия файла карты.')):raw;
    if(!value||value.type!=='FeatureCollection'||!Array.isArray(value.features)||value.features.length>MAX_FEATURES)fail('Откройте файл разметки GeoJSON, не более '+MAX_FEATURES+' объектов.');
    const slugs=new Set(catalog.map(x=>x.slug)),features=[];let count=0;
    for(const [index,item] of value.features.entries()){
      if(!item||item.type!=='Feature'||!item.geometry||!['Polygon','MultiPolygon'].includes(item.geometry.type))fail('В разметке разрешены только территории Polygon и MultiPolygon.');
      const props=item.properties;if(!props||typeof props!=='object'||Array.isArray(props))fail('Не найдены сведения о территории.');
      const kind=props.kind==='initiative'?'initiative':'tos',slug=text(props.slug,100),name=text(props.name,180);
      if(kind==='tos'&&!slugs.has(slug))fail('Неизвестный ТОС: '+(slug||'не указан')+'. Выберите запись из каталога.');
      if(kind==='initiative'&&!name)fail('Назовите набросок нового ТОС.');
      const pieces=polygons(item.geometry);if(!pieces.length||pieces.length>40)fail('Неверный состав территории.');
      for(const [part,polygon]of pieces.entries()){
        const rings=normalizePolygon(polygon);count+=rings.reduce((n,r)=>n+r.length,0);if(count>MAX_POINTS||features.length>=MAX_FEATURES)fail('В файле слишком много вершин или участков.');
        const base=text(String(item.id??props.id??'area-'+index),140).replace(/[^a-zA-Z0-9_-]/g,'_')||'area-'+index;
        features.push({type:'Feature',id:base+(pieces.length>1?'-part-'+(part+1):''),properties:{kind,slug:kind==='tos'?slug:'',name:kind==='initiative'?name:catalog.find(x=>x.slug===slug).name,basis:props.basis==='document'?'document':'sketch',source:text(props.source,600),note:text(props.note||props.public_note,800)},geometry:{type:'Polygon',coordinates:rings}});
      }
    }
    const ids=new Set();for(const f of features){if(ids.has(f.id))fail('В файле повторяются идентификаторы участков.');ids.add(f.id);}
    return {type:'FeatureCollection',features};
  }
  function bounds(g){const points=polygons(g).flat(2);if(!points.length)return null;return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
  function overlap(a,b){
    const ab=bounds(a),bb=bounds(b);if(!ab||!bb||ab[0]>=bb[2]-EPS||bb[0]>=ab[2]-EPS||ab[1]>=bb[3]-EPS||bb[1]>=ab[3]-EPS)return false;
    for(const pa of polygons(a))for(const pb of polygons(b)){
      if(pa.some(r=>pb.some(s=>ringCross(r,s,true))))return true;
      for(const [own,other]of [[pa,pb],[pb,pa]]){
        if(own[0].slice(0,-1).some(p=>polygonHit(p,other,true)))return true;
        for(let i=0;i<own[0].length-1;i++){
          const u=own[0][i],v=own[0][i+1],dx=v[0]-u[0],dy=v[1]-u[1],len=Math.hypot(dx,dy);if(!len)continue;
          const step=Math.min(len*.01,1e-6),mid=[(u[0]+v[0])/2,(u[1]+v[1])/2];
          for(const sign of [1,-1]){const q=[mid[0]-sign*dy/len*step,mid[1]+sign*dx/len*step];if(polygonHit(q,own,true)&&polygonHit(q,other,true))return true;}
        }
      }
    }
    return false;
  }
  function ringArea(r){const rad=Math.PI/180;let sum=0;for(let i=0;i<r.length-1;i++)sum+=(r[i+1][0]-r[i][0])*rad*(2+Math.sin(r[i][1]*rad)+Math.sin(r[i+1][1]*rad));return Math.abs(sum*6371008.8**2/2);}
  const areaHa=g=>polygons(g).reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((n,r)=>n+ringArea(r),0),0)/10000;
  function diagnostics(collection,reference){
    const fs=collection.features,conflicts=[];
    for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++)if(overlap(fs[i].geometry,fs[j].geometry))conflicts.push([fs[i].id,fs[j].id]);
    const outside=reference?fs.filter(f=>f.geometry.coordinates[0].some(p=>!contains(p,reference))||polygons(reference).some(p=>p.some(r=>ringCross(f.geometry.coordinates[0],r,true)))).map(f=>f.id):[];
    return {conflicts,outside};
  }
  function parseCoordinates(value){
    const lines=String(value).trim().split(/\r?\n/).filter(x=>x.trim());
    return normalizeRing(lines.map(line=>{const parts=line.trim().split(/[;\s]+/).map(x=>Number(x.replace(',','.')));if(parts.length!==2||parts.some(x=>!Number.isFinite(x)))fail('По одной вершине в строке: широта пробел долгота, например 51.368015 42.075169.');return [parts[1],parts[0]];}));
  }
  const coordinatesText=ring=>ring.slice(0,-1).map(p=>p[1].toFixed(7)+' '+p[0].toFixed(7)).join('\n');
  function exportData(fc){return {type:'FeatureCollection',name:'Рабочая разметка ТОС БГО',metadata:{kind:'tos-territory-map',version:1,status:'draft',note:'Разметка автора. Требует проверки перед публикацией и не подтверждает юридическую свободу неразмеченных участков.'},features:clone(fc.features)};}
  const csvCell=x=>{let v=String(x??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
  function csv(fc){return '\uFEFF'+[['Территория','Тип','Площадь приблизительно га','Основание автора','Источник','Примечание'],...fc.features.map(f=>[f.properties.name,f.properties.kind==='tos'?'ТОС':'Новая инициатива',areaHa(f.geometry).toFixed(2).replace('.',','),f.properties.basis==='document'?'По указанному документу':'Рабочая схема',f.properties.source,f.properties.note])].map(row=>row.map(csvCell).join(';')).join('\r\n');}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function svg(fc,reference){
    const all=fc.features.length?fc.features.map(f=>bounds(f.geometry)):reference?[bounds(reference)]:[];if(!all.length)fail('Сначала нарисуйте хотя бы одну территорию.');
    const b=[Math.min(...all.map(x=>x[0])),Math.min(...all.map(x=>x[1])),Math.max(...all.map(x=>x[2])),Math.max(...all.map(x=>x[3]))];
    const lat=(b[1]+b[3])/2*Math.PI/180,scaleX=Math.cos(lat),rangeX=Math.max((b[2]-b[0])*scaleX,.0001),rangeY=Math.max(b[3]-b[1],.0001),scale=Math.min(1060/rangeX,600/rangeY),ox=40+(1060-rangeX*scale)/2,oy=110+(600-rangeY*scale)/2;
    const path=g=>polygons(g).map(poly=>poly.map(r=>r.map((p,i)=>(i?'L':'M')+(ox+(p[0]-b[0])*scaleX*scale).toFixed(2)+' '+(oy+(b[3]-p[1])*scale).toFixed(2)).join(' ')+' Z').join(' ')).join(' ');
    const rows=fc.features.map((f,i)=>'<text x="40" y="'+(775+i*26)+'">'+esc((i+1)+'. '+f.properties.name+' · '+areaHa(f.geometry).toFixed(2)+' га приблизительно')+'</text>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1140" height="'+(850+fc.features.length*26)+'" viewBox="0 0 1140 '+(850+fc.features.length*26)+'"><title>Рабочая схема территорий ТОС БГО</title><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif" fill="#222"><text x="40" y="40" font-size="25" font-weight="bold">ТОС БГО · Рабочая схема территорий</text><text x="40" y="70" font-size="15">Разметка автора. Не является официальной границей или подтверждением свободной территории.</text></g><svg x="25" y="90" width="1090" height="640" viewBox="25 90 1090 640">'+(reference?'<path d="'+path(reference)+'" fill="#f0f0eb" stroke="#777" stroke-width="1" fill-rule="evenodd"/>':'')+fc.features.map((f,i)=>'<path d="'+path(f.geometry)+'" fill="'+(f.properties.kind==='initiative'?'#2f7d5a':'#B62D36')+'" fill-opacity=".25" stroke="'+(f.properties.kind==='initiative'?'#2f7d5a':'#B62D36')+'" stroke-width="2" fill-rule="evenodd"><title>'+esc((i+1)+'. '+f.properties.name)+'</title></path>').join('')+'</svg><g font-family="Arial,sans-serif" font-size="16" fill="#222">'+rows+'<text x="40" y="'+(815+fc.features.length*26)+'" font-size="13">Контур округа © OpenStreetMap contributors · ODbL 1.0 · tosborisoglebsk.ru/map/</text></g></svg>';
  }
  return {KEY,MAX_FEATURES,MAX_POINTS,clone,normalize,normalizeRing,normalizePolygon,parseCoordinates,coordinatesText,contains,overlap,areaHa,diagnostics,bounds,polygons,exportData,csv,svg,esc};
});
