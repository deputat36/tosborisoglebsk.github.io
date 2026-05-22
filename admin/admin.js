const DATASETS = {
  toses: {
    title: 'Каталог ТОС',
    hint: 'Редактирование data/toses.json',
    file: '/data/toses.json',
    download: 'toses.json',
    label: (x) => `ТОС «${x.name || 'без названия'}»`,
    sub: (x) => [x.location, x.chairperson].filter(Boolean).join(' · '),
    template: () => ({ slug: '', name: '', title: '', type: 'Городской', location: '', boundaries: '', founded: '', chairperson: '', contacts_raw: '', groups_raw: '', phones: [], emails: [], chairperson_links: [], social_links: [], population: '', description: '', logo: '', updated_at: today() }),
    fields: [
      ['name', 'Название ТОС'], ['slug', 'Slug / адрес'], ['type', 'Тип', 'select:Городской|Сельский'], ['location', 'Населённый пункт / микрорайон'],
      ['boundaries', 'Границы', 'textarea'], ['founded', 'Год создания'], ['chairperson', 'Председатель'], ['population', 'Количество жителей'],
      ['phones', 'Телефоны', 'array'], ['emails', 'Email', 'array'], ['chairperson_links', 'Ссылки председателя', 'array'], ['social_links', 'Сообщества', 'array'],
      ['contacts_raw', 'Исходные контакты', 'textarea'], ['groups_raw', 'Исходные ссылки на группы', 'textarea'], ['description', 'Описание', 'textarea'], ['logo', 'Логотип: путь к файлу'], ['updated_at', 'Дата обновления']
    ]
  },
  news: {
    title: 'Новости', hint: 'Редактирование data/news.json', file: '/data/news.json', download: 'news.json',
    label: (x) => x.title || 'Новость без заголовка', sub: (x) => [x.date, x.category].filter(Boolean).join(' · '),
    template: () => ({ id: 'news-' + Date.now(), date: today(), category: 'Новости ТОС', title: '', lead: '', text: [''], source: 'Редакция портала', source_url: '', image: '' }),
    fields: [['id','ID'], ['date','Дата'], ['category','Категория'], ['title','Заголовок'], ['lead','Краткое описание','textarea'], ['text','Текст абзацами','arrayText'], ['source','Источник'], ['source_url','Ссылка на источник'], ['image','Изображение']]
  },
  articles: {
    title: 'Материалы', hint: 'Редактирование data/articles.json', file: '/data/articles.json', download: 'articles.json',
    label: (x) => x.title || 'Материал без заголовка', sub: (x) => x.category || '',
    template: () => ({ id: 'material-' + Date.now(), category: 'Материал', title: '', lead: '', content: [''] }),
    fields: [['id','ID'], ['category','Категория'], ['title','Заголовок'], ['lead','Краткое описание','textarea'], ['content','Текст абзацами','arrayText']]
  },
  documents: {
    title: 'Документы', hint: 'Редактирование data/documents.json', file: '/data/documents.json', download: 'documents.json',
    label: (x) => x.title || 'Документ без названия', sub: (x) => [x.type, x.date].filter(Boolean).join(' · '),
    template: () => ({ title: '', type: 'Документ', description: '', url: '', date: '' }),
    fields: [['title','Название'], ['type','Тип'], ['description','Описание','textarea'], ['url','Ссылка / путь к файлу'], ['date','Дата / статус']]
  },
  grants: {
    title: 'Конкурсы', hint: 'Редактирование data/grants.json', file: '/data/grants.json', download: 'grants.json',
    label: (x) => x.title || 'Конкурс без названия', sub: (x) => [x.status, x.deadline].filter(Boolean).join(' · '),
    template: () => ({ title: '', status: 'Проверять актуальность', amount: '', budget: '', deadline: '', directions: '', who: '', source: '', note: '' }),
    fields: [['title','Название'], ['status','Статус'], ['amount','Сумма'], ['budget','Бюджет'], ['deadline','Срок'], ['directions','Направления','textarea'], ['who','Кто может участвовать','textarea'], ['source','Источник'], ['note','Заметка','textarea']]
  },
  projects: {
    title: 'Проекты', hint: 'Редактирование data/projects.json', file: '/data/projects.json', download: 'projects.json',
    label: (x) => x.title || 'Проект без названия', sub: (x) => x.type || '',
    template: () => ({ id: 'project-' + Date.now(), title: '', type: 'Идея проекта', description: '', steps: [''] }),
    fields: [['id','ID'], ['title','Название'], ['type','Тип'], ['description','Описание','textarea'], ['steps','Шаги','arrayText']]
  }
};

