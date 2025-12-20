(function(){
  "use strict";

  // ---------- utils ----------
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function clampText(s, n){
    s = String(s ?? "").trim();
    if(!s) return "";
    return s.length > n ? s.slice(0, n-1).trim() + "…" : s;
  }
  function formatDateISO(iso){
    if(!iso) return "";
    // iso: YYYY-MM-DD
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return iso;
    const y = +m[1], mo = +m[2]-1, d = +m[3];
    const dt = new Date(Date.UTC(y, mo, d));
    return dt.toLocaleDateString("ru-RU", { year:"numeric", month:"long", day:"numeric" });
  }
  function getPageName(){ return document.body.getAttribute("data-page") || ""; }

  function parseTokens(str){
    // Extract phones, emails, urls from a messy string.
    const s = String(str ?? "");
    const urls = Array.from(s.matchAll(/https?:\/\/[^\s]+/g)).map(m=>m[0]);
    const emails = Array.from(s.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map(m=>m[0]);
    // phone-like: keep +, digits, (), spaces, -
    const phones = Array.from(s.matchAll(/(?:\+7|7|8)\s*[\(\-]?\s*\d{3}[\)\-]?\s*\d{3}[\-\s]?\d{2}[\-\s]?\d{2}/g))
      .map(m=>m[0]);
    const rest = s
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .replace(/(?:\+7|7|8)\s*[\(\-]?\s*\d{3}[\)\-]?\s*\d{3}[\-\s]?\d{2}[\-\s]?\d{2}/g, "")
      .replace(/\s{2,}/g, " ").trim();

    return { urls, emails, phones, rest };
  }

  function normalizePhone(p){
    // Convert to tel:+7XXXXXXXXXX if possible
    const digits = String(p).replace(/\D/g,"");
    if(digits.length === 11){
      if(digits.startsWith("8")) return "+7" + digits.slice(1);
      if(digits.startsWith("7")) return "+7" + digits.slice(1);
    }
    if(digits.length === 10) return "+7" + digits;
    return p;
  }

  function hashHue(str){
    let h = 0;
    for (let i=0;i<str.length;i++) h = (h*31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function logoHTML(name, id){
    const initials = String(name || "").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase();
    const hue = hashHue(String(id || name || "tos"));
    const style = "background: linear-gradient(135deg, hsla("+hue+",85%,58%,.88), hsla("+(hue+70)%360+",85%,52%,.70));";
    return '<div class="logo" style="'+style+'" aria-hidden="true">'+esc(initials || "ТО")+'</div>';
  }

  function setMetaDynamic(title, description){
    if(title) document.title = title;
    if(description){
      const m = qs('meta[name="description"]');
      if(m) m.setAttribute("content", description);
      const ogd = qs('meta[property="og:description"]');
      if(ogd) ogd.setAttribute("content", description);
    }
    const ogt = qs('meta[property="og:title"]');
    if(ogt && title) ogt.setAttribute("content", title);
  }

  // ---------- theme ----------
  function initTheme(){
    const root = document.documentElement;
    const saved = localStorage.getItem("tos_theme");
    if(saved === "light" || saved === "dark"){
      root.setAttribute("data-theme", saved);
    }else{
      const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      root.setAttribute("data-theme", prefersLight ? "light" : "dark");
    }
    const btn = qs('[data-action="theme"]');
    if(btn){
      btn.addEventListener("click", ()=>{
        const cur = root.getAttribute("data-theme") || "dark";
        const next = cur === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("tos_theme", next);
        btn.setAttribute("aria-label", next === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему");
      });
    }
  }

  // ---------- header menu (mobile) ----------
  function initMenu(){
    const menuBtn = qs('[data-action="menu"]');
    const nav = qs("#site-nav");
    if(!menuBtn || !nav) return;
    menuBtn.addEventListener("click", ()=>{
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e)=>{
      if(!nav.classList.contains("open")) return;
      const t = e.target;
      if(nav.contains(t) || menuBtn.contains(t)) return;
      nav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape" && nav.classList.contains("open")){
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.focus();
      }
    });
  }

  // ---------- active nav ----------
  function initActiveNav(){
    const path = location.pathname.replace(/\/index\.html$/, "/");
    qsa('.nav a').forEach(a=>{
      const href = a.getAttribute("href") || "";
      // normalize
      const aUrl = new URL(href, location.href);
      const aPath = aUrl.pathname.replace(/\/index\.html$/, "/");
      if(aPath === path){
        a.setAttribute("aria-current","page");
      }else{
        a.removeAttribute("aria-current");
      }
    });
  }

  // ---------- page: home KPIs ----------
  function initHome(){
    const elTos = qs("[data-kpi='tos']");
    const elPeople = qs("[data-kpi='people']");
    if(window.DATA && Array.isArray(window.DATA.tos)){
      if(elTos) elTos.textContent = String(window.DATA.tos.length);
      if(elPeople){
        const sum = window.DATA.tos.reduce((acc, t)=> acc + (Number(t.residents)||0), 0);
        elPeople.textContent = sum ? String(sum) : "—";
      }
    }
  }

  // ---------- page: tos list ----------
  function initTosList(){
    const list = qs("#tos-list");
    const q = qs("#tos-q");
    const selPlace = qs("#tos-place");
    const selType = qs("#tos-type");
    const counter = qs("#tos-counter");

    const data = (window.DATA && Array.isArray(window.DATA.tos)) ? window.DATA.tos.slice() : [];
    const places = Array.from(new Set(data.map(x=> String(x.place||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ru"));
    places.forEach(p=>{
      const opt = document.createElement("option");
      opt.value = p; opt.textContent = p;
      selPlace.appendChild(opt);
    });

    function matches(item, query, place, type){
      const text = [
        item.name, item.place, item.boundaries, item.chair, item.contacts, item.social_links, item.description
      ].join(" ").toLowerCase();

      const okQ = !query || text.includes(query);
      const okP = !place || String(item.place||"") === place;
      const okT = !type || String(item.type||"") === type;
      return okQ && okP && okT;
    }

    function render(){
      const query = String(q.value||"").trim().toLowerCase();
      const place = selPlace.value;
      const type = selType.value;

      const filtered = data.filter(x=>matches(x, query, place, type));
      if(counter) counter.textContent = String(filtered.length);

      list.innerHTML = filtered.map(item=>{
        const href = "view.html?id=" + encodeURIComponent(item.id);
        const badges = []
          .concat(item.place ? ['<span class="badge">'+esc(item.place)+'</span>'] : [])
          .concat(item.type ? ['<span class="badge">'+esc(item.type)+'</span>'] : [])
          .concat(item.founded ? ['<span class="badge">с '+esc(item.founded)+'</span>'] : []);
        const meta = [];
        if(item.residents) meta.push("жителей: " + esc(item.residents));
        if(item.chair) meta.push("председатель: " + esc(item.chair));
        return (
          '<a class="item" href="'+href+'">' +
            '<div class="item-top">' +
              '<div>' +
                '<div class="badges">'+badges.join("")+'</div>' +
                '<h3>'+esc(item.name)+'</h3>' +
                '<p>'+esc(clampText(item.description || item.boundaries || "", 140))+'</p>' +
              '</div>' +
              logoHTML(item.name, item.id) +
            '</div>' +
            '<div class="meta">'+meta.map(x=>'<span>'+x+'</span>').join("")+'</div>' +
          '</a>'
        );
      }).join("");

      if(!filtered.length){
        list.innerHTML = '<div class="notice">Ничего не найдено. Попробуйте изменить запрос или фильтры.</div>';
      }
    }

    // type options
    // (без выдуманных фактов: типы заполняются вручную в data/tos.data.js)
    const types = Array.from(new Set(data.map(x=>String(x.type||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ru"));
    if(types.length){
      types.forEach(t=>{
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        selType.appendChild(opt);
      });
    }

    // initial from URL params
    const sp = new URLSearchParams(location.search);
    if(sp.get("q")) q.value = sp.get("q");
    if(sp.get("place")) selPlace.value = sp.get("place");
    if(sp.get("type")) selType.value = sp.get("type");

    function syncURL(){
      const p = new URLSearchParams();
      if(q.value.trim()) p.set("q", q.value.trim());
      if(selPlace.value) p.set("place", selPlace.value);
      if(selType.value) p.set("type", selType.value);
      const url = location.pathname + (p.toString() ? ("?"+p.toString()) : "");
      history.replaceState({}, "", url);
    }

    [q, selPlace, selType].forEach(el=>{
      el.addEventListener("input", ()=>{ syncURL(); render(); });
      el.addEventListener("change", ()=>{ syncURL(); render(); });
    });

    render();
  }

  // ---------- page: tos view ----------
  function initTosView(){
    const root = qs("#tos-view");
    const sp = new URLSearchParams(location.search);
    const id = sp.get("id");
    const data = (window.DATA && Array.isArray(window.DATA.tos)) ? window.DATA.tos : [];
    const item = data.find(x=>String(x.id)===String(id));

    if(!item){
      root.innerHTML = '<div class="notice">Карточка ТОС не найдена. Вернитесь в <a class="underline" href="index.html">каталог</a>.</div>';
      setMetaDynamic("ТОС не найден — ТОС БГО", "Карточка не найдена. Проверьте ссылку или откройте каталог.");
      return;
    }

    const c = parseTokens(item.contacts);
    const l = parseTokens(item.social_links);

    function linksBlock(tokens){
      const parts = [];
      tokens.phones.forEach(p=>{
        const norm = normalizePhone(p);
        parts.push('<li><a class="underline" href="tel:'+esc(norm)+'">'+esc(p)+'</a></li>');
      });
      tokens.emails.forEach(e=>{
        parts.push('<li><a class="underline" href="mailto:'+esc(e)+'">'+esc(e)+'</a></li>');
      });
      tokens.urls.forEach(u=>{
        parts.push('<li><a class="underline" href="'+esc(u)+'" target="_blank" rel="noopener">Открыть ссылку</a> <small>('+esc(u)+')</small></li>');
      });
      if(tokens.rest) parts.push('<li><span>'+esc(tokens.rest)+'</span></li>');
      return parts.length ? ('<ul>'+parts.join("")+'</ul>') : '<div class="notice">Контакты не указаны.</div>';
    }

    const title = "ТОС «"+item.name+"» — ТОС БГО";
    const desc = clampText(item.description || ("ТОС "+item.name+" ("+item.place+")"), 155);
    setMetaDynamic(title, desc);

    root.innerHTML = (
      '<div class="card"><div class="card-inner">' +
        '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px;">' +
          '<div class="prose">' +
            '<h1 style="margin:0 0 8px;">ТОС «'+esc(item.name)+'»</h1>' +
            '<p style="margin:0; color:var(--muted);">'+esc(item.place || "")+'</p>' +
          '</div>' +
          logoHTML(item.name, item.id) +
        '</div>' +

        '<hr class="sep"/>' +

        '<div class="kpi" style="margin-bottom:12px;">' +
          '<div class="tile"><b>'+esc(item.residents || "—")+'</b><span>примерно жителей</span></div>' +
          '<div class="tile"><b>'+esc(item.founded || "—")+'</b><span>год создания</span></div>' +
          '<div class="tile"><b>'+esc(item.type || "—")+'</b><span>тип (заполняется вручную)</span></div>' +
        '</div>' +

        (item.boundaries ? ('<div class="notice"><b style="color:var(--text)">Границы</b><br>'+esc(item.boundaries)+'</div>') : '') +

        (item.description ? ('<div class="prose"><h2>Описание</h2><p>'+esc(item.description)+'</p></div>') : '') +

        '<div class="prose">' +
          '<h2>Председатель</h2>' +
          (item.chair ? ('<p>'+esc(item.chair)+'</p>') : '<div class="notice">Не указано.</div>') +
          '<h2>Контакты председателя</h2>' +
          linksBlock(c) +
          '<h2>Ссылки на сообщества ТОС</h2>' +
          linksBlock(l) +
        '</div>' +

        '<hr class="sep"/>' +

        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<a class="btn" href="index.html">← В каталог</a>' +
          '<button class="btn primary" type="button" data-action="copylink">Скопировать ссылку</button>' +
        '</div>' +
      '</div></div>'
    );

    const copyBtn = qs('[data-action="copylink"]');
    if(copyBtn){
      copyBtn.addEventListener("click", async ()=>{
        try{
          await navigator.clipboard.writeText(location.href);
          copyBtn.textContent = "Ссылка скопирована";
          setTimeout(()=>copyBtn.textContent="Скопировать ссылку", 1400);
        }catch(e){
          alert("Не удалось скопировать. Можно выделить адрес в строке браузера и скопировать вручную.");
        }
      });
    }
  }

  // ---------- page: news list ----------
  function initNewsList(){
    const list = qs("#news-list");
    const q = qs("#news-q");
    const selType = qs("#news-type");
    const counter = qs("#news-counter");

    const data = (window.DATA && Array.isArray(window.DATA.news)) ? window.DATA.news.slice() : [];
    data.sort((a,b)=> String(b.date||"").localeCompare(String(a.date||"")));

    const types = Array.from(new Set(data.map(x=>String(x.type||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ru"));
    types.forEach(t=>{
      const opt = document.createElement("option");
      opt.value = t; opt.textContent = (t==="news" ? "Новости" : (t==="announcement" ? "Анонсы" : t));
      selType.appendChild(opt);
    });

    function render(){
      const query = String(q.value||"").trim().toLowerCase();
      const type = selType.value;

      const filtered = data.filter(item=>{
        const text = [item.title, item.excerpt, item.source_name].join(" ").toLowerCase();
        const okQ = !query || text.includes(query);
        const okT = !type || String(item.type||"")===type;
        return okQ && okT;
      });

      if(counter) counter.textContent = String(filtered.length);

      list.innerHTML = filtered.map(item=>{
        const href = "view.html?slug=" + encodeURIComponent(item.slug);
        const badge = item.type ? '<span class="badge">'+esc(item.type==="news"?"Новость":(item.type==="announcement"?"Анонс":item.type))+'</span>' : '';
        const src = item.source_url ? ('<a class="underline" href="'+esc(item.source_url)+'" target="_blank" rel="noopener">источник</a>') : (item.source_name ? esc(item.source_name) : "");
        return (
          '<a class="item" href="'+href+'">' +
            '<div class="item-top">' +
              '<div>' +
                '<div class="badges">'+badge+(item.date?('<span class="badge">'+esc(formatDateISO(item.date))+'</span>'):"")+'</div>' +
                '<h3>'+esc(item.title)+'</h3>' +
                '<p>'+esc(clampText(item.excerpt || "", 160))+'</p>' +
              '</div>' +
              '<div class="logo" aria-hidden="true">N</div>' +
            '</div>' +
            '<div class="meta">'+(src?('<span>'+src+'</span>'):"")+'</div>' +
          '</a>'
        );
      }).join("");

      if(!filtered.length){
        list.innerHTML = '<div class="notice">Пока ничего нет по выбранным условиям.</div>';
      }
    }

    const sp = new URLSearchParams(location.search);
    if(sp.get("q")) q.value = sp.get("q");
    if(sp.get("type")) selType.value = sp.get("type");

    function syncURL(){
      const p = new URLSearchParams();
      if(q.value.trim()) p.set("q", q.value.trim());
      if(selType.value) p.set("type", selType.value);
      history.replaceState({}, "", location.pathname + (p.toString()?("?"+p.toString()):""));
    }

    [q, selType].forEach(el=>{
      el.addEventListener("input", ()=>{ syncURL(); render(); });
      el.addEventListener("change", ()=>{ syncURL(); render(); });
    });

    render();
  }

  // ---------- page: news view ----------
  function initNewsView(){
    const root = qs("#news-view");
    const sp = new URLSearchParams(location.search);
    const slug = sp.get("slug");
    const data = (window.DATA && Array.isArray(window.DATA.news)) ? window.DATA.news : [];
    const item = data.find(x=>String(x.slug)===String(slug));

    if(!item){
      root.innerHTML = '<div class="notice">Запись не найдена. Вернитесь в <a class="underline" href="index.html">ленту</a>.</div>';
      setMetaDynamic("Новость не найдена — ТОС БГО", "Запись не найдена. Проверьте ссылку или откройте ленту новостей.");
      return;
    }

    const title = item.title + " — ТОС БГО";
    const desc = clampText(item.excerpt || "", 155);
    setMetaDynamic(title, desc);

    const src = item.source_url
      ? ('<a class="underline" href="'+esc(item.source_url)+'" target="_blank" rel="noopener">Открыть источник</a>')
      : (item.source_name ? ('<span>'+esc(item.source_name)+'</span>') : '');

    root.innerHTML = (
      '<div class="card"><div class="card-inner">' +
        '<div class="prose">' +
          '<h1>'+esc(item.title)+'</h1>' +
          '<div class="meta" style="margin: 0 0 10px;">' +
            (item.date ? '<span>'+esc(formatDateISO(item.date))+'</span>' : '') +
            (item.type ? '<span>'+esc(item.type==="news"?"Новость":(item.type==="announcement"?"Анонс":item.type))+'</span>' : '') +
            (src ? '<span>'+src+'</span>' : '') +
          '</div>' +
          (item.content_html || "") +
        '</div>' +
        '<hr class="sep"/>' +
        '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
          '<a class="btn" href="index.html">← В ленту</a>' +
          '<button class="btn primary" type="button" data-action="copylink">Скопировать ссылку</button>' +
        '</div>' +
      '</div></div>'
    );

    const copyBtn = qs('[data-action="copylink"]');
    if(copyBtn){
      copyBtn.addEventListener("click", async ()=>{
        try{
          await navigator.clipboard.writeText(location.href);
          copyBtn.textContent = "Ссылка скопирована";
          setTimeout(()=>copyBtn.textContent="Скопировать ссылку", 1400);
        }catch(e){
          alert("Не удалось скопировать. Можно выделить адрес в строке браузера и скопировать вручную.");
        }
      });
    }
  }

  // ---------- page: documents ----------
  function initDocs(){
    const list = qs("#docs-list");
    const q = qs("#docs-q");
    const selKind = qs("#docs-kind");
    const counter = qs("#docs-counter");

    const data = (window.DATA && Array.isArray(window.DATA.docs)) ? window.DATA.docs.slice() : [];
    data.sort((a,b)=> String(b.date||"").localeCompare(String(a.date||"")));

    const kinds = Array.from(new Set(data.map(x=>String(x.kind||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"ru"));
    kinds.forEach(k=>{
      const opt = document.createElement("option");
      opt.value = k; opt.textContent = k;
      selKind.appendChild(opt);
    });

    function render(){
      const query = String(q.value||"").trim().toLowerCase();
      const kind = selKind.value;

      const filtered = data.filter(d=>{
        const text = [d.title, d.description, d.source, d.kind].join(" ").toLowerCase();
        const okQ = !query || text.includes(query);
        const okK = !kind || String(d.kind||"")===kind;
        return okQ && okK;
      });

      if(counter) counter.textContent = String(filtered.length);

      list.innerHTML = filtered.map(d=>{
        return (
          '<div class="item" role="listitem">' +
            '<div class="item-top">' +
              '<div>' +
                '<div class="badges">' +
                  (d.kind ? '<span class="badge">'+esc(d.kind)+'</span>' : '') +
                  (d.date ? '<span class="badge">'+esc(formatDateISO(d.date))+'</span>' : '') +
                '</div>' +
                '<h3 style="margin-top:6px">'+esc(d.title)+'</h3>' +
                '<p>'+esc(clampText(d.description || "", 190))+'</p>' +
              '</div>' +
              '<div class="logo" aria-hidden="true">D</div>' +
            '</div>' +
            '<div class="meta">' +
              (d.source ? '<span>Источник: '+esc(d.source)+'</span>' : '') +
              (d.url ? '<span><a class="underline" href="'+esc(d.url)+'" target="_blank" rel="noopener">Открыть документ</a></span>' : '') +
            '</div>' +
          '</div>'
        );
      }).join("");

      if(!filtered.length){
        list.innerHTML = '<div class="notice">Документы по выбранным условиям не найдены.</div>';
      }
    }

    const sp = new URLSearchParams(location.search);
    if(sp.get("q")) q.value = sp.get("q");
    if(sp.get("kind")) selKind.value = sp.get("kind");

    function syncURL(){
      const p = new URLSearchParams();
      if(q.value.trim()) p.set("q", q.value.trim());
      if(selKind.value) p.set("kind", selKind.value);
      history.replaceState({}, "", location.pathname + (p.toString()?("?"+p.toString()):""));
    }

    [q, selKind].forEach(el=>{
      el.addEventListener("input", ()=>{ syncURL(); render(); });
      el.addEventListener("change", ()=>{ syncURL(); render(); });
    });

    render();
  }

  // ---------- page: map ----------
  function initMap(){
    const box = qs("#map-box");
    const data = (window.DATA && window.DATA.tosGeo) ? window.DATA.tosGeo : null;

    const hasFeatures = data && Array.isArray(data.features) && data.features.length;
    if(!hasFeatures){
      box.innerHTML = (
        '<div class="notice">' +
          '<b style="color:var(--text)">Геоданных пока нет.</b><br>' +
          'Чтобы включить карту с точками/границами, добавьте GeoJSON в файл <code>data/tos.geo.js</code> ' +
          '(FeatureCollection). Для каждой зоны можно хранить polygon или point.<br><br>' +
          '<small>Подсказка: если нет границ, начните с точек (центр микрорайона/населённого пункта), а границы добавите позже.</small>' +
        '</div>'
      );
      return;
    }

    // Progressive enhancement: use Leaflet from CDN (only if online)
    box.innerHTML = '<div class="notice">Загружаю карту…</div>';
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    var script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = function(){
      box.innerHTML = '<div id="leaflet" style="height:560px; border-radius: var(--radius-2); overflow:hidden; border:1px solid var(--border)"></div>';
      // eslint-disable-next-line no-undef
      var map = L.map("leaflet", { scrollWheelZoom: false });
      // eslint-disable-next-line no-undef
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // eslint-disable-next-line no-undef
      var layer = L.geoJSON(data, {
        onEachFeature: function(feature, lyr){
          var p = feature.properties || {};
          var name = p.name ? esc(p.name) : "ТОС";
          var place = p.place ? esc(p.place) : "";
          lyr.bindPopup("<b>"+name+"</b><br>"+place);
        }
      }).addTo(map);

      try{
        map.fitBounds(layer.getBounds().pad(0.2));
      }catch(e){
        map.setView([51.37, 42.08], 10);
      }
    };
    script.onerror = function(){
      box.innerHTML = '<div class="notice">Не удалось загрузить библиотеку карты (нет доступа к CDN). Можно добавить карту позже или использовать внешний embed.</div>';
    };
    document.head.appendChild(script);
  }

  // ---------- init ----------
  function boot(){
    initTheme();
    initMenu();
    initActiveNav();

    const page = getPageName();
    if(page === "home") initHome();
    if(page === "tos-list") initTosList();
    if(page === "tos-view") initTosView();
    if(page === "news-list") initNewsList();
    if(page === "news-view") initNewsView();
    if(page === "docs") initDocs();
    if(page === "map") initMap();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
