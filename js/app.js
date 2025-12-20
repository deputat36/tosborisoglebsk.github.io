(function () {
  // ===== Utils
  function byId(id) { return document.getElementById(id); }

  function normalizeLinks(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    // если в JSON это строка со ссылками через пробел/запятую/перенос
    return String(raw)
      .split(/[\s,;]+/g)
      .map(s => s.trim())
      .filter(s => s && (s.startsWith("http://") || s.startsWith("https://")));
  }

  function safe(v, fallback = "—") {
    const s = (v === null || v === undefined) ? "" : String(v).trim();
    return s ? s : fallback;
  }

  // ===== Theme
  function initTheme() {
    const themeBtn = byId("themeBtn");
    const saved = localStorage.getItem("theme");
    if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");

    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (isDark) {
          document.documentElement.removeAttribute("data-theme");
          localStorage.setItem("theme", "light");
        } else {
          document.documentElement.setAttribute("data-theme", "dark");
          localStorage.setItem("theme", "dark");
        }
      });
    }
  }

  // ===== Mobile nav
  function initMobileNav() {
    const burger = byId("burgerBtn");
    const nav = byId("topNav");
    if (!burger || !nav) return;

    burger.addEventListener("click", () => {
      nav.classList.toggle("open");
    });

    // закрываем меню при клике по пункту
    nav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => nav.classList.remove("open"));
    });
  }

  // ===== Footer year
  function setYear() {
    const y = byId("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  // ===== Catalog
  async function initCatalog() {
    const container = byId("toses-container");
    if (!container) return;

    const search = byId("tosSearch");
    const clear = byId("clearSearch");
    const count = byId("tosCount");

    // ВАЖНО:
    // Пока демо: data/toses_demo.json
    // Потом просто заменишь на data/toses.json — и всё.
    const DATA_URL = "data/toses_demo.json";

    let items = [];
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      items = await res.json();
    } catch (e) {
      container.innerHTML = `<div class="card"><h3>Не удалось загрузить каталог</h3><p class="small">Проверь файл ${DATA_URL} и путь.</p></div>`;
      return;
    }

    function matches(tos, q) {
      if (!q) return true;
      const hay = [
        tos.name,
        tos.location,
        tos.chairperson,
        tos.contacts,
        tos.boundaries,
        tos.description
      ].map(v => (v ? String(v).toLowerCase() : "")).join(" ");
      return hay.includes(q);
    }

    function render(list) {
      container.innerHTML = "";
      if (count) count.textContent = String(list.length);

      if (!list.length) {
        container.innerHTML = `<div class="card"><h3>Ничего не найдено</h3><p class="small">Попробуй изменить запрос поиска.</p></div>`;
        return;
      }

      list.forEach((tos) => {
        const links = normalizeLinks(tos.social_links);
        const firstLetters = safe(tos.name, "ТОС")
          .replace(/ТОС/gi, "")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(w => w[0] ? w[0].toUpperCase() : "")
          .join("") || "ТОС";

        const slug = tos.slug ? String(tos.slug).trim() : "";

        // Если позже будут отдельные страницы:
        // const url = slug ? `tos-${slug}.html` : "#";
        // Пока оставляем #, либо можешь включить строку выше.
        const url = slug ? `tos-${slug}.html` : "#";

        const card = document.createElement("article");
        card.className = "card";
        card.innerHTML = `
          <div class="card-top">
            <div class="logo" aria-hidden="true"><span>${firstLetters}</span></div>
            <div>
              <h3>${safe(tos.name)}</h3>
              <div class="meta">${safe(tos.location)} • основан: ${safe(tos.founded)}</div>
            </div>
          </div>

          <p>${safe(tos.description, "Описание пока не добавлено.")}</p>

          <p class="small">
            <strong>Председатель:</strong> ${safe(tos.chairperson)}<br/>
            <strong>Контакты:</strong> ${safe(tos.contacts)}<br/>
            <strong>Границы:</strong> ${safe(tos.boundaries)}
          </p>

          <div class="card-bottom">
            <div class="links">
              ${tos.population ? `<span class="tag">Жителей: ${tos.population}</span>` : `<span class="tag">ТОС</span>`}
              ${links.length ? `<span class="tag">Соцсети: ${links.length}</span>` : `<span class="tag">Без ссылок</span>`}
            </div>
            <a class="more" href="${url}">Подробнее</a>
          </div>
        `;
        container.appendChild(card);
      });
    }

    render(items);

    function applySearch() {
      const q = (search && search.value ? search.value.trim().toLowerCase() : "");
      const filtered = items.filter(t => matches(t, q));
      render(filtered);
    }

    if (search) {
      search.addEventListener("input", applySearch);
    }
    if (clear) {
      clear.addEventListener("click", () => {
        if (search) search.value = "";
        render(items);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNav();
    setYear();
    initCatalog();
  });
})();
