const DATASETS = {
  toses: {
    title: 'Каталог ТОС',
    hint: 'Редактирование data/toses.json',
    file: '/data/toses.json',
    download: 'toses.json',
    label: (x) => `ТОС «${x.name || 'без названия'}»`,
    sub: (x) => [x.location, x.chairperson].filter(Boolean).join(' · '),
    template: () => ({ slug: '', name: '', title: '', type: 'Городской', status: 'published', location: '', boundaries: '', founded: '', chairperson: '', contacts_raw: '', groups_raw: '', phones: [], emails: [], chairperson_links: [], social_links: [], population: '', description: '', logo: '', updated_at: today() }),
    fields: [
      ['name', 'Название ТОС'], ['slug', 'Slug / адрес'], ['status', 'Статус', 'select:published|draft'], ['type', 'Тип', 'select:Городской|Сельский'], ['location', 'Населённый пункт / микрорайон'],
      ['boundaries', 'Границы', 'textarea'], ['founded', 'Год создания'], ['chairperson', 'Председатель'], ['population', 'Количество жителей'],
      ['phones', 'Телефоны', 'array'], ['emails', 'Email', 'array'], ['chairperson_links', 'Ссылки председателя', 'array'], ['social_links', 'Сообщества', 'array'],
      ['contacts_raw', 'Исходные контакты', 'textarea'], ['groups_raw', 'Исходные ссылки на группы', 'textarea'], ['description', 'Описание', 'textarea'], ['logo', 'Логотип: путь к файлу'], ['updated_at', 'Дата обновления']
    ]
  },
  news: {
    title: 'Новости', hint: 'Редактирование data/news.json', file: '/data/news.json', download: 'news.json',
    label: (x) => x.title || 'Новость без заголовка', sub: (x) => [x.date, x.category, x.status].filter(Boolean).join(' · '),
    template: () => ({ id: 'news-' + Date.now(), status: 'published', date: today(), category: 'Новости ТОС', title: '', lead: '', text: [''], source: 'Редакция портала', source_url: '', image: '', tos_slug: '' }),
    fields: [['id','ID'], ['status','Статус', 'select:published|draft'], ['tos_slug','Привязка к ТОС: slug', 'tosSlug'], ['date','Дата'], ['category','Категория'], ['title','Заголовок'], ['lead','Краткое описание','textarea'], ['text','Текст абзацами','arrayText'], ['source','Источник'], ['source_url','Ссылка на источник'], ['image','Изображение']]
  },
  articles: {
    title: 'Материалы', hint: 'Редактирование data/articles.json', file: '/data/articles.json', download: 'articles.json',
    label: (x) => x.title || 'Материал без заголовка', sub: (x) => [x.category, x.status].filter(Boolean).join(' · '),
    template: () => ({ id: 'material-' + Date.now(), status: 'published', category: 'Материал', title: '', lead: '', content: [''] }),
    fields: [['id','ID'], ['status','Статус', 'select:published|draft'], ['category','Категория'], ['title','Заголовок'], ['lead','Краткое описание','textarea'], ['content','Текст абзацами','arrayText']]
  },
  documents: {
    title: 'Документы', hint: 'Редактирование data/documents.json', file: '/data/documents.json', download: 'documents.json',
    label: (x) => x.title || 'Документ без названия', sub: (x) => [x.type, x.date].filter(Boolean).join(' · '),
    template: () => ({ title: '', type: 'Документ', status: 'published', description: '', url: '', date: '' }),
    fields: [['title','Название'], ['status','Статус', 'select:published|draft'], ['type','Тип'], ['description','Описание','textarea'], ['url','Ссылка / путь к файлу'], ['date','Дата / статус']]
  },
  grants: {
    title: 'Конкурсы', hint: 'Редактирование data/grants.json', file: '/data/grants.json', download: 'grants.json',
    label: (x) => x.title || 'Конкурс без названия', sub: (x) => [x.status, x.deadline].filter(Boolean).join(' · '),
    template: () => ({ title: '', status: 'Проверять актуальность', amount: '', budget: '', deadline: '', directions: '', who: '', source: '', note: '' }),
    fields: [['title','Название'], ['status','Статус'], ['amount','Сумма'], ['budget','Бюджет'], ['deadline','Срок'], ['directions','Направления','textarea'], ['who','Кто может участвовать','textarea'], ['source','Источник'], ['note','Заметка','textarea']]
  },
  projects: {
    title: 'Проекты', hint: 'Редактирование data/projects.json', file: '/data/projects.json', download: 'projects.json',
    label: (x) => x.title || 'Проект без названия', sub: (x) => [x.type, x.status, x.tos_slug].filter(Boolean).join(' · '),
    template: () => ({ id: 'project-' + Date.now(), status: 'published', tos_slug: '', title: '', type: 'Идея проекта', description: '', steps: [''] }),
    fields: [['id','ID'], ['status','Статус', 'select:published|draft'], ['tos_slug','Привязка к ТОС: slug', 'tosSlug'], ['title','Название'], ['type','Тип'], ['description','Описание','textarea'], ['steps','Шаги','arrayText']]
  }
};

