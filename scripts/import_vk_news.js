/* Public community wall → complete site archive. Media URLs stay on VK.
 * One owner: .github/workflows/update-vk-news.yml. Never logs credentials.
 * VK_TOKEN: user/service token; group/community access token is incompatible.
 */
const fs = require('node:fs');
const path = require('node:path');
const media = require('../assets/js/news-media');
const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const STATE_PATH = path.join(ROOT, 'data', 'vk_sync_state.json');
const PENDING_PATH = path.join(ROOT, 'data', 'vk_import_pending.json');
const REPORT_PATH = path.join(ROOT, 'data', 'vk_import_report.json');
const DEFAULT_VK_DOMAIN = 'tosbgo';
const VK_TOKEN = process.env.VK_TOKEN || '';
const VK_DOMAIN = process.env.VK_DOMAIN || DEFAULT_VK_DOMAIN;
const VK_API_VERSION = process.env.VK_API_VERSION || '5.199';
const HASHTAGS = (process.env.VK_HASHTAGS || '#наСайтТОСБГО,#новостьТОСБГО,#новостиТОСБГО').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const STOP_TAGS = (process.env.VK_EXCLUDE_HASHTAGS || '#неНаСайтТОСБГО').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  // Malformed existing data must abort, never silently replace the archive.
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, file);
}
function configuration(env = process.env) {
  const mode = env.VK_IMPORT_MODE || 'all';
  if (!['all', 'tagged'].includes(mode)) throw Error('VK_IMPORT_MODE: expected all or tagged.');
  const pageSize = Number(env.VK_COUNT || 100), maxPages = Number(env.VK_MAX_PAGES || 100);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw Error('VK_COUNT: expected 1..100 (page size, not archive limit).');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw Error('VK_MAX_PAGES: expected 1..1000.');
  const owner = env.VK_OWNER_ID || '';
  if (owner && !/^-[1-9]\d*$/.test(owner)) throw Error('VK_OWNER_ID: expected negative community ID.');
  // NEWS_LIMIT has intentionally been retired: archive retention is unlimited.
  return {mode, pageSize, maxPages, owner, domain: env.VK_DOMAIN || DEFAULT_VK_DOMAIN};
}
function slugify(text) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashtagVariantsForTos(tos) {
  const values = [tos.slug, tos.name, tos.title, `тос${tos.name || ''}`, `ТОС${tos.name || ''}`]
    .filter(Boolean)
    .map((v) => String(v).replace(/^ТОС\s*[«"]?|[»"]$/gi, '').trim())
    .filter(Boolean);
  const variants = new Set();
  for (const value of values) {
    variants.add('#' + value.replace(/\s+/g, '').toLowerCase());
    variants.add('#тос' + value.replace(/\s+/g, '').toLowerCase());
    variants.add('#' + slugify(value).replace(/-/g, '').toLowerCase());
    variants.add('#tos' + slugify(value).replace(/-/g, '').toLowerCase());
  }
  return [...variants].filter((v) => v.length > 1);
}

function loadTosHashtagMap() {
  const toses = readJson(TOSES_PATH, []);
  const map = new Map();
  for (const tos of toses) {
    if (!tos.slug) continue;
    for (const tag of hashtagVariantsForTos(tos)) {
      map.set(tag.toLowerCase(), tos.slug);
    }
  }
  return map;
}

