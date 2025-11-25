const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'tos_data.json');
const templatePath = path.join(__dirname, '..', 'toses', 'template.html');
const outputDir = path.join(__dirname, '..', 'toses');

const translitMap = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya'
};

function slugify(name) {
  const normalized = name.toLowerCase();
  const transliterated = normalized
    .split('')
    .map((ch) => {
      if (translitMap[ch]) return translitMap[ch];
      if (/[a-z0-9]/.test(ch)) return ch;
      if (ch === ' ' || ch === '-' || ch === '—') return '_';
      return '_';
    })
    .join('');

  const cleaned = transliterated.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.startsWith('tos_') ? cleaned : `tos_${cleaned}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value;
}

function buildCharacteristics(tos) {
  const order = ['category', 'locality', 'boundaries', 'chairman', 'contacts', 'population', 'year'];
  const labels = {
    category: 'Категория',
    locality: 'Населённый пункт',
    boundaries: 'Границы/территория',
    chairman: 'Председатель',
    contacts: 'Контакты',
    population: 'Численность жителей',
    year: 'Год создания'
  };
  const skip = ['name', 'description', 'logo', 'social', 'coordinates', 'center', 'slug'];

  const rows = [];

  order.forEach((key) => {
    if (tos[key] !== undefined) {
      rows.push(`<tr><th>${labels[key]}</th><td>${formatValue(tos[key])}</td></tr>`);
    }
  });

  Object.keys(tos).forEach((key) => {
    if (order.includes(key) || skip.includes(key)) return;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    rows.push(`<tr><th>${label}</th><td>${formatValue(tos[key])}</td></tr>`);
  });

  if (rows.length === 0) {
    rows.push('<tr><td colspan="2">Нет данных по ТОС.</td></tr>');
  }

  return rows.join('\n');
}

function buildSocialLinks(tos) {
  if (Array.isArray(tos.social) && tos.social.length > 0) {
    return tos.social.map((link) => `<li><a href="${link}" target="_blank" rel="noopener">${link}</a></li>`).join('\n');
  }
  return '<li>Ссылки не указаны</li>';
}

function buildLogoBlock(tos) {
  if (tos.logo) {
    return `<img src="../${tos.logo}" alt="Логотип ${escapeHtml(tos.name)}" class="tos-logo">`;
  }
  return '<img src="../assets/images/logo_placeholder.png" alt="Логотип ТОС" class="tos-logo">';
}

function buildMapSection(tos) {
  const coords = tos.coordinates || tos.center;
  if (Array.isArray(coords) && coords.length === 2) {
    const mapScript = `
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        if (!window.L) return;
        const center = [${coords[0]}, ${coords[1]}];
        const map = L.map('tos-map').setView(center, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        L.marker(center).addTo(map).bindPopup('${escapeHtml(tos.name)}');
      });
    </script>`;
    return {
      mapBlock: '<div id="tos-map" class="map-block"></div>',
      mapScript
    };
  }

  return {
    mapBlock: '<div class="map-placeholder">Координаты не указаны. Обратитесь к председателю ТОС для уточнения.</div>',
    mapScript: ''
  };
}

function buildLocalityText(tos) {
  const categoryText = tos.category === 'city' ? 'Городской ТОС' : 'Сельский ТОС';
  const localityText = tos.locality || 'Населённый пункт не указан';
  return `${categoryText} · ${localityText}`;
}

function generatePages() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const template = fs.readFileSync(templatePath, 'utf-8');

  data.forEach((tos) => {
    const slug = slugify(tos.name);
    const { mapBlock, mapScript } = buildMapSection(tos);
    const filled = template
      .replace(/{{name}}/g, escapeHtml(tos.name))
      .replace(/{{locality_text}}/g, escapeHtml(buildLocalityText(tos)))
      .replace(/{{logo_block}}/g, buildLogoBlock(tos))
      .replace(/{{description}}/g, escapeHtml(tos.description || 'Описание не указано'))
      .replace(/{{social_links}}/g, buildSocialLinks(tos))
      .replace(/{{characteristics}}/g, buildCharacteristics(tos))
      .replace(/{{map_block}}/g, mapBlock)
      .replace(/{{map_script}}/g, mapScript);

    const outPath = path.join(outputDir, `${slug}.html`);
    fs.writeFileSync(outPath, filled, 'utf-8');
    console.log(`Создана страница: ${outPath}`);
  });
}

generatePages();
