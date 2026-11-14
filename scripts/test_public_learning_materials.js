const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = (process.env.VISUAL_BASELINE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const output = '.artifacts/visual-baseline/learning-materials';
const routes = [
  ['meeting', '/meeting-kit/', 'На чём основаны рекомендации'],
  ['resources', '/materials/community-resource-map/', 'Источники и границы применения'],
  ['future', '/materials/territory-future-workshop/', 'Источники и границы применения'],
  ['zhkh-guide', '/residents/zhkh/', 'На чём основаны рекомендации'],
  ...JSON.parse(fs.readFileSync('data/articles.json', 'utf8')).filter(article => article.topic === 'zhkh')
    .map(article => [article.id, `/materials/${article.id}/`, 'Источники и границы применения']),
  ['support-index', '/grants/', 'Грантодатели и организации поддержки ТОС'],
  ['learning-route','/chairperson/learning/','Шесть шагов: от идеи ТОС до отчёта'],
  ['contest-check','/grant-application-kit/?opportunity=pfki-2027-second#contest-check','Проверить комплект по конкретному конкурсу'],
  ['result-packet','/documents/templates/project-kit/?packet=result','Проект ТОС: от проблемы до отчёта'],
  ...JSON.parse(fs.readFileSync('data/support_organizations.json', 'utf8'))
    .map(org => [`support-${org.id}`, `/grants/${org.slug}/`, 'Источники и границы проверки'])
];

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const mode of ['desktop', 'mobile', 'without-js']) {
      const context = await browser.newContext({ viewport: { width: mode === 'desktop' ? 1280 : 375, height: 900 }, javaScriptEnabled: mode !== 'without-js' });
      const page = await context.newPage();
      for (const [id, route, sourcesHeading] of routes) {
        try {
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const response = await page.goto(base + route, { waitUntil: 'networkidle' });
          assert(response.ok());
          assert.equal(await page.locator('main h1').count(), 1);
          assert(await page.getByRole('heading', { name: sourcesHeading, exact: true }).isVisible());
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'content fits a phone');
          if (id.startsWith('support-') && id !== 'support-index') {
            assert.equal(await page.locator('main h1').evaluate(node => node.scrollWidth > node.clientWidth + 1), false, 'organization title is readable without clipping');
          }
          if (id === 'meeting') {
            const summary = page.locator('summary', { hasText: 'Как отвечать на трудные реплики' });
            await summary.press('Enter');
            assert.equal(await summary.locator('..').getAttribute('open'), '', 'discussion help opens with the keyboard and without JavaScript');
            const file = await page.locator('a[download]').first().getAttribute('href');
            const download = await context.request.get(base + file);
            assert(download.ok());
            assert((await download.text()).includes('Рабочий лист не заменяет протокол'));
          }
          if (id === 'future') assert((await page.locator('main').innerText()).includes('Художественный рассказ'));
          if (id === 'zhkh-guide') {
            const worksheetLinks = await page.locator('main a[download]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href')))]);
            assert.equal(worksheetLinks.length, 8, 'all eight editable worksheets remain available from instructions and scenarios');
            assert.equal(await page.locator('main form').count(), 0, 'the guide does not submit personal data');
            const caseCount = JSON.parse(fs.readFileSync('data/zhkh_routes.json','utf8')).scenarios.length;
            assert.equal(await page.locator('[data-zhkh-case]').count(), caseCount, 'all routes are rendered without a data request');
            if (mode === 'without-js') {
              assert.equal(await page.locator('[data-zhkh-controls]').isVisible(), false);
              await page.locator('#zhkh-case-bill summary').press('Enter');
              assert.equal(await page.locator('#zhkh-case-bill details').getAttribute('open'), '', 'first steps open with a keyboard without scripts');
            } else {
              await page.getByLabel('Тип жилья', {exact:true}).selectOption('house');
              assert.equal(await page.locator('#zhkh-case-building').isVisible(), false, 'private house is not directed to MKD maintenance');
              assert.equal(await page.locator('#zhkh-case-capital').isVisible(), false, 'private house is not directed to MKD capital fund');
              assert(await page.locator('#zhkh-issue option[value="capital"]').isDisabled());
              await page.getByLabel('Ваш вопрос', {exact:true}).selectOption('bill');
              assert.equal(await page.locator('[data-zhkh-case]:visible').count(), 1);
              assert.equal(await page.locator('#zhkh-case-bill details').getAttribute('open'), '');
              assert(await page.locator('[data-zhkh-house-note]').isVisible());
              await page.getByRole('button', {name:'Сбросить выбор',exact:true}).click();
              assert.equal(await page.locator('[data-zhkh-case]:visible').count(), caseCount);
              assert.equal(await page.evaluate(() => document.activeElement.id), 'zhkh-housing', 'reset restores a useful keyboard focus');
              await page.getByLabel('Ваш вопрос', {exact:true}).selectOption('capital');
              await page.getByLabel('Тип жилья', {exact:true}).selectOption('house');
              assert.equal(await page.getByLabel('Ваш вопрос', {exact:true}).inputValue(), 'all', 'changing estate type clears an inapplicable prior question');
              await page.getByRole('button', {name:'Сбросить выбор',exact:true}).click();
            }
            for (const href of worksheetLinks) {
              const response = await context.request.get(base + href);
              assert(response.ok());
              assert((await response.text()).includes('Заполнение не отправляет обращение'));
            }
          }
          if (id === 'support-index') {
            assert.equal(await page.locator('#support-organizations .grid > article').count(), 3);
            assert.equal(await page.locator('#grants-list [data-grant-id]').count(), JSON.parse(fs.readFileSync('data/grants.json')).filter(item => item.status !== 'draft').length, 'all opportunities remain readable without JavaScript');
            if(mode!=='without-js'){
              await page.getByLabel('Кто подаёт',{exact:true}).selectOption('nonprofit');
              await page.getByLabel('Задача проекта',{exact:true}).selectOption('culture');
              assert.equal(await page.locator('#grants-list #grant-pfki-2027-second').count(),1,'a suitable legal form can find the cultural route');
              await page.getByLabel('Кто подаёт',{exact:true}).selectOption('tos-no-entity');
              assert.equal(await page.locator('#grants-list #grant-pfki-2027-second').count(),0,'an unincorporated TOS is not advertised as an eligible PFKI applicant');
              assert.equal(await page.locator('#grants-list #grant-fond-borisoglebsk-second-2026').count(),1,'unknown eligibility stays visible as a question');
              await page.reload({waitUntil:'networkidle'});
              assert.equal(await page.getByLabel('Кто подаёт',{exact:true}).inputValue(),'tos-no-entity');
              await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();
            }
          }
          if(id==='learning-route')assert.equal(await page.locator('.learning-card').count(),6);
          if(id==='contest-check'){
            assert.equal(await page.locator('#contest-check').count(),1,'there is one interactive root');
            if(mode==='without-js'){
              assert.equal(await page.locator('[data-contest-choice]').isVisible(),false);
              assert.equal(await page.locator('[data-contest-items] li').count(),7);
            }else{
              await page.locator('[data-contest-choice]').waitFor({state:'visible'});
              assert.equal(await page.locator('[data-contest-choice]').inputValue(),'pfki-2027-second');
              await page.locator('[data-contest-items] input').first().check();
              await page.getByLabel('Возможность и сезон',{exact:true}).selectOption('tos-voronezh-projects-2026');
              assert.equal(await page.locator('[data-contest-items] input:checked').count(),0);
              assert((await page.locator('[data-contest-state]').innerText()).includes('Завершённый сезон'));
              await page.getByLabel('Возможность и сезон',{exact:true}).selectOption('pfki-2027-second');
              assert.equal(await page.locator('[data-contest-items] input:checked').count(),1,'marks remain separate in this tab');
              const download=page.waitForEvent('download');
              await page.getByRole('button',{name:'Скачать список',exact:true}).click();
              const saved=await download;assert(fs.readFileSync(await saved.path(),'utf8').includes('23:30'));
            }
          }
          if(id==='result-packet'&&mode!=='without-js'){
            assert.deepEqual(await page.locator('[data-packet-document]:checked').evaluateAll(nodes=>nodes.map(node=>node.value)),['photo-report','final-report']);
            await page.locator('[data-packet-prepare]').click();
            await page.frameLocator('[data-packet-preview]').getByRole('heading',{name:'Подтверждения результата',exact:true}).waitFor();
          }
          const links = await page.locator('main a[href^="/"]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href').split('#')[0]))]);
          for (const href of links) assert((await context.request.get(base + href)).ok(), `destination available: ${href}`);
          assert.deepEqual(errors, []);
          if (mode !== 'without-js') {
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${output}/${id}-${mode}.png`, fullPage: true });
          }
          results.push({ mode, route, passed: true });
        } catch (error) {
          results.push({ mode, route, passed: false, error: error.message });
        } finally { page.removeAllListeners('pageerror'); }
      }
      await context.close();
    }
    const offline = await browser.newContext({ viewport: { width: 375, height: 900 } });
    await offline.route('**/data/grants.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    const fallbackPage = await offline.newPage();
    assert((await fallbackPage.goto(base + '/grants/', { waitUntil: 'networkidle' })).ok());
    assert.equal(await fallbackPage.locator('#grants-list [data-grant-id]').count(), JSON.parse(fs.readFileSync('data/grants.json')).filter(item => item.status !== 'draft').length);
    assert(await fallbackPage.getByText('Не удалось обновить список.', { exact: false }).isVisible());
    await fallbackPage.screenshot({ path: `${output}/support-failed-data-mobile.png`, fullPage: true });
    results.push({ mode: 'failed-data-mobile', route: '/grants/', passed: true });
    await offline.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results }, null, 2) + '\n');
  }
  const failed = results.filter(result => !result.passed);
  assert.equal(failed.length, 0, JSON.stringify(failed));
  console.log(`Learning materials: ${results.length}/${results.length}, desktop, mobile, keyboard, downloads and no JavaScript`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