// Match entire hashtags, not fragments: #богана must not match #боганасобытия.
function extractHashtags(text) {
  return new Set(
    [...String(text || '').toLowerCase().matchAll(/#[\p{L}\p{N}_]+/gu)]
      .map((match) => match[0])
  );
}

function detectTosSlug(text, tagMap) {
  const tags = extractHashtags(text);
  for (const [tag, slug] of tagMap.entries()) {
    if (tags.has(tag)) return slug;
  }
  return '';
}

function stripServiceHashtags(text, tagMap = new Map()) {
  const serviceTags = new Set([...HASHTAGS, ...STOP_TAGS, ...tagMap.keys()]);
  return String(text || '')
    .replace(/#[\p{L}\p{N}_]+/gu, (tag) => serviceTags.has(tag.toLowerCase()) ? '' : tag)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasAllowedHashtag(text) {
  const tags = extractHashtags(text);
  return HASHTAGS.some((tag) => tags.has(tag));
}

function makeTitle(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость ТОС БГО';
  const firstSentence = clear.split(/[.!?]\s/)[0].trim();
  // Generated <title> appends " | ТОС БГО" (10 characters); SEO limit is 90.
  return firstSentence.length > 80 ? firstSentence.slice(0, 77).trim() + '...' : firstSentence;
}

function makeLead(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap).replace(/\s+/g, ' ').trim();
  if (!clear) return 'Новость из сообщества ВКонтакте.';
  return clear.length > 170 ? clear.slice(0, 167).trim() + '...' : clear;
}

function splitText(text, tagMap) {
  const clear = stripServiceHashtags(text, tagMap);
  if (!clear) return ['Новость опубликована в сообществе ВКонтакте.'];
  return clear.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function formatDate(unix) {
  // VK timestamps are Unix seconds; publication dates should use local
  // Moscow calendar days rather than the GitHub runner's timezone.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(Number(unix) * 1000));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}


function postKey(post) { return `vk-${Math.abs(post.owner_id)}-${post.id}`; }
function postParts(post, depth = 0) {
  if (!post || depth > 5) return [];
  return [post, ...(Array.isArray(post.copy_history) ? post.copy_history.flatMap(item => postParts(item, depth + 1)) : [])];
}
function postText(post) { return postParts(post).map(item => item.text || '').filter(Boolean).join('\n\n'); }
function shouldImport(post, mode = 'all') {
  const tags = extractHashtags(postText(post));
  if (STOP_TAGS.some(tag => tags.has(tag))) return false;
  return mode === 'all' || hasAllowedHashtag(postText(post));
}
function choosePhoto(photo) {
  const sizes = (photo?.sizes || []).filter(size => media.safeUrl(size.url)).sort((a,b) => (a.width || 0) - (b.width || 0));
  if (!sizes.length) return null;
  const full = sizes[sizes.length - 1];
  const display = sizes.find(size => size.width >= 1000) || full;
  const thumb = sizes.find(size => size.width >= 480) || display;
  return {src: media.safeUrl(display.url), thumbnail: media.safeUrl(thumb.url), full: media.safeUrl(full.url), width: display.width || 0, height: display.height || 0};
}
function collectMedia(parts) {
  const images = [], attachments = [], seen = new Set();
  for (const part of parts) for (const item of part.attachments || []) {
    if (item.type === 'photo') {
      const photo = choosePhoto(item.photo);
      const key = `photo:${item.photo?.owner_id}_${item.photo?.id || photo?.src}`;
      if (photo && !seen.has(key)) {seen.add(key); images.push(photo);}
    } else if (item.type === 'video') {
      const video = item.video || {};
      if (!Number.isInteger(video.owner_id) || !Number.isInteger(video.id)) continue;
      const url = `https://vk.com/video${video.owner_id}_${video.id}`;
      if (!seen.has(url)) {seen.add(url); attachments.push({type:'video', title:video.title || 'Видео ВКонтакте', url, player:media.safePlayer(video.player), preview:choosePhoto({sizes:video.image || video.first_frame || []})?.thumbnail || ''});}
    } else if (item.type === 'doc') {
      const doc = item.doc || {}, url = media.safeUrl(doc.url);
      if (url && !seen.has(url)) {seen.add(url); attachments.push({type:'document',title:doc.title || 'Документ',url,extension:String(doc.ext || ''),size:Number(doc.size) || 0});}
    } else if (item.type === 'link') {
      const link = item.link || {}, url = media.safeUrl(link.url);
      if (url && !seen.has(url)) {seen.add(url); attachments.push({type:'link',title:link.title || 'Материал по ссылке',url});}
    } else if (item.type === 'audio') {
      const audio = item.audio || {};
      // Audio streams must not be downloaded or reconstructed.
      const url = Number.isInteger(audio.owner_id) && Number.isInteger(audio.id) ? `https://vk.com/audio${audio.owner_id}_${audio.id}` : '';
      if (url && !seen.has(url)) {seen.add(url); attachments.push({type:'audio',title:[audio.artist,audio.title].filter(Boolean).join(' — ') || 'Аудиозапись ВКонтакте',url});}
    }
  }
  return {images, attachments};
}
function convertVkPost(post, tagMap = new Map()) {
  const parts = postParts(post), combinedText = postText(post), {images,attachments} = collectMedia(parts);
  const tosSlug = detectTosSlug(combinedText, tagMap);
  const body = stripServiceHashtags(post.text, tagMap);
  const sourceUrl = part => `https://vk.com/wall${part.owner_id}_${part.id}`;
  const reposts = parts.slice(1).map(part => ({
    source_url: sourceUrl(part), date: Number.isFinite(Number(part.date)) && part.date ? formatDate(part.date) : '',
    text: stripServiceHashtags(part.text, tagMap).split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean)
  }));
  const text = body ? body.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean) : [];
  const clear = stripServiceHashtags(combinedText, tagMap);
  return {
    id:postKey(post), status:'published', date:formatDate(post.date), published_at:new Date(Number(post.date)*1000).toISOString(),
    category:tosSlug ? 'Новости ТОС' : 'Новости ТОС БГО',
    title:clear ? makeTitle(combinedText, tagMap) : reposts.length ? 'Публикация из сообщества ВКонтакте' : images.length ? 'Фотографии из сообщества ТОС БГО' : 'Публикация сообщества ТОС БГО',
    lead:makeLead(combinedText,tagMap), text: text.length ? text : [reposts.length ? 'Репост публикации ВКонтакте.' : 'Материалы опубликованы в сообществе ТОС БГО.'],
    source:'ВКонтакте', source_url:sourceUrl(post), image:images[0]?.src || '', images, attachments, reposts,
    tos_slug:tosSlug, external:true, imported_from:'vk', content_origin:'editorial',
    vk_owner_id:post.owner_id, vk_post_id:post.id,
    vk_edited: Number(post.edited) || 0
  };
}
function sortNews(a,b) {
  return String(b.published_at || b.date || '').localeCompare(String(a.published_at || a.date || '')) || (Number(b.vk_post_id) || 0) - (Number(a.vk_post_id) || 0);
}
function mergeImportedNews(existing, imported, vkLimit = Infinity) {
  const byId = new Map(existing.map(item => [item.id,item]));
  for (const item of imported) {
    const previous = byId.get(item.id);
    if (previous && previous.imported_from !== 'vk') throw Error('VK ID collides with canonical material.');
    // Keep first-import timestamp and editorial provenance; never duplicate stable IDs.
    byId.set(item.id,{...previous,...item,imported_at:previous?.imported_at || new Date().toISOString()});
  }
  const records = [...byId.values()];
  const canonical = records.filter(item => item.imported_from !== 'vk');
  const effectiveLimit = vkLimit === Infinity ? Infinity : Math.max(0, Math.floor(Number(vkLimit)) || 0);
  const vkItems = records.filter(item => item.imported_from === 'vk').sort(sortNews).slice(0,effectiveLimit);
  return [...canonical,...vkItems].sort(sortNews);
}
function createApi({token, version = VK_API_VERSION, fetcher = fetch, pause = wait}) {
  return async function api(method, parameters) {
    for (let attempt=0; attempt<5; attempt++) {
      let response, data;
      try {
        response = await fetcher(`https://api.vk.com/method/${method}`, {
          method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({...parameters,access_token:token,v:version}), signal:AbortSignal.timeout(30000)
        });
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {await pause(1000 * 2**attempt); continue;}
          throw Error(`VK HTTP ${response.status}`);
        }
        data = await response.json();
      } catch (error) {
        if (attempt<4 && (!response || response.ok)) {await pause(1000*2**attempt);continue;}
        // Do not echo the fetch request, token or VK request_params in errors.
        throw Error('Сетевая ошибка ВК; опубликованные новости сохранены.');
      }
      if (data.error) {
        const code = Number(data.error.error_code);
        if ([1,6,9,10,29].includes(code) && attempt<4) {await pause(1000*2**attempt);continue;}
        if (code === 27) throw Error('VK API error 27: group/community access token не поддерживает wall.get; нужен сервисный или пользовательский токен.');
        throw Error(`VK API error ${code}; опубликованные новости сохранены.`);
      }
      return data.response;
    }
    throw Error('ВК временно ограничил запросы; повторите перенос позже.');
  };
}
function validPost(post) {
  return post && Number.isInteger(post.owner_id) && post.owner_id < 0 && Number.isInteger(post.id) && post.id>0 && Number.isFinite(Number(post.date)) && post.date>0;
}
async function scanWall({fetchPage, config, pending, onCheckpoint = () => {}, tagMap = new Map(), pause = wait}) {
  const fingerprint = JSON.stringify({owner:config.owner, domain:config.domain, mode:config.mode, pageSize:config.pageSize, stop:STOP_TAGS, hashtags:HASHTAGS});
  const saved = pending?.fingerprint === fingerprint ? pending : null;
  const records = new Map((saved?.records || []).map(item => [item.id,item]));
  const observed = new Set(saved?.observed || []), excluded = new Set(saved?.excluded || []);
  let owner = saved?.owner || Number(config.owner) || null;
  // Recheck the overlap after a retry; offsets can shift as new posts arrive.
  let offset = Math.max(0,(saved?.next_offset || 0) - config.pageSize*2), count = null;
  let pages = 0;
  while (pages<config.maxPages) {
    const page = await fetchPage(offset,config.pageSize);
    if (!page || !Array.isArray(page.items) || !Number.isInteger(page.count) || page.count<0) throw Error('Некорректный ответ wall.get; новости не изменены.');
    if (page.count>offset && !page.items.length) throw Error('ВК вернул пустую страницу до конца архива; новости не изменены.');
    count = page.count;
    let added=0;
    for (const post of page.items) {
      if (!validPost(post)) throw Error('ВК вернул некорректную запись; новости не изменены.');
      owner ||= post.owner_id;
      if (owner !== post.owner_id) throw Error('Источник ВК изменился внутри выгрузки; новости не изменены.');
      const key = postKey(post);
      if (!observed.has(key)) added++;
      observed.add(key);
      if (shouldImport(post,config.mode)) {records.set(key,convertVkPost(post,tagMap));excluded.delete(key);}
      else {records.delete(key);excluded.add(key);}
    }
    pages++;
    offset += config.pageSize;
    const checkpoint = {schema_version:1,fingerprint,owner,next_offset:offset,source_count:count,observed:[...observed],excluded:[...excluded],records:[...records.values()]};
    await onCheckpoint(checkpoint);
    if (offset>=count) return {...checkpoint,complete:true,pages,resumed:Boolean(saved)};
    if (!added && page.items.length && offset > (saved?.next_offset || 0)) throw Error('ВК повторяет страницу архива; выгрузка остановлена без изменения новостей.');
    await pause(400);
  }
  throw Error('Сохранена часть архива: достигнут лимит страниц одного запуска. Следующий запуск продолжит перенос.');
}
function reconcile(existing, scan, state = {}, now = new Date().toISOString()) {
  const observed = new Set(scan.observed), excluded = new Set(scan.excluded);
  const previous = existing.filter(item => item.imported_from === 'vk' && item.vk_owner_id === scan.owner);
  const missing = previous.filter(item => !observed.has(item.id));
  const plausible = scan.complete && observed.size >= scan.source_count - 1 && (previous.length === 0 || missing.length/previous.length<=0.2);
  const confirmations = {}, removed = [];
  for (const item of missing) {
    confirmations[item.id] = plausible ? (state.missing_confirmations?.[item.id] || 0)+1 : 0;
    if (confirmations[item.id]>=2) removed.push(item.id);
  }
  for (const id of excluded) if (existing.some(item => item.id === id && item.imported_from === 'vk')) removed.push(id);
  const removalSet = new Set(removed);
  // Never retract editorial records or another wall's archive.
  const retained = existing.filter(item => item.imported_from !== 'vk' || item.vk_owner_id !== scan.owner || !removalSet.has(item.id));
  const merged = mergeImportedNews(retained,scan.records);
  return {merged, removed, state:{schema_version:1,owner_id:scan.owner,archive_complete:true,last_successful_sync:now,source_count:scan.source_count,observed_count:scan.observed.length,missing_confirmations:confirmations},deletion_review:!plausible && missing.length>0};
}
async function main() {
  if (!VK_TOKEN) throw Error('Не задан VK_TOKEN в GitHub Secrets.');
  const config = configuration(), existing = readJson(NEWS_PATH,[]);
  if (!Array.isArray(existing)) throw Error('data/news.json должен быть массивом.');
  const api = createApi({token:VK_TOKEN});
  const previousState = readJson(STATE_PATH,{});
  const scan = await scanWall({
    config, pending:readJson(PENDING_PATH,null), tagMap:loadTosHashtagMap(),
    fetchPage:(offset,count) => api('wall.get',{...(config.owner ? {owner_id:config.owner} : {domain:config.domain}),filter:'all',extended:'0',offset,count}),
    onCheckpoint:checkpoint => writeJson(PENDING_PATH,checkpoint)
  });
  const outcome = reconcile(existing,scan,previousState);
  const imported = outcome.merged.filter(item => item.imported_from === 'vk');
  const report = {schema_version:1,status:'complete',synced_at:outcome.state.last_successful_sync,mode:config.mode,domain:config.domain,owner_id:scan.owner,
    source_count:scan.source_count,unique_wall_posts:scan.observed.length,eligible_posts:scan.records.length,
    excluded_posts:scan.excluded.length,pages_this_run:scan.pages,resumed:scan.resumed,
    published_vk_posts:imported.length,canonical_posts:outcome.merged.length-imported.length,
    reposts:imported.filter(item => item.reposts?.length).length,photos:imported.reduce((n,item)=>n+(item.images?.length || 0),0),
    videos:imported.reduce((n,item)=>n+(item.attachments || []).filter(a=>a.type==='video').length,0),
    removed_ids:outcome.removed,deletion_review:outcome.deletion_review,media_storage:'vk_remote',archive_limit:null};
  writeJson(NEWS_PATH,outcome.merged);
  writeJson(STATE_PATH,outcome.state);
  writeJson(REPORT_PATH,report);
  writeJson(PENDING_PATH,null);
  console.log(JSON.stringify(report,null,2));
}
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = {extractHashtags,detectTosSlug,hasAllowedHashtag,stripServiceHashtags,makeTitle,formatDate,mergeImportedNews,
  configuration,shouldImport,convertVkPost,choosePhoto,createApi,scanWall,reconcile,postText,sortNews};
