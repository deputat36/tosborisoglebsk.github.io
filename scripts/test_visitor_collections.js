const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const core = require('../assets/js/collection-browser-core');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const snapshot = (html, id) => html.match(new RegExp(`<!-- collection:${id}:start -->([\\s\\S]*?)<!-- collection:${id}:end -->`))?.[1] || '';

async function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-reader-'));
  try {
    for (const file of ['materials/index.html', 'news/index.html', 'done/index.html', 'data/articles.json', 'data/materials.json', 'data/news.json', 'data/done.json', 'data/toses.json', 'assets/js/news.js', 'assets/js/done.js']) {
      const target = path.join(fixture, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, file), target);
    }
    const news = JSON.parse(read('data/news.json'));
    const featuredId = read('news/index.html').match(/data-news-featured="([^"]+)"/)[1];
    const featured = news.find((item) => item.id === featuredId);
    featured.title = 'Новое название после уточнения';
    featured.lead = 'Новый результат <script>alert(1)</script> & источник';
    fs.writeFileSync(path.join(fixture, 'data/news.json'), JSON.stringify(news));
    const generate = () => execFileSync(process.execPath, [path.join(root, 'scripts/generate_collection_fallbacks.js')], { cwd: fixture });
    generate();

    const newsHtml = fs.readFileSync(path.join(fixture, 'news/index.html'), 'utf8');
    const highlighted = snapshot(newsHtml, 'news-featured');
    assert.ok(highlighted.includes(featured.title), 'an article update must reach the highlight');
    assert.ok(highlighted.includes('Новый результат &lt;script&gt;alert(1)&lt;/script&gt; &amp; источник'));
    assert.ok(!highlighted.includes('<script>'), 'dataset text must not become markup');
    assert.ok(snapshot(newsHtml, 'news-feed').includes(featured.title), 'feed and highlight must use the same record');

    const done = JSON.parse(read('data/done.json'));
    const defaultItems = done.filter((item) => item.status !== 'draft' && item.content_origin !== 'request');
    const doneHtml = fs.readFileSync(path.join(fixture, 'done/index.html'), 'utf8');
    const stories = snapshot(doneHtml, 'done-list');
    assert.equal((stories.match(/class="list-item done-story"/g) || []).length, defaultItems.length);
    for (const item of defaultItems) assert.ok(stories.includes(`/done/${item.id}/`), `missing readable result ${item.id}`);
    for (const item of done.filter((item) => item.status === 'draft' || item.content_origin === 'request')) assert.ok(!stories.includes(`/done/${item.id}/`), 'drafts and requests must stay out of the default result list');
    assert.ok(doneHtml.indexOf('id="done-list"') < doneHtml.indexOf('id="done-guide"'), 'results must precede instructions');
    assert.ok(stories.includes('<details>'), 'the account of the work remains available without scripts');

    const pages = ['news/index.html', 'done/index.html', 'materials/index.html'];
    const first = pages.map((file) => fs.readFileSync(path.join(fixture, file), 'utf8'));
    generate();
    first.forEach((html, index) => assert.equal(fs.readFileSync(path.join(fixture, pages[index]), 'utf8'), html, 'generating twice must not duplicate content'));
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }

  for (const failure of ['http', 'network', 'invalid-json']) {
    const saved = '<article>Сохранённая история</article>';
    const list = { innerHTML: saved, querySelector: () => ({}) };
    const search = { disabled: false };
    const status = { textContent: '' };
    const context = vm.createContext({
      window: { CollectionBrowserCore: core },
      document: { querySelector: (selector) => ({ '#done-list': list, '#done-search': search, '#done-filter-status': status }[selector] || null) },
      fetch: async () => {
        if (failure === 'network') throw new Error('offline');
        return { ok: failure !== 'http', json: async () => { throw new Error('invalid JSON'); } };
      }
    });
    await vm.runInContext(read('assets/js/done.js'), context);
    assert.equal(list.innerHTML, saved, `${failure}: keep the readable snapshot`);
    assert.equal(search.disabled, true, `${failure}: do not offer a nonworking search`);
    assert.ok(status.textContent.includes('сохранённые истории'));
    assert.ok(!status.textContent.includes('data/'));
  }
  console.log('Visitor collections OK: current highlight, escaped text, readable results, idempotence and three data failures');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
