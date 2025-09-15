// Простой фронтенд без сборки: загрузка JSON и отрисовка
const App = {
  async loadJSON(path){
    const r = await fetch(path + '?v=' + Date.now());
    return await r.json();
  },

  // Главная — ближайшие события / последние новости
  async renderUpcoming(elId){
    const el = document.getElementById(elId);
    const events = await this.loadJSON('data/events.json');
    const items = events
      .sort((a,b)=> new Date(a.date) - new Date(b.date))
      .slice(0,3)
      .map(e=>`
        <div class="card">
          <div class="meta">${new Date(e.date).toLocaleDateString('ru-RU')} • ${e.tos_name}</div>
          <h3>${e.title}</h3>
          <p>${e.summary}</p>
        </div>
      `).join('');
    el.innerHTML = items || '<div class="muted">Событий пока нет</div>';
  },

  async renderLatestNews(elId, limit=4){
    const el = document.getElementById(elId);
    const news = await this.loadJSON('data/news.json');
    const items = news
      .sort((a,b)=> new Date(b.date) - new Date(a.date))
      .slice(0,limit)
      .map(n=>`
        <div class="card">
          <div class="meta">${new Date(n.date).toLocaleDateString('ru-RU')} • ${n.tos_name || 'ТОС'}</div>
          <h3><a href="${n.link || '#'}">${n.title}</a></h3>
          <p>${n.summary}</p>
        </div>
      `).join('');
    el.innerHTML = items || '<div class="muted">Новостей пока нет</div>';
  },

  // Список ТОС
  async renderTosList(elId, q=''){
    const el = document.getElementById(elId);
    const list = await this.loadJSON('data/tos.json');
    const query = q.trim().toLowerCase();
    const filtered = list.filter(x=>{
      const hay = (x.name + ' ' + (x.area||'') + ' ' + (x.streets||[]).join(' ')).toLowerCase();
      return hay.includes(query);
    });
    el.innerHTML = (filtered.length? filtered: list).map(t=>`
      <div class="card">
        <div class="meta">${t.district || 'БГО'}</div>
        <h3><a href="tos.html?id=${encodeURIComponent(t.id)}">${t.name}</a></h3>
        <p>${t.about || ''}</p>
        <p class="meta">Председатель: ${t.chair || '—'} • Тел.: ${t.phone || '—'}</p>
      </div>
    `).join('');
  },

  // Карточка конкретного ТОС
  async renderTosCard(elId){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const list = await this.loadJSON('data/tos.json');
    const t = list.find(x=>x.id===id) || list[0];
    const el = document.getElementById(elId);
    el.innerHTML = `
      <div class="tos-header">
        <h1 class="tos-name">${t.name}</h1>
        <span class="badge">${t.district || 'БГО'}</span>
      </div>
      <p>${t.about || ''}</p>
      <ul class="doc-list">
        <li><strong>Контакты:</strong> ${t.phone || '—'} • <a href="mailto:${t.email||''}">${t.email||''}</a> ${t.vk? '• <a target="_blank" href="'+t.vk+'">VK</a>':''}</li>
        <li><strong>Адрес штаба:</strong> ${t.address || '—'}</li>
        <li><strong>Улицы/территория:</strong> ${(t.streets||[]).join(', ') || '—'}</li>
      </ul>
      <div class="right"><a class="btn btn-small" href="map.html#${t.id}">Показать на карте</a></div>
    `;
    sessionStorage.setItem('current_tos_id', t.id);
    sessionStorage.setItem('current_tos_name', t.name);
    document.title = t.name + ' | ТОС Борисоглебский ГО';
  },

  async renderTosNews(elId){
    const el = document.getElementById(elId);
    const cur = sessionStorage.getItem('current_tos_id');
    const curName = sessionStorage.getItem('current_tos_name');
    const news = await this.loadJSON('data/news.json');
    const items = news.filter(n=> (n.tos_id===cur || (!n.tos_id && n.tos_name===curName)));
    el.innerHTML = items.length? items.map(n=>`
      <div class="card">
        <div class="meta">${new Date(n.date).toLocaleDateString('ru-RU')}</div>
        <h3>${n.title}</h3>
        <p>${n.summary}</p>
      </div>
    `).join('') : '<div class="muted">Пока нет новостей конкретно для этого ТОС</div>';
  },

  async renderTosDocs(elId){
    const el = document.getElementById(elId);
    const cur = sessionStorage.getItem('current_tos_id');
    const docs = await this.loadJSON('data/docs.json');
    const items = docs.filter(d=> d.tos_id===cur || d.tos_id==='all');
    el.innerHTML = items.length? items.map(d=>`
      <li>
        <strong>${d.title}</strong><br/>
        <span class="meta">${d.description||''}</span><br/>
        <a href="${d.path}" target="_blank" rel="noopener">Открыть</a>
      </li>
    `).join('') : '<li class="muted">Документов пока нет</li>';
  },

  // Новости общий список
  async renderNews(elId){
    const el = document.getElementById(elId);
    const news = await this.loadJSON('data/news.json');
    el.innerHTML = news
      .sort((a,b)=> new Date(b.date)-new Date(a.date))
      .map(n=>`
        <div class="card">
          <div class="meta">${new Date(n.date).toLocaleDateString('ru-RU')} • ${n.tos_name || 'ТОС'}</div>
          <h3>${n.title}</h3>
          <p>${n.summary}</p>
          ${n.link? `<a href="${n.link}" target="_blank" rel="noopener">Подробнее</a>`:''}
        </div>
      `).join('');
  },

  // Карта
  async renderMap(elId){
    const map = L.map(elId).setView([51.367, 42.083], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    const list = await this.loadJSON('data/tos.json');
    list.forEach(t=>{
      if(t.center){
        const m = L.marker(t.center).addTo(map);
        m.bindPopup(`<b>${t.name}</b><br/>${t.address || ''}<br/><a href="tos.html?id=${encodeURIComponent(t.id)}">Открыть карточку</a>`);
      }
      if(t.polygon){
        const poly = L.polygon(t.polygon, {weight:2, fillOpacity:0.07}).addTo(map);
        poly.bindPopup(`<b>${t.name}</b>`);
      }
    });
    const hash = location.hash.replace('#','');
    if(hash){
      const t = list.find(x=>x.id===hash);
      if(t && t.center){ map.setView(t.center, 14); }
    }
  }
};
