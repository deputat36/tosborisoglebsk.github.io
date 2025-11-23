async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) return [];
  try {
    return await res.json();
  } catch {
    return [];
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// INDEX: load stats + samples
async function initIndexPage() {
  const tosList = await loadJSON("data/toses.json");
  const news = await loadJSON("data/news.json");
  const articles = await loadJSON("data/articles.json");

  // Stats
  const tosCountEl = document.querySelector("[data-stat='tos-count']");
  const activeCountEl = document.querySelector("[data-stat='tos-active']");
  const cityCountEl = document.querySelector("[data-stat='tos-city']");
  if (tosCountEl) tosCountEl.textContent = tosList.length.toString();
  if (activeCountEl) {
    const active = tosList.filter(x => (x.status || '').toLowerCase() === 'активен').length;
    activeCountEl.textContent = active.toString();
  }
  if (cityCountEl) {
    const city = tosList.filter(x => (x.locality || '').toLowerCase().includes("борисоглеб")).length;
    cityCountEl.textContent = city.toString();
  }

  // Hero list: few ТОСов
  const heroList = document.querySelector("[data-hero-tos]");
  if (heroList && tosList.length) {
    heroList.innerHTML = "";
    tosList.slice(0, 5).forEach(t => {
      const li = document.createElement("li");
      li.className = "hero-list-item";
      li.innerHTML = `
        <div class="hero-list-main">
          <div class="hero-list-name">${t.name || "ТОС"}</div>
          <div class="hero-list-meta">${t.locality || ""}</div>
        </div>
        <div class="hero-list-tag">Активен</div>
      `;
      heroList.appendChild(li);
    });
  }

  // Latest news/articles
  const newsWrap = document.querySelector("[data-grid='news']");
  if (newsWrap && news.length) {
    newsWrap.innerHTML = "";
    news.slice(0, 3).forEach(n => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">${n.title}</div>
            <div class="card-body">${n.excerpt}</div>
          </div>
          <span class="card-pill">${n.category || "Новости"}</span>
        </div>
        <div class="card-meta">
          <span>${formatDate(n.date)}</span>
          <a href="article.html?type=news&slug=${encodeURIComponent(n.slug)}">Читать</a>
        </div>
      `;
      newsWrap.appendChild(card);
    });
  }

  const artWrap = document.querySelector("[data-grid='articles']");
  if (artWrap && articles.length) {
    artWrap.innerHTML = "";
    articles.slice(0, 3).forEach(a => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">${a.title}</div>
            <div class="card-body">${a.excerpt}</div>
          </div>
          <span class="card-pill">${a.category || "Материал"}</span>
        </div>
        <div class="card-meta">
          <span>${formatDate(a.date)}</span>
          <a href="article.html?type=article&slug=${encodeURIComponent(a.slug)}">Читать</a>
        </div>
      `;
      artWrap.appendChild(card);
    });
  }
}

