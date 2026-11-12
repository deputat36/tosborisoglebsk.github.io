const fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../assets/js/territory-map-core');
const B=require('../assets/js/territory-map-basemaps');
function generate(){
  const catalog=JSON.parse(fs.readFileSync('data/toses.json','utf8')).map(({slug,name,location})=>({slug,name,location}));
  const reference=JSON.parse(fs.readFileSync('data/bgo-reference.geojson','utf8'));
  const published=JSON.parse(fs.readFileSync('data/toses.geojson','utf8'));
  const basemaps=B.settings(JSON.parse(fs.readFileSync('data/map-basemaps.json','utf8')));
  const payload={catalog,reference,public:published,basemaps};
  let html=fs.readFileSync('map/index.html','utf8');
  html=html.replace(/<!-- map:options:start -->[\s\S]*?<!-- map:options:end -->/,'<!-- map:options:start -->'+catalog.map(t=>'<option value="'+C.esc(t.slug)+'">'+C.esc(t.name+' · '+t.location)+'</option>').join('')+'<!-- map:options:end -->');
  const safe=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  html=html.replace(/<!-- map:data:start -->[\s\S]*?<!-- map:data:end -->/,'<!-- map:data:start --><script type="application/json" id="territory-map-data">'+safe+'</script><!-- map:data:end -->');
  for(const file of ['assets/vendor/leaflet/leaflet.css','assets/vendor/leaflet/leaflet.js','assets/css/territory-map.css','assets/js/territory-map-core.js','assets/js/territory-map-basemaps.js','assets/js/territory-map.js']){
    const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12),escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html=html.replace(new RegExp('(["\'])/'+escaped+'(?:\\?v=[a-f0-9]+)?(["\'])','g'),'$1/'+file+'?v='+hash+'$2');
  }
  fs.writeFileSync('map/index.html',html);
  const svg=C.svg({type:'FeatureCollection',features:[]},reference.features[0].geometry).replace(/Рабочая схема территорий ТОС БГО/g,'Картографический контур Борисоглебского городского округа').replace('ТОС БГО · Рабочая схема территорий','ТОС БГО · Борисоглебский городской округ').replace('Разметка автора. Не является официальной границей или подтверждением свободной территории.','Картографический ориентир по OpenStreetMap. Не является официальной юридической границей.');
  fs.writeFileSync('assets/img/bgo-reference.svg',svg+'\n');
  console.log('Territory map generated: '+catalog.length+' catalog entries; '+published.features.length+' verified geometries; OSM reference '+reference.features[0].properties.osm_relation_id);
}
if(require.main===module)generate();module.exports={generate};