const state = { section: 'toses', data: {}, selected: 0, query: '', filter: '', tosOptions: [] };
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
function isDraft(item){ return item.status === 'draft'; }
function itemQuality(item, section = state.section){
  let points = 0, total = 0, issues = [];
  const check = (ok, msg) => { total++; if(ok) points++; else issues.push(msg); };
  if(section === 'toses'){
    check(!!item.name, 'нет названия'); check(!!item.slug, 'нет slug'); check(!!item.location, 'нет территории'); check(!!item.boundaries, 'нет границ'); check(!!item.founded, 'нет года'); check(!!item.chairperson, 'нет председателя'); check((item.phones||[]).length>0, 'нет телефона'); check((item.social_links||[]).length>0, 'нет сообщества'); check(safe(item.description).length>=80, 'короткое описание'); check(!!item.population, 'нет количества жителей'); check(!!item.updated_at, 'нет даты обновления'); check(!!item.logo, 'нет логотипа');
  } else if(section === 'news'){
    check(!!item.id, 'нет ID'); check(!!item.date, 'нет даты'); check(!!item.category, 'нет категории'); check(!!item.title, 'нет заголовка'); check(!!item.lead, 'нет краткого описания'); check((item.text||[]).join(' ').length>=120, 'мало текста'); check(!!item.source, 'нет источника');
  } else if(section === 'articles'){
    check(!!item.id, 'нет ID'); check(!!item.category, 'нет категории'); check(!!item.title, 'нет заголовка'); check(!!item.lead, 'нет описания'); check((item.content||[]).join(' ').length>=200, 'материал слишком короткий');
  } else if(section === 'documents'){
    check(!!item.title, 'нет названия'); check(!!item.type, 'нет типа'); check(!!item.description, 'нет описания'); check(!!item.url, 'нет ссылки');
  } else if(section === 'grants'){
    check(!!item.title, 'нет названия'); check(!!item.status, 'нет статуса'); check(!!item.deadline, 'нет срока'); check(!!item.who, 'не указано, кто участвует'); check(!!item.source, 'нет источника');
  } else if(section === 'projects'){
    check(!!item.id, 'нет ID'); check(!!item.title, 'нет названия'); check(!!item.type, 'нет типа'); check(!!item.description, 'нет описания'); check((item.steps||[]).length>0, 'нет шагов');
  }
  return { score: total ? Math.round(points / total * 100) : 0, issues };
}
async function ensureTosOptions(){
  if(state.tosOptions.length) return state.tosOptions;
  try{
    const draft = localStorage.getItem(storageKey('toses'));
    const data = draft ? JSON.parse(draft) : await (await fetch('/data/toses.json',{cache:'no-store'})).json();
    state.tosOptions = (data || []).filter(x => x.slug).map(x => ({slug:x.slug, name:x.name || x.slug, location:x.location || ''})).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  }catch(e){ state.tosOptions = []; }
  return state.tosOptions;
}