// TOSES: список ТОСов
async function initTosesPage() {
  const data = await loadJSON("data/toses.json");
  const listEl = document.querySelector("[data-grid='toses']");
  const qInput = document.querySelector("#search");
  const statusSelect = document.querySelector("#status-filter");

  function render() {
    if (!listEl) return;
    const q = (qInput?.value || "").toLowerCase();
    const status = statusSelect?.value || "";
    listEl.innerHTML = "";

    let items = data.slice();
    if (status) {
      items = items.filter(x => (x.status || "").toLowerCase() === status.toLowerCase());
    }
    if (q) {
      items = items.filter(x => 
        (x.name || "").toLowerCase().includes(q) ||
        (x.locality || "").toLowerCase().includes(q) ||
        (x.chair || "").toLowerCase().includes(q)
      );
    }

    items.forEach(t => {
      const statusLabel = t.status || "Активен";
      const statusClass = statusLabel === "Активен" ? "badge badge-success" : "badge badge-muted";
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">${t.name || "ТОС"}</div>
            <div class="card-body">
              ${t.locality ? `<div><strong>Территория:</strong> ${t.locality}</div>` : ""}
              ${t.boundaries ? `<div>${t.boundaries}</div>` : ""}
            </div>
          </div>
          <span class="${statusClass}">${statusLabel}</span>
        </div>
        <div class="card-meta">
          <span>${t.chair ? "Председатель: " + t.chair : ""}</span>
          <a href="tos.html?slug=${encodeURIComponent(t.slug || "")}">Карточка ТОС</a>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  if (qInput) qInput.addEventListener("input", render);
  if (statusSelect) statusSelect.addEventListener("change", render);
  render();
}

// Страница ТОС
async function initTosPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const data = await loadJSON("data/toses.json");
  const tos = data.find(x => (x.slug || "") === slug) || null;
  const wrap = document.querySelector("[data-block='tos']");
  if (!wrap) return;

  if (!tos) {
    wrap.innerHTML = "<p>ТОС не найден. Вернитесь к <a href='toses.html'>каталогу</a>.</p>";
    return;
  }

  wrap.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">ТОС «${tos.name || ""}»</div>
          <div class="card-body">${tos.desc || ""}</div>
        </div>
        <span class="badge ${((tos.status || "") === "Активен") ? "badge-success" : "badge-muted"}">${tos.status || "Активен"}</span>
      </div>
      <div class="card-body">
        ${tos.locality ? `<p><strong>Населенный пункт / микрорайон:</strong> ${tos.locality}</p>` : ""}
        ${tos.boundaries ? `<p><strong>Границы ТОС:</strong> ${tos.boundaries}</p>` : ""}
        ${tos.chair ? `<p><strong>Председатель:</strong> ${tos.chair}</p>` : ""}
        ${tos.phone ? `<p><strong>Телефон:</strong> ${tos.phone}</p>` : ""}
        ${tos.email ? `<p><strong>E-mail:</strong> ${tos.email}</p>` : ""}
        ${tos.address ? `<p><strong>Адрес места нахождения:</strong> ${tos.address}</p>` : ""}
        ${tos.docs ? `<p><strong>Основание (решение, дата):</strong> ${tos.docs}</p>` : ""}
        ${tos.reg_date ? `<p><strong>Дата регистрации:</strong> ${formatDate(tos.reg_date)}</p>` : ""}
        ${tos.site ? `<p><strong>Страница ТОС:</strong> <a href="${tos.site}" target="_blank" rel="noopener">${tos.site}</a></p>` : ""}
        ${tos.notes ? `<p><strong>Примечания:</strong> ${tos.notes}</p>` : ""}
      </div>
    </div>
  `;

  // SEO: подправим title
  document.title = `ТОС «${tos.name || ""}» — Борисоглебский городской округ`;
}

// Новости / материалы список
async function initNewsPage() {
  const news = await loadJSON("data/news.json");
  const articles = await loadJSON("data/articles.json");
  const listEl = document.querySelector("[data-grid='news-list']");
  if (!listEl) return;
  listEl.innerHTML = "";

  const items = [...news, ...articles].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  items.forEach(item => {
    const type = news.includes(item) ? "news" : "article";
    const badgeLabel = type === "news" ? "Новость" : "Материал";
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${item.title}</div>
          <div class="card-body">${item.excerpt}</div>
        </div>
        <span class="card-pill">${item.category || badgeLabel}</span>
      </div>
      <div class="card-meta">
        <span>${formatDate(item.date)}</span>
        <a href="article.html?type=${type}&slug=${encodeURIComponent(item.slug)}">Читать полностью</a>
      </div>
    `;
    listEl.appendChild(card);
  });
}

// Страница статьи/новости
async function initArticlePage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const type = params.get("type") || "news";

  const news = await loadJSON("data/news.json");
  const articles = await loadJSON("data/articles.json");
  const src = type === "article" ? articles : news;
  const item = src.find(x => x.slug === slug);
  const wrap = document.querySelector("[data-block='article']");
  if (!wrap) return;

  if (!item) {
    wrap.innerHTML = "<p>Материал не найден. Вернитесь к <a href='news.html'>списку новостей</a>.</p>";
    return;
  }

  wrap.innerHTML = `
    <article class="card">
      <div class="card-header">
        <div>
          <h1 class="card-title">${item.title}</h1>
          <div class="card-body">${item.excerpt || ""}</div>
        </div>
        <span class="card-pill">${item.category || ""}</span>
      </div>
      <div class="card-meta" style="margin-bottom:10px;">
        <span>${formatDate(item.date)}</span>
        <span>${(item.tags || []).join(" • ")}</span>
      </div>
      <div class="card-body" style="white-space:pre-line; font-size:13px;">
        ${item.content || ""}
      </div>
    </article>
  `;

  document.title = `${item.title} — ТОС Борисоглебск`;
}

// Документы
async function initDocsPage() {
  const docs = await loadJSON("data/docs.json");
  const listEl = document.querySelector("[data-grid='docs']");
  if (!listEl) return;
  listEl.innerHTML = "";

  docs.forEach(doc => {
    const badge = doc.type === "external" ? "Внешний ресурс" : "Файл на сайте";
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${doc.title}</div>
        <span class="card-pill">${doc.category || "Документ"}</span>
      </div>
      <div class="card-body">
        ${doc.source ? `<div>Источник: ${doc.source}</div>` : ""}
      </div>
      <div class="card-meta">
        <span>${badge}</span>
        <a href="${doc.url}" target="_blank" rel="noopener">Открыть</a>
      </div>
    `;
    listEl.appendChild(card);
  });
}

// Отметка активного пункта меню
function highlightActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(link => {
    const page = link.getAttribute("data-nav");
    if ((page === "index" && path === "index.html") ||
        (page !== "index" && path.startsWith(page))) {
      link.classList.add("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNav();
  const body = document.body;
  const page = body.getAttribute("data-page");
  if (page === "index") initIndexPage();
  if (page === "toses") initTosesPage();
  if (page === "tos") initTosPage();
  if (page === "news") initNewsPage();
  if (page === "article") initArticlePage();
  if (page === "docs") initDocsPage();
});
