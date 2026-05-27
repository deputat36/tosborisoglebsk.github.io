const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const VK_TOKEN = process.env.VK_TOKEN || '';

const VK_DOMAIN = String(process.env.VK_DOMAIN || 'tosbgo')
  .replace('https://vk.ru/', '')
  .replace('https://vk.com/', '')
  .replace('vk.ru/', '')
  .replace('vk.com/', '')
  .replace('@', '')
  .replaceAll('/', '')
  .trim();

const VK_API_VERSION = '5.199';
const COUNT = 30;

if (!VK_TOKEN) {
  console.error('Ошибка: не задан VK_TOKEN. Для wall.get нужен пользовательский токен ВК.');
  process.exit(1);
}

if (!VK_DOMAIN) {
  console.error('Ошибка: не задан VK_DOMAIN');
  console.error('Нужно значение вида: tosbgo');
  process.exit(1);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Не удалось разобрать JSON от VK API: ${error.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

function cleanText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getBestPhotoUrl(photo) {
  if (!photo || !Array.isArray(photo.sizes)) return '';

  const sizes = [...photo.sizes].sort((a, b) => {
    return (b.width || 0) - (a.width || 0);
  });

  return sizes[0]?.url || '';
}

function allImages(attachments = []) {
  const result = [];

  for (const attachment of attachments) {
    if (attachment.type !== 'photo') continue;

    const url = getBestPhotoUrl(attachment.photo);
    if (url) result.push(url);
  }

  return result;
}

function normalizePost(post) {
  const text = cleanText(post.text);
  const images = allImages(post.attachments || []);
  const date = new Date((post.date || 0) * 1000).toISOString();

  return {
    id: `vk-${Math.abs(post.owner_id)}-${post.id}`,
    vk_owner_id: post.owner_id,
    vk_post_id: post.id,
    date,
    date_short: date.slice(0, 10),
    title: text ? text.split('\n')[0].slice(0, 120) : 'Публикация ВКонтакте',
    text,
    image: images[0] || '',
    images,
    likes: post.likes?.count || 0,
    reposts: post.reposts?.count || 0,
    comments: post.comments?.count || 0,
    views: post.views?.count || 0,
    source: 'ВК-сообщество ТОС БГО',
    source_url: `https://vk.ru/wall${post.owner_id}_${post.id}`,
    imported_at: new Date().toISOString()
  };
}

async function main() {
  console.log(`VK domain: ${VK_DOMAIN}`);
  console.log(`VK API version: ${VK_API_VERSION}`);
  console.log('VK import mode: user token wall request');

  const params = new URLSearchParams({
    domain: VK_DOMAIN,
    count: String(COUNT),
    filter: 'owner',
    access_token: VK_TOKEN,
    v: VK_API_VERSION
  });

  const url = `https://api.vk.com/method/wall.get?${params.toString()}`;
  const data = await requestJson(url);

  if (data.error) {
    console.error('Ошибка VK API:');
    console.error(JSON.stringify(data.error, null, 2));

    if (data.error.error_code === 27) {
      console.error('В VK_TOKEN сейчас, вероятно, токен сообщества. Нужен пользовательский токен ВК.');
    }

    if (data.error.error_code === 5) {
      console.error('VK_TOKEN неверный, устарел или не имеет нужного доступа.');
    }

    if (data.error.error_code === 100) {
      console.error('Вероятная причина: неверный VK_DOMAIN. Нужно значение вида: tosbgo');
    }

    process.exit(1);
  }

  const posts = (data.response?.items || [])
    .filter((post) => !post.is_pinned)
    .filter((post) => !post.marked_as_ads)
    .filter((post) => post.text || (post.attachments || []).length)
    .map(normalizePost);

  const output = {
    generated_at: new Date().toISOString(),
    source: `https://vk.ru/${VK_DOMAIN}`,
    count: posts.length,
    posts
  };

  const file = path.join(ROOT, 'data', 'vk_posts.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Imported VK posts: ${posts.length}`);
}

main().catch((error) => {
  console.error('Ошибка импорта VK posts:');
  console.error(error);
  process.exit(1);
});