async function loadSection(section){
  state.section = section;
  state.selected = 0;
  state.filter = '';
  $('#helpSection').classList.toggle('hidden', section !== 'help');
  $('#editorSection').classList.toggle('hidden', section === 'help');
  $$('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
  if(section === 'help') return;
  await ensureTosOptions();

  const cfg = DATASETS[section];
  $('#sectionTitle').textContent = cfg.title;
  $('#sectionHint').textContent = cfg.hint;
  $('#searchInput').value = '';
  state.query = '';
  buildFilters();

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

function buildFilters(){
  const select = $('#quickFilter'); if(!select) return;
  let options = [['', 'Все записи']];
  if(state.section === 'toses') options.push(['city','Городские'],['village','Сельские'],['no-phone','Без телефона'],['no-social','Без соцсетей'],['no-logo','Без логотипа'],['low-quality','Заполнено менее 70%'],['draft','Черновики']);
  if(['news','articles','projects'].includes(state.section)) options.push(['published','Опубликованные'],['draft','Черновики'],['linked-tos','Привязаны к ТОС'],['low-quality','Заполнено менее 70%']);
  if(state.section === 'documents') options.push(['template','Шаблоны'],['no-url','Без ссылки'],['draft','Черновики'],['low-quality','Заполнено менее 70%']);
  if(state.section === 'grants') options.push(['no-source','Без источника'],['low-quality','Заполнено менее 70%']);
  select.innerHTML = options.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
}
function currentData(){ return state.data[state.section] || []; }
function saveDraft(){ localStorage.setItem(storageKey(state.section), JSON.stringify(currentData())); }
function passesFilter(item){
  const f = state.filter; if(!f) return true;
  if(f === 'city') return item.type === 'Городской';
  if(f === 'village') return item.type === 'Сельский';
  if(f === 'no-phone') return !(item.phones||[]).length;
  if(f === 'no-social') return !(item.social_links||[]).length;
  if(f === 'no-logo') return !item.logo;
  if(f === 'draft') return isDraft(item);
  if(f === 'published') return !isDraft(item);
  if(f === 'linked-tos') return !!item.tos_slug;
  if(f === 'no-url') return !item.url;
  if(f === 'template') return String(item.type||'').toLowerCase().includes('шаблон');
  if(f === 'no-source') return !item.source;
  if(f === 'low-quality') return itemQuality(item).score < 70;
  return true;
}
function filteredIndexes(){
  const q = state.query.toLowerCase().trim();
  return currentData().map((item, index) => ({item,index})).filter(({item}) => (!q || JSON.stringify(item).toLowerCase().includes(q)) && passesFilter(item));
}
function renderList(){
  const cfg = DATASETS[state.section];
  const list = $('#itemsList');
  const indexes = filteredIndexes();
  if(!indexes.length){ list.innerHTML = '<div class="empty">Записей не найдено.</div>'; return; }
  list.innerHTML = indexes.map(({item,index}) => { const q = itemQuality(item).score; return `<button class="item ${index===state.selected?'active':''}" data-index="${index}" type="button"><b>${escapeHtml(cfg.label(item))}</b><span>${escapeHtml(cfg.sub(item))}</span><em class="score">Заполнено: ${q}%</em></button>`; }).join('');
  $$('.item', list).forEach(btn => btn.addEventListener('click', () => { state.selected = Number(btn.dataset.index); renderList(); renderForm(); }));
}
function fieldType(spec){ return spec[2] || 'text'; }
function renderForm(){
  const cfg = DATASETS[state.section];
  const data = currentData();
  const item = data[state.selected];
  const form = $('#editForm');
  if(!item){ form.innerHTML = '<div class="empty">Выберите запись или добавьте новую.</div>'; return; }
  form.innerHTML = `<div class="form-grid">${cfg.fields.map(spec => renderField(item, spec)).join('')}</div><div class="form-actions"><button class="btn primary" type="button" id="saveItem">Сохранить в черновик</button><button class="btn" type="button" id="duplicateItem">Дублировать</button><button class="btn danger" type="button" id="deleteItem">Удалить</button><button class="btn" type="button" id="autoFill">Автозаполнение</button><button class="btn" type="button" id="copyItemJson">Копировать JSON записи</button></div><div class="preview" id="previewBox"></div>`;
  bindForm(item);
  renderPreview(item);
}
function tosSlugControl(key,value){
  const opts = state.tosOptions.map(x => `<option value="${escapeHtml(x.slug)}">ТОС «${escapeHtml(x.name)}» — ${escapeHtml(x.slug)}${x.location ? ' · ' + escapeHtml(x.location) : ''}</option>`).join('');
  return `<input list="tos-slug-list" data-key="${key}" value="${escapeHtml(value)}" placeholder="Например: uyutnyy"/><datalist id="tos-slug-list">${opts}</datalist><small>Начните вводить название или выберите ТОС из списка. В JSON сохранится slug.</small>`;
}
function renderField(item, spec){
  const [key, label] = spec;
  const type = fieldType(spec);
  const value = item[key];
  const full = ['textarea','array','arrayText','tosSlug'].includes(type) ? ' full' : '';
  if(type === 'tosSlug') return `<div class="field${full}"><label>${label}</label>${tosSlugControl(key,value)}</div>`;
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
}\nfunction bindForm(item){
  $$('[data-key]').forEach(el => el.addEventListener('input', () => { item[el.dataset.key] = el.value; saveDraft(); renderList(); renderPreview(item); }));
  $$('[data-array-key]').forEach(box => {
    const key = box.dataset.arrayKey;
    if(!Array.isArray(item[key])) item[key] = [];
    $$('textarea[data-array-index]', box).forEach(el => el.addEventListener('input', () => { item[key][Number(el.dataset.arrayIndex)] = el.value; saveDraft(); renderPreview(item); }));
    $$('[data-remove-array]', box).forEach(btn => btn.addEventListener('click', () => { item[key].splice(Number(btn.dataset.removeArray),1); saveDraft(); renderForm(); }));
    $('[data-add-array]', box)?.addEventListener('click', () => { if(!Array.isArray(item[key])) item[key] = []; item[key].push(''); saveDraft(); renderForm(); });
  });
  $('#saveItem')?.addEventListener('click', () => { saveDraft(); showValidation(['Черновик сохранён в браузере. Теперь можно скачать JSON.'], true); });
  $('#deleteItem')?.addEventListener('click', () => { if(confirm('Удалить запись?')){ currentData().splice(state.selected,1); state.selected=0; saveDraft(); renderList(); renderForm(); }});
  $('#duplicateItem')?.addEventListener('click', () => { const copy=clone(item); if(copy.id) copy.id += '-copy'; if(copy.slug) copy.slug += '-copy'; currentData().splice(state.selected+1,0,copy); state.selected++; saveDraft(); renderList(); renderForm(); });
  $('#autoFill')?.addEventListener('click', () => { autoFill(item); saveDraft(); renderForm(); });
  $('#copyItemJson')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(JSON.stringify(item,null,2)); showValidation(['JSON текущей записи скопирован в буфер обмена.'], true); });
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
    if(!item.status) item.status = 'published';
  }else{
    if(!item.id && item.title) item.id = slugify(item.title);
    if(!item.status && ['news','articles','documents','projects'].includes(state.section)) item.status = 'published';
  }
}
function renderPreview(item){
  const box = $('#previewBox'); if(!box) return;
  const title = item.title || item.name || 'Запись без названия';
  const desc = item.lead || item.description || item.boundaries || item.note || '';
  const q = itemQuality(item);
  if(state.section === 'toses'){
    box.innerHTML = `<h3>ТОС «${escapeHtml(item.name || 'без названия')}»</h3><div class="preview-grid"><div class="preview-tile"><b>${escapeHtml(item.population || '—')}</b><span>жителей</span></div><div class="preview-tile"><b>${escapeHtml(item.founded || '—')}</b><span>год создания</span></div><div class="preview-tile"><b>${escapeHtml(item.type || '—')}</b><span>тип</span></div></div><p><b>Председатель:</b> ${escapeHtml(item.chairperson || '—')}</p><p>${escapeHtml(desc).slice(0, 500)}</p><p class="quality-score">Заполнено: ${q.score}%</p>${q.issues.length?`<p><b>Что улучшить:</b> ${escapeHtml(q.issues.join(', '))}</p>`:''}`;
  } else {
    const tos = state.tosOptions.find(x => x.slug === item.tos_slug);
    box.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc).slice(0, 500)}</p><p class="quality-score">Заполнено: ${q.score}%</p>${item.tos_slug?`<p><b>Привязка к ТОС:</b> ${escapeHtml(tos ? 'ТОС «'+tos.name+'» ('+tos.slug+')' : item.tos_slug)}</p>`:''}${q.issues.length?`<p><b>Что улучшить:</b> ${escapeHtml(q.issues.join(', '))}</p>`:''}`;
  }
}
function validate(){
  const data = currentData();
  const errors = [];
  const seen = new Set();
  data.forEach((item, i) => {
    const label = item.name || item.title || item.id || `запись ${i+1}`;
    const key = item.slug || item.id || item.title || item.name;
    if(key){ if(seen.has(key)) errors.push(`Дубль идентификатора: ${label}`); seen.add(key); }
    if(item.tos_slug && state.tosOptions.length && !state.tosOptions.some(x => x.slug === item.tos_slug)) errors.push(`${label}: tos_slug «${item.tos_slug}» не найден в каталоге ТОС.`);
    if(state.section === 'toses'){
      if(!item.name) errors.push(`ТОС №${i+1}: нет названия.`);
      if(!item.slug) errors.push(`${label}: нет slug.`);
      if(!item.chairperson) errors.push(`${label}: не указан председатель.`);
      if(!item.boundaries) errors.push(`${label}: не указаны границы.`);
      if((!item.phones || !item.phones.length) && !safe(item.contacts_raw).includes('уточняется')) errors.push(`${label}: нет телефона.`);
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
function qualityAudit(){
  const rows = currentData().map(item => ({item, q:itemQuality(item)})).sort((a,b)=>a.q.score-b.q.score);
  const avg = rows.length ? Math.round(rows.reduce((s,r)=>s+r.q.score,0)/rows.length) : 0;
  const messages = [`Средняя заполненность раздела: ${avg}%`];
  const html = `<b>Аудит качества</b><p>${escapeHtml(messages[0])}</p><div class="quality-list">${rows.slice(0,20).map(({item,q})=>`<div class="quality-row"><div class="quality-score">${q.score}%</div><div><b>${escapeHtml(item.name||item.title||item.id||'Запись')}</b><br><span>${escapeHtml(q.issues.length?q.issues.join(', '):'замечаний нет')}</span></div></div>`).join('')}</div>`;
  const box = $('#validationBox'); box.classList.remove('hidden'); box.classList.remove('ok'); box.innerHTML = html;
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
  downloadText(cfg.download, data, 'application/json;charset=utf-8');
}
function downloadText(filename, text, type='text/plain;charset=utf-8'){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
async function downloadAllJson(){
  for(const key of Object.keys(DATASETS)){
    if(!state.data[key]){
      const draft = localStorage.getItem(storageKey(key));
      if(draft) state.data[key] = JSON.parse(draft);
      else {
        try{ const res = await fetch(DATASETS[key].file,{cache:'no-store'}); state.data[key] = await res.json(); }
        catch{ state.data[key] = []; }
      }
    }
  }
  const bundle = Object.fromEntries(Object.keys(DATASETS).map(k => [DATASETS[k].download, state.data[k] || []]));
  downloadText(`tos-bgo-json-backup-${today()}.json`, JSON.stringify(bundle,null,2), 'application/json;charset=utf-8');
}
function importJsonFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!Array.isArray(parsed)) throw new Error('Файл должен содержать массив JSON.');
      state.data[state.section] = parsed;
      state.selected = 0;
      if(state.section === 'toses') state.tosOptions = [];
      saveDraft(); renderList(); renderForm(); showValidation([`Файл ${file.name} загружен в раздел «${DATASETS[state.section].title}».`], true);
    }catch(e){ showValidation([`Ошибка импорта: ${e.message}`], false); }
  };
  reader.readAsText(file);
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
$('#quickFilter')?.addEventListener('change', e => { state.filter = e.target.value; renderList(); });
$('#addItem').addEventListener('click', addItem);
$('#downloadJson').addEventListener('click', downloadJson);
$('#downloadAllJson')?.addEventListener('click', downloadAllJson);
$('#importJson')?.addEventListener('click', () => $('#importJsonFile')?.click());
$('#importJsonFile')?.addEventListener('change', e => importJsonFile(e.target.files[0]));
$('#validateBtn').addEventListener('click', validate);
$('#qualityBtn')?.addEventListener('click', qualityAudit);
$('#resetLocal').addEventListener('click', () => {
  if(confirm('Удалить все локальные черновики админки? Данные на сайте не изменятся.')){
    Object.keys(DATASETS).forEach(k => localStorage.removeItem(storageKey(k)));
    location.reload();
  }
});

loadSection('toses');