const state = { section: 'toses', data: {}, selected: 0, query: '' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function today(){ return new Date().toISOString().slice(0,10); }
function storageKey(section){ return `tosbgo_admin_${section}`; }
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function safe(v){ return String(v ?? ''); }
function slugify(text){
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return safe(text).toLowerCase().split('').map(ch => map[ch] ?? ch).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'item';
}
function formatPhone(raw){
  let d = safe(raw).replace(/\D/g,'');
  if(d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if(d.length === 10) d = '7' + d;
  if(d.length === 11 && d.startsWith('7')) return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9,11)}`;
  return raw;
}
function extractPhones(text){
  const clean = safe(text).replace(/https?:\/\/\S+/g,' ').replace(/[\w.-]+@[\w.-]+\.\w+/g,' ');
  const found = clean.match(/(?:\+7|8|7)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g) || [];
  return [...new Set(found.map(formatPhone))];
}
function extractEmails(text){ return safe(text).match(/[\w.-]+@[\w.-]+\.\w+/g) || []; }
function extractLinks(text){ return safe(text).match(/https?:\/\/[^\s,;]+/g) || []; }

async function loadSection(section){
  state.section = section;
  state.selected = 0;
  $('#helpSection').classList.toggle('hidden', section !== 'help');
  $('#editorSection').classList.toggle('hidden', section === 'help');
  $$('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
  if(section === 'help') return;

  const cfg = DATASETS[section];
  $('#sectionTitle').textContent = cfg.title;
  $('#sectionHint').textContent = cfg.hint;
  $('#searchInput').value = '';
  state.query = '';

  const draft = localStorage.getItem(storageKey(section));
  if(draft){
    try { state.data[section] = JSON.parse(draft); }
    catch { localStorage.removeItem(storageKey(section)); }
  }
  if(!state.data[section]){
    try{
      const res = await fetch(cfg.file, {cache:'no-store'});
      state.data[section] = await res.json();
    }catch(e){
      state.data[section] = [];
      showValidation([`Не удалось загрузить ${cfg.file}. Можно начать с пустого файла.`], false);
    }
  }
  renderList();
  renderForm();
}

function currentData(){ return state.data[state.section] || []; }
function saveDraft(){ localStorage.setItem(storageKey(state.section), JSON.stringify(currentData())); }
function filteredIndexes(){
  const q = state.query.toLowerCase().trim();
  return currentData().map((item, index) => ({item,index})).filter(({item}) => !q || JSON.stringify(item).toLowerCase().includes(q));
}
function renderList(){
  const cfg = DATASETS[state.section];
  const list = $('#itemsList');
  const indexes = filteredIndexes();
  if(!indexes.length){ list.innerHTML = '<div class="empty">Записей не найдено.</div>'; return; }
  list.innerHTML = indexes.map(({item,index}) => `<button class="item ${index===state.selected?'active':''}" data-index="${index}" type="button"><b>${escapeHtml(cfg.label(item))}</b><span>${escapeHtml(cfg.sub(item))}</span></button>`).join('');
  $$('.item', list).forEach(btn => btn.addEventListener('click', () => { state.selected = Number(btn.dataset.index); renderList(); renderForm(); }));
}
function fieldType(spec){ return spec[2] || 'text'; }
function renderForm(){
  const cfg = DATASETS[state.section];
  const data = currentData();
  const item = data[state.selected];
  const form = $('#editForm');
  if(!item){ form.innerHTML = '<div class="empty">Выберите запись или добавьте новую.</div>'; return; }
  form.innerHTML = `<div class="form-grid">${cfg.fields.map(spec => renderField(item, spec)).join('')}</div><div class="form-actions"><button class="btn primary" type="button" id="saveItem">Сохранить в черновик</button><button class="btn" type="button" id="duplicateItem">Дублировать</button><button class="btn danger" type="button" id="deleteItem">Удалить</button><button class="btn" type="button" id="autoFill">Автозаполнение</button></div><div class="preview" id="previewBox"></div>`;
  bindForm(item);
  renderPreview(item);
}
function renderField(item, spec){
  const [key, label] = spec;
  const type = fieldType(spec);
  const value = item[key];
  const full = ['textarea','array','arrayText'].includes(type) ? ' full' : '';
  if(type.startsWith('select:')){
    const opts = type.replace('select:','').split('|');
    return `<div class="field${full}"><label>${label}</label><select data-key="${key}">${opts.map(o => `<option ${value===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
  }
  if(type === 'textarea') return `<div class="field${full}"><label>${label}</label><textarea data-key="${key}">${escapeHtml(value)}</textarea></div>`;
  if(type === 'array' || type === 'arrayText'){
    const arr = Array.isArray(value) ? value : (value ? [value] : []);
    return `<div class="field full array-field" data-array-key="${key}"><label>${label}</label><div class="array-list">${arr.map((v,i)=>`<div class="array-row"><textarea data-array-index="${i}">${escapeHtml(v)}</textarea><button class="btn danger" type="button" data-remove-array="${i}">×</button></div>`).join('')}</div><button class="btn" type="button" data-add-array="${key}">Добавить строку</button></div>`;
  }
  return `<div class="field${full}"><label>${label}</label><input data-key="${key}" value="${escapeHtml(value)}"/></div>`;
}
function bindForm(item){
  $$('[data-key]').forEach(el => el.addEventListener('input', () => { item[el.dataset.key] = el.value; saveDraft(); renderList(); renderPreview(item); }));
  $$('[data-array-key]').forEach(box => {
    const key = box.dataset.arrayKey;
    $$('textarea[data-array-index]', box).forEach(el => el.addEventListener('input', () => { item[key][Number(el.dataset.arrayIndex)] = el.value; saveDraft(); renderPreview(item); }));
    $$('[data-remove-array]', box).forEach(btn => btn.addEventListener('click', () => { item[key].splice(Number(btn.dataset.removeArray),1); saveDraft(); renderForm(); }));
    $('[data-add-array]', box)?.addEventListener('click', () => { if(!Array.isArray(item[key])) item[key] = []; item[key].push(''); saveDraft(); renderForm(); });
  });
  $('#saveItem')?.addEventListener('click', () => { saveDraft(); showValidation(['Черновик сохранён в браузере. Теперь можно скачать JSON.'], true); });
  $('#deleteItem')?.addEventListener('click', () => { if(confirm('Удалить запись?')){ currentData().splice(state.selected,1); state.selected=0; saveDraft(); renderList(); renderForm(); }});
  $('#duplicateItem')?.addEventListener('click', () => { const copy=clone(item); if(copy.id) copy.id += '-copy'; if(copy.slug) copy.slug += '-copy'; currentData().splice(state.selected+1,0,copy); state.selected++; saveDraft(); renderList(); renderForm(); });
  $('#autoFill')?.addEventListener('click', () => { autoFill(item); saveDraft(); renderForm(); });
}
function autoFill(item){
  if(state.section === 'toses'){
    if(!item.slug && item.name) item.slug = slugify(item.name);
    item.title = item.name ? `ТОС «${item.name}»` : item.title;
    item.phones = extractPhones(item.contacts_raw || '');
    item.emails = extractEmails(item.contacts_raw || '');
    item.chairperson_links = extractLinks(item.contacts_raw || '');
    item.social_links = extractLinks(item.groups_raw || '');
    item.updated_at = today();
  }else{
    if(!item.id && item.title) item.id = slugify(item.title);
  }
}
function renderPreview(item){
  const box = $('#previewBox'); if(!box) return;
  const title = item.title || item.name || 'Запись без названия';
  const desc = item.lead || item.description || item.boundaries || item.note || '';
  box.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc).slice(0, 300)}</p>`;
}
function validate(){
  const data = currentData();
  const errors = [];
  const seen = new Set();
  data.forEach((item, i) => {
    const label = item.name || item.title || item.id || `запись ${i+1}`;
    const key = item.slug || item.id || item.title || item.name;
    if(key){ if(seen.has(key)) errors.push(`Дубль идентификатора: ${label}`); seen.add(key); }
    if(state.section === 'toses'){
      if(!item.name) errors.push(`ТОС №${i+1}: нет названия.`);
      if(!item.slug) errors.push(`${label}: нет slug.`);
      if(!item.chairperson) errors.push(`${label}: не указан председатель.`);
      if(!item.boundaries) errors.push(`${label}: не указаны границы.`);
      if((!item.phones || !item.phones.length) && !item.contacts_raw.includes('уточняется')) errors.push(`${label}: нет телефона.`);
    }
    if(['news','articles'].includes(state.section)){
      if(!item.title) errors.push(`Запись №${i+1}: нет заголовка.`);
      if(!item.id) errors.push(`${label}: нет ID.`);
      if(!item.lead) errors.push(`${label}: нет краткого описания.`);
    }
    if(state.section === 'documents'){
      if(!item.title) errors.push(`Документ №${i+1}: нет названия.`);
      if(!item.url) errors.push(`${label}: нет ссылки на документ.`);
    }
  });
  showValidation(errors.length ? errors : ['Ошибок не найдено.'], !errors.length);
}
function showValidation(messages, ok){
  const box = $('#validationBox');
  box.classList.remove('hidden');
  box.classList.toggle('ok', !!ok);
  box.innerHTML = `<b>${ok ? 'Готово' : 'Найдены замечания'}</b><ul>${messages.map(m=>`<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
}
function downloadJson(){
  const cfg = DATASETS[state.section];
  const data = JSON.stringify(currentData(), null, 2);
  const blob = new Blob([data], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = cfg.download; a.click();
  URL.revokeObjectURL(url);
}
function addItem(){
  const item = DATASETS[state.section].template();
  currentData().unshift(item);
  state.selected = 0;
  saveDraft(); renderList(); renderForm();
}
function escapeHtml(value){ return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

$$('.tab').forEach(btn => btn.addEventListener('click', () => loadSection(btn.dataset.section)));
$('#searchInput').addEventListener('input', e => { state.query = e.target.value; renderList(); });
$('#addItem').addEventListener('click', addItem);
$('#downloadJson').addEventListener('click', downloadJson);
$('#validateBtn').addEventListener('click', validate);
$('#resetLocal').addEventListener('click', () => {
  if(confirm('Удалить все локальные черновики админки? Данные на сайте не изменятся.')){
    Object.keys(DATASETS).forEach(k => localStorage.removeItem(storageKey(k)));
    location.reload();
  }
});

loadSection('toses');
