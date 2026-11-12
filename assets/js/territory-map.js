(function(){
  'use strict';
  const C=window.TerritoryMapCore,B=window.TerritoryMapBasemaps,L=window.L,dataNode=document.getElementById('territory-map-data');
  if(!C||!B||!L||!dataNode)return;
  const $=name=>document.querySelector('[data-map-'+name+']');
  let data;try{data=JSON.parse(dataNode.textContent);}catch(_){return;}
  const catalog=data.catalog,reference=data.reference.features[0].geometry,published=data.public;
  const empty=()=>({type:'FeatureCollection',features:[]});
  let draft=empty(),editing=false,selected='',ringIndex=0,drawing=null,history=[],future=[],savedRaw=null,storageBlocked=false,concurrent=false;
  const status=message=>{$('status').textContent=message;};
  const bySlug=slug=>catalog.find(t=>t.slug===slug);
  const current=()=>editing?draft:published;
  const feature=()=>draft.features.find(f=>f.id===selected);
  const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
  function error(e){status(e.message||String(e));}
  function attempt(fn){return function(){try{fn.apply(null,arguments);}catch(e){error(e);}};}
  function action(name,fn){$(name).addEventListener('click',attempt(fn));}
  function writable(){if(!editing)throw new Error('Сначала нажмите «Моя разметка».');if(concurrent)throw new Error('Разметка изменена в другой вкладке. Скачайте текущую версию и обновите страницу перед дальнейшей правкой.');if(drawing)throw new Error('Сначала завершите или отмените рисование.');}
  function readSaved(){
    try{savedRaw=localStorage.getItem(C.KEY);if(savedRaw){const value=JSON.parse(savedRaw);draft=C.normalize(value,catalog);}}
    catch(e){storageBlocked=true;status('Сохранённая разметка недоступна или повреждена. Оригинал не перезаписывается. Можно работать и скачать новый файл; для замены используйте «Очистить мою разметку».');}
  }
  function persist(){
    if(storageBlocked){status('Работа сохранена в текущей вкладке. Автосохранение недоступно: скачайте файл разметки.');return;}
    try{
      if(localStorage.getItem(C.KEY)!==savedRaw){concurrent=true;status('Разметка изменена в другой вкладке. Скачайте свою версию и обновите страницу: чужие изменения не перезаписаны.');return;}
      const raw=JSON.stringify({kind:'tos-territory-map',version:1,featureCollection:C.exportData(draft)});
      localStorage.setItem(C.KEY,raw);savedRaw=raw;status('Изменения сохранены на этом устройстве. Скачайте файл для резервной копии.');
    }catch(_){storageBlocked=true;status('Браузер не разрешил автосохранение. Скачайте разметку, чтобы не потерять работу после закрытия вкладки.');}
  }
  function commit(next,keepSelection=true){
    writable();const valid=C.normalize(next,catalog);history.push(C.clone(draft));if(history.length>30)history.shift();future=[];draft=valid;
    if(!keepSelection||!feature())selected='';persist();render();
  }
  readSaved();
  const map=L.map('territory-map',{scrollWheelZoom:false,doubleClickZoom:true,preferCanvas:false,zoomControl:false}).setView([51.368015,42.075169],14);
  L.control.zoom({zoomInTitle:'Приблизить',zoomOutTitle:'Отдалить'}).addTo(map);
  L.control.scale({imperial:false,maxWidth:110}).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  map.attributionControl.addAttribution('Контур © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · ODbL');
  const referenceLayer=L.geoJSON(data.reference,{style:{color:'#868e82',weight:2,fillColor:'#e2e5dc',fillOpacity:.75},interactive:false}).addTo(map);
  const shapes=L.layerGroup().addTo(map),vertices=L.layerGroup().addTo(map),drawLayer=L.layerGroup().addTo(map);
  let tiles=null,layerSerial=0,providerId=B.settings(data.basemaps).defaultProvider;
  const availableBasemaps=B.providers(data.basemaps);
  const brand=L.control({position:'bottomleft'});
  brand.onAdd=()=>{const link=el('a');link.href='https://yandex.ru/maps/';link.target='_blank';link.rel='noopener';link.className='map-yandex-logo';const img=el('img');img.src='/assets/img/yandex-tiles-logo.svg';img.alt='Яндекс Карты';img.width=88;img.height=48;link.append(img);L.DomEvent.disableClickPropagation(link);return link;};
  availableBasemaps.forEach(p=>$('basemap').add(new Option(p.label,p.id)));
  $('basemap-label').hidden=availableBasemaps.length<2;$('basemap').value=providerId;
  function setBasemap(enabled,id=providerId,recovered=false){
    const serial=++layerSerial;let successes=0,failures=0;
    if(tiles){tiles.off();map.removeLayer(tiles);tiles=null;}brand.remove();
    providerId=availableBasemaps.some(p=>p.id===id)?id:'osm';$('basemap').value=providerId;
    $('tiles').setAttribute('aria-pressed',String(enabled));$('tiles').textContent=enabled?'Скрыть улицы':'Показать улицы';$('retry-tiles').hidden=true;
    referenceLayer.setStyle({fillOpacity:enabled?0:.75});
    if(!enabled){$('basemap-status').textContent='Подложка скрыта. Контуры остаются на карте.';return;}
    const provider=availableBasemaps.find(p=>p.id===providerId),prefix=recovered?'Подложка Яндекса недоступна. Показываем OpenStreetMap. ':'';
    if(providerId==='yandex')brand.addTo(map);
    tiles=B.createLayer(L,provider);const active=tiles;
    active.on('loading',()=>{if(serial===layerSerial){successes=0;failures=0;$('basemap-status').textContent=prefix+'Загружаем улицы и дома: '+provider.label+'.';}});
    active.on('tileload',()=>{if(serial===layerSerial)successes++;});
    active.on('tileerror',()=>{if(serial===layerSerial){failures++;$('retry-tiles').hidden=false;$('basemap-status').textContent='Часть подложки не загрузилась. Можно повторить загрузку; разметка сохраняется отдельно.';}});
    active.on('load',()=>{
      if(serial!==layerSerial)return;
      if(failures&&successes===0&&providerId==='yandex'){setBasemap(true,'osm',true);return;}
      $('retry-tiles').hidden=failures===0;
      $('basemap-status').textContent=failures?(successes?'Часть карты не загрузилась. Нажмите «Повторить загрузку карты».':'Не удалось загрузить улицы и дома. Проверьте интернет и нажмите «Повторить загрузку карты».'):prefix+'Подложка: '+provider.label+'. Приблизьте карту для улиц, домов и подписей объектов.';
    });
    active.addTo(map);
  }
  const fitGeometry=g=>{const b=C.bounds(g);if(b)map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[24,24],maxZoom:17});};
  const visibleBoundaries=()=>current().features.filter(f=>f.geometry.type!=='Point');
  function options(){
    const query=$('search').value.trim().toLocaleLowerCase('ru'),value=$('tos').value;
    const matches=catalog.filter(t=>[t.name,t.location].join(' ').toLocaleLowerCase('ru').includes(query));
    $('tos').replaceChildren(new Option(matches.length?'Выберите ТОС':'Ничего не найдено',''));
    matches.forEach(t=>$('tos').add(new Option(t.name+' · '+t.location,t.slug)));
    if(matches.some(t=>t.slug===value))$('tos').value=value;
    selection();
  }
  function selection(){
    const tos=bySlug($('tos').value),fs=visibleBoundaries().filter(f=>f.properties.slug===tos?.slug);
    const box=$('selection');box.replaceChildren();
    if(tos){box.append(el('b',tos.name),el('span',tos.location),el('p',fs.length?(editing?'В моей разметке: ':'Опубликовано участков: ')+fs.length+'.':'Граница этого ТОС пока не нанесена. Наличие записи в каталоге не означает наличие контура.'));}
    else box.textContent='Выберите ТОС или нажмите на интересующее место карты.';
    $('card').href=tos?'/tos/'+tos.slug+'/':'/tos/';$('share').disabled=!tos;$('fit').disabled=!fs.length;
    $('share-output').hidden=true;
    const slugs=new Set(visibleBoundaries().filter(f=>f.properties.kind!=='initiative').map(f=>f.properties.slug));
    $('stat').textContent=(editing?'В моей разметке':'На общей карте')+': контуры '+slugs.size+' из '+catalog.length+' ТОС каталога. Каталог и границы дополняются.';
  }
  function metadata(f){
    const p=f?.properties;$('kind').value=p?.kind||'tos';$('name').value=p?.kind==='initiative'?p.name:'';
    $('name-label').hidden=$('kind').value!=='initiative';$('basis').value=p?.basis||'sketch';$('source').value=p?.source||'';$('note').value=p?.note||'';
    if(p?.slug&&Array.from($('tos').options).some(o=>o.value===p.slug))$('tos').value=p.slug;
    ringIndex=0;ringEditor();selection();
  }
  function ringEditor(){
    const f=feature();$('ring').replaceChildren();
    if(f){f.geometry.coordinates.forEach((_,i)=>$('ring').add(new Option(i?'Исключение '+i:'Внешняя граница',String(i))));ringIndex=Math.min(ringIndex,f.geometry.coordinates.length-1);$('ring').value=String(ringIndex);$('coordinates').value=C.coordinatesText(f.geometry.coordinates[ringIndex]);}
    else {$('ring').add(new Option('Новый внешний контур','0'));$('coordinates').value='';}
    $('apply-coordinates').disabled=!!drawing||concurrent;$('delete-hole').disabled=!f||ringIndex===0;
  }
  function choose(id,fit=false){selected=id;metadata(feature());render();if(fit&&feature())fitGeometry(feature().geometry);}
  function description(){
    const kind=$('kind').value,tos=bySlug($('tos').value),name=$('name').value.trim();
    if(kind==='tos'&&!tos)throw new Error('Выберите ТОС в каталоге слева.');
    if(kind==='initiative'&&!name)throw new Error('Укажите рабочее название новой инициативы.');
    return {kind,slug:kind==='tos'?tos.slug:'',name:kind==='tos'?tos.name:name,basis:$('basis').value,source:$('source').value.trim(),note:$('note').value.trim()};
  }
  function drawVertices(){
    vertices.clearLayers();const f=feature();if(!editing||!f||drawing)return;
    const ring=f.geometry.coordinates[ringIndex];if(ring.length>201){status('В этом контуре больше 200 вершин. Для точной правки используйте поле координат ниже.');return;}
    ring.slice(0,-1).forEach((p,index)=>{
      const marker=L.marker([p[1],p[0]],{draggable:true,keyboard:false,icon:L.divIcon({className:'map-vertex',iconSize:[20,20],iconAnchor:[10,10]}),title:'Вершина '+(index+1)}).addTo(vertices);
      marker.on('dragend',attempt(()=>{writable();const point=marker.getLatLng(),next=C.clone(draft),target=next.features.find(x=>x.id===selected),r=target.geometry.coordinates[ringIndex];r[index]=[point.lng,point.lat];if(index===0)r[r.length-1]=r[0].slice();try{commit(next);ringEditor();}catch(e){render();throw e;}}));
    });
  }
  function render(){
    shapes.clearLayers();
    current().features.forEach(f=>{
      const p=f.properties,isPoint=f.geometry.type==='Point';
      const fill=Number($('opacity').value)/100;
      const layer=L.geoJSON(f,{interactive:!drawing,style:{color:editing?(p.kind==='initiative'?'#2f7d5a':'#a77512'):'#B62D36',weight:f.id===selected?4:2,fillOpacity:fill,dashArray:editing?'7 5':null},pointToLayer:(_,ll)=>L.circleMarker(ll,{radius:7,color:'#B62D36',fillOpacity:.8,interactive:!drawing})});
      const popup=el('div');popup.append(el('b',p.name||bySlug(p.slug)?.name||'Территория ТОС'),el('p',isPoint?'Точка-ориентир. Не является границей.':editing?'Рабочая разметка автора. Требует проверки.':p.public_note));
      if(p.slug){const link=el('a','Открыть карточку ТОС');link.href='/tos/'+p.slug+'/';popup.append(link);}
      if(!drawing)layer.bindPopup(popup);
      if(!isPoint&&!drawing)layer.bindTooltip(el('span',(editing?(p.kind==='initiative'?'Идея: ':'Разметка: '):'')+(p.name||bySlug(p.slug)?.name||'ТОС')),{permanent:true,direction:'center',className:'map-area-label'});
      layer.on('click',e=>{if(drawing)return;if(editing&&f.id)choose(f.id);else lookup([e.latlng.lng,e.latlng.lat]);});layer.addTo(shapes);
    });
    $('inspector').hidden=!editing;$('working').hidden=!editing;$('drawbar').hidden=!editing;$('public').hidden=!editing;$('start').hidden=editing;
    $('mode-note').textContent=editing?'Моя разметка · рабочие контуры на этом устройстве. Посетители общей карты их не видят.':'Опубликованная карта · только проверенные границы. Моя разметка хранится отдельно.';
    $('areas').replaceChildren();
    draft.features.forEach((f,i)=>{const li=el('li'),button=el('button');button.type='button';button.setAttribute('aria-pressed',String(f.id===selected));button.append(el('span',(i+1)+'. '+f.properties.name),el('small',C.areaHa(f.geometry).toLocaleString('ru-RU',{maximumFractionDigits:2})+' га приблизительно · '+(f.properties.kind==='initiative'?'новая инициатива':'рабочий контур ТОС')));button.addEventListener('click',attempt(()=>{writable();choose(f.id,true);}));li.append(button);$('areas').append(li);});
    if(!draft.features.length)$('areas').append(el('li','Участков пока нет. Выберите ТОС или назовите инициативу и нарисуйте контур.'));
    $('undo').disabled=!history.length||!!drawing||concurrent;$('redo').disabled=!future.length||!!drawing||concurrent;
    $('delete').disabled=!feature()||!!drawing||concurrent;$('clear').disabled=!!drawing||concurrent;$('hole').disabled=!feature()||!!drawing||concurrent;$('draw').disabled=!!drawing||concurrent;
    $('save-description').disabled=!feature()||!!drawing||concurrent;
    $('apply-coordinates').disabled=!!drawing||concurrent;$('delete-hole').disabled=!feature()||ringIndex===0||!!drawing||concurrent;
    $('crosshair').hidden=!drawing;
    document.getElementById('territory-map').classList.toggle('is-drawing',!!drawing);
    for(const key of ['finish','center','cancel'])$(key).disabled=!drawing||key==='finish'&&drawing.points.length<3;
    $('back-point').disabled=!drawing||!drawing.points.length;
    selection();drawVertices();
  }
  function start(){
    if(editing)return;editing=true;selected='';ringIndex=0;
    if(!savedRaw&&!draft.features.length){draft=C.normalize({type:'FeatureCollection',features:published.features.filter(f=>f.geometry.type!=='Point')},catalog);}
    metadata();render();map.invalidateSize();
    if(storageBlocked)status('Автосохранение недоступно. Работайте в этой вкладке и скачайте файл до её закрытия.');
    else status('Выберите ТОС или новую инициативу и нажмите «Нарисовать контур». Готовую разметку скачайте для передачи редактору.');
  }
  function refreshDraw(){
    drawLayer.clearLayers();if(!drawing)return;
    const points=drawing.points.map(p=>[p[1],p[0]]);
    if(points.length>1)L.polyline(points,{color:'#B62D36',weight:3,interactive:false,dashArray:'5 4'}).addTo(drawLayer);
    points.forEach((p,i)=>L.circleMarker(p,{radius:5,color:'#B62D36',fillColor:'white',fillOpacity:1,interactive:false}).bindTooltip(String(i+1)).addTo(drawLayer));
    render();status('Вершин: '+points.length+'. '+(points.length<3?'Добавьте не менее трёх точек.':'Завершите контур или добавьте ещё вершины.'));
  }
  function addPoint(p){if(drawing.points.length>=1599)throw new Error('Достигнут предел вершин контура.');drawing.points.push(p);refreshDraw();}
  function cancelDraw(){drawing=null;drawLayer.clearLayers();map.doubleClickZoom.enable();render();status('Рисование отменено. Сохранённые участки остаются в разметке.');}
  function lookup(point){
    const box=$('point-result');box.replaceChildren();const fs=visibleBoundaries().filter(f=>C.contains(point,f.geometry));
    if(fs.length){box.append(el('b',editing?'По моей разметке в этой точке:':'По опубликованным границам в этой точке:'));fs.forEach(f=>{const p=el('p',f.properties.name||bySlug(f.properties.slug)?.name);if(f.properties.slug){const a=el('a','Карточка ТОС');a.href='/tos/'+f.properties.slug+'/';p.append(document.createTextNode(' · '),a);}box.append(p);});}
    else if(C.contains(point,reference)){box.append(el('p','Граница ТОС в этой точке не нанесена. Возможность создания нового ТОС уточните по реестру в администрации.'));const a=el('a','Как создать ТОС');a.href='/create-tos/';box.append(a);}
    else box.append(el('p','Точка вне картографического контура округа. Положение и административную принадлежность нужно уточнить.'));
  }
  map.on('click',attempt(e=>{if(drawing)addPoint([e.latlng.lng,e.latlng.lat]);else lookup([e.latlng.lng,e.latlng.lat]);}));
  action('start',start);
  action('public',()=>{if(drawing)cancelDraw();editing=false;selected='';render();map.invalidateSize();status('Опубликованные данные. Ваша разметка остаётся на устройстве.');});
  $('search').addEventListener('input',options);
  $('tos').addEventListener('change',attempt(()=>{if(drawing){cancelDraw();}const f=draft.features.find(f=>f.properties.slug===$('tos').value);selected=editing&&f?f.id:'';metadata(editing?f:null);render();}));
  $('kind').addEventListener('change',()=>{$('name-label').hidden=$('kind').value!=='initiative';});
  action('fit',()=>{const fs=visibleBoundaries().filter(f=>f.properties.slug===$('tos').value);if(fs.length)fitGeometry({type:'MultiPolygon',coordinates:fs.flatMap(f=>C.polygons(f.geometry))});});
  action('district',()=>map.fitBounds(referenceLayer.getBounds(),{padding:[16,16]}));
  action('city',()=>map.setView([51.368015,42.075169],15));
  action('tiles',()=>setBasemap(!tiles));
  action('retry-tiles',()=>setBasemap(true));
  $('basemap').addEventListener('change',attempt(()=>setBasemap(true,$('basemap').value)));
  $('opacity').addEventListener('input',()=>{$('opacity-value').textContent=$('opacity').value+'%';render();});
  action('share',()=>{const tos=bySlug($('tos').value);if(!tos)return;const url=new URL('/map/',location.origin);url.searchParams.set('tos',tos.slug);$('share-output').value=url.href;$('share-output').hidden=false;$('share-output').focus();$('share-output').select();status('Скопируйте ссылку из поля. Она открывает ТОС на общей карте и не передаёт вашу рабочую разметку.');});
  action('draw',()=>{writable();const props=description();drawing={points:[],props,hole:false};map.closePopup();map.doubleClickZoom.disable();refreshDraw();});
  action('hole',()=>{writable();if(!feature())return;drawing={points:[],hole:true,target:selected};map.closePopup();map.doubleClickZoom.disable();refreshDraw();});
  action('center',()=>{if(drawing){const p=map.getCenter();addPoint([p.lng,p.lat]);}});
  action('back-point',()=>{if(drawing){drawing.points.pop();refreshDraw();}});
  action('cancel',cancelDraw);
  action('finish',()=>{
    if(!drawing)return;const ring=C.normalizeRing(drawing.points),next=C.clone(draft),value=drawing;
    if(value.hole){const f=next.features.find(f=>f.id===value.target);f.geometry.coordinates=C.normalizePolygon([...f.geometry.coordinates,ring]);selected=f.id;}
    else {const id='area-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);next.features.push({type:'Feature',id,properties:value.props,geometry:{type:'Polygon',coordinates:[ring]}});selected=id;}
    C.normalize(next,catalog);drawing=null;drawLayer.clearLayers();map.doubleClickZoom.enable();commit(next);metadata(feature());render();
  });
  action('save-description',()=>{writable();const next=C.clone(draft);next.features.find(f=>f.id===selected).properties=description();commit(next);});
  $('ring').addEventListener('change',()=>{ringIndex=Number($('ring').value)||0;ringEditor();drawVertices();});
  action('apply-coordinates',()=>{
    writable();const ring=C.parseCoordinates($('coordinates').value);
    if(!feature()){const props=description(),id='area-'+Date.now().toString(36);const next=C.clone(draft);next.features.push({type:'Feature',id,properties:props,geometry:{type:'Polygon',coordinates:[ring]}});selected=id;commit(next);metadata(feature());}
    else {const next=C.clone(draft);next.features.find(f=>f.id===selected).geometry.coordinates[ringIndex]=ring;commit(next);ringEditor();}
  });
  action('delete-hole',()=>{writable();if(!feature()||!ringIndex||!confirm('Удалить выбранное исключение из участка?'))return;const next=C.clone(draft);next.features.find(f=>f.id===selected).geometry.coordinates.splice(ringIndex,1);ringIndex=0;commit(next);ringEditor();});
  action('delete',()=>{writable();if(feature()&&confirm('Удалить выбранный участок из моей разметки? Изменение можно отменить.')){commit({type:'FeatureCollection',features:draft.features.filter(f=>f.id!==selected)},false);metadata();}});
  action('clear',()=>{writable();if(confirm('Очистить мою разметку на этом устройстве? Сначала скачайте нужный файл. Изменение можно отменить в этой вкладке.')){if(storageBlocked){try{savedRaw=localStorage.getItem(C.KEY);storageBlocked=false;}catch(_){}}commit(empty(),false);metadata();}});
  for(const [name,from,to]of [['undo',()=>history,()=>future],['redo',()=>future,()=>history]])action(name,()=>{writable();if(!from().length)return;to().push(C.clone(draft));draft=from().pop();selected='';persist();metadata();render();});
  function download(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download='tos-bgo-territories-'+new Date().toISOString().slice(0,10)+'.'+extension;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Файл подготовлен. Сохраните его в загрузках и передайте редактору для общей публикации.');}
  action('export',()=>download(JSON.stringify(C.exportData(draft),null,2),'application/geo+json;charset=utf-8','geojson'));
  action('csv',()=>download(C.csv(draft),'text/csv;charset=utf-8','csv'));
  action('svg',()=>download(C.svg(draft,reference),'image/svg+xml;charset=utf-8','svg'));
  action('import',()=>{writable();$('file').click();});
  $('file').addEventListener('change',async()=>{
    const file=$('file').files[0];$('file').value='';if(!file)return;
    try{writable();if(file.size>2000000)throw new Error('Файл больше 2 МБ. Используйте GeoJSON без фотографий и посторонних данных.');const next=C.normalize(JSON.parse(await file.text()),catalog);writable();if(draft.features.length&&!confirm('Заменить текущую рабочую разметку содержимым файла? Изменение можно отменить.'))return;commit(next,false);metadata();if(next.features.length)fitGeometry({type:'MultiPolygon',coordinates:next.features.map(f=>f.geometry.coordinates)});}
    catch(e){error(e);}
  });
  action('check',()=>{
    const result=C.diagnostics(draft,reference),box=$('check-results'),names=id=>draft.features.find(f=>f.id===id)?.properties.name||id;box.replaceChildren();
    if(!result.conflicts.length&&!result.outside.length)box.append(el('p','Пересечений контуров и выхода за картографический контур округа не найдено. Это геометрическая проверка, а не подтверждение официальных границ.'));
    const list=el('ul');result.conflicts.forEach(pair=>list.append(el('li','Есть наложение: '+pair.map(names).join(' / ')+'. Уточните границы или части одного ТОС.')));result.outside.forEach(id=>list.append(el('li',names(id)+': участок выходит за картографический контур округа. Уточните положение.')));box.append(list);status('Проверка завершена. Найдено наложений: '+result.conflicts.length+'; участков вне контура округа: '+result.outside.length+'.');
  });
  window.addEventListener('storage',e=>{if(e.key===C.KEY&&e.newValue!==savedRaw){concurrent=true;render();status('Разметка изменена в другой вкладке. Скачайте свою версию и обновите страницу перед правкой.');}});
  $('app').hidden=false;$('fallback').hidden=true;map.invalidateSize();map.setView([51.368015,42.075169],14,{animate:false});
  const query=new URL(location.href).searchParams.get('tos');if(bySlug(query))$('tos').value=query;
  const initial=published.features.filter(f=>f.properties.slug===query&&f.geometry.type!=='Point');if(initial.length)fitGeometry({type:'MultiPolygon',coordinates:initial.flatMap(f=>C.polygons(f.geometry))});
  render();
  setBasemap(true);
  if(published.features.length===0&&!storageBlocked)status('Проверенные границы ТОС пока не опубликованы. Вы можете подготовить разметку; отсутствие контура не означает свободную территорию.');
})();
