(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerritoryMapBasemaps=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function settings(raw={}){
    const key=typeof raw.yandexTilesKey==='string'?raw.yandexTilesKey.trim():'';
    if(key&&!/^[a-zA-Z0-9_-]{16,128}$/.test(key))throw new Error('Укажите публичный ключ пакета Яндекс Tiles API.');
    const defaultProvider=raw.defaultProvider||'osm';
    if(!['osm','yandex'].includes(defaultProvider))throw new Error('Неизвестная подложка карты.');
    if(defaultProvider==='yandex'&&!key)throw new Error('Для подложки Яндекса нужен ключ владельца.');
    return {defaultProvider,yandexTilesKey:key};
  }
  function providers(raw){
    const config=settings(raw),list=[{id:'osm',label:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attribution:'Улицы © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}];
    if(config.yandexTilesKey)list.push({id:'yandex',label:'Яндекс Карты',url:'https://tiles.api-maps.yandex.ru/v1/tiles/?apikey='+encodeURIComponent(config.yandexTilesKey)+'&lang=ru_RU&x={x}&y={y}&z={z}&l=map&projection=web_mercator&maptype=map',maxZoom:20,attribution:'© <a href="https://yandex.ru/maps/" target="_blank" rel="noopener">Открыть в Картах</a> · <a href="https://yandex.ru/legal/maps_termsofuse/" target="_blank" rel="noopener">Условия использования</a>'});
    return list;
  }
  function createLayer(L,provider){
    const options={maxZoom:provider.maxZoom,maxNativeZoom:provider.maxZoom,attribution:provider.attribution,updateWhenIdle:true,keepBuffer:0};
    if(provider.id!=='yandex')return L.tileLayer(provider.url,options);
    // The free key has a provider-wide 30 RPS limit. Spread each browser's
    // visible tile requests at <= 10 RPS; no off-screen seeding or offline packs.
    const Queued=L.TileLayer.extend({
      onAdd(map){this._pending=[];this._byTile=new WeakMap();this._lastRequest=0;this.on('tileunload',this._cancelTile,this);return L.TileLayer.prototype.onAdd.call(this,map);},
      onRemove(map){clearTimeout(this._timer);this._timer=null;this._pending=[];this.off('tileunload',this._cancelTile,this);return L.TileLayer.prototype.onRemove.call(this,map);},
      createTile(coords,done){
        const tile=document.createElement('img');tile.alt='';tile.setAttribute('role','presentation');
        const job={tile,coords,done,cancelled:false};this._byTile.set(tile,job);
        tile.onload=()=>{tile.onload=tile.onerror=null;if(!job.cancelled)done(null,tile);};
        tile.onerror=()=>{tile.onload=tile.onerror=null;if(!job.cancelled)done(new Error('Подложка Яндекса недоступна.'),tile);};
        this._pending.push(job);this._schedule();return tile;
      },
      _cancelTile(event){const job=this._byTile.get(event.tile);if(job){job.cancelled=true;event.tile.onload=event.tile.onerror=null;}},
      _schedule(){if(this._timer||!this._pending.length)return;this._timer=setTimeout(()=>{this._timer=null;this._send();},Math.max(0,100-(Date.now()-this._lastRequest)));},
      _send(){
        if(!this._map){this._pending=[];return;}
        let job;while(this._pending.length){const candidate=this._pending.shift();if(!candidate.cancelled&&candidate.tile.isConnected){job=candidate;break;}}
        if(job){this._lastRequest=Date.now();job.tile.src=this.getTileUrl(job.coords);}
        this._schedule();
      }
    });
    return new Queued(provider.url,options);
  }
  return {settings,providers,createLayer};
});
