const fs = require('node:fs');
const assert = require('node:assert/strict');
const { grantCard, grantOrganizationLink } = require('../assets/js/grants');
const orgs = JSON.parse(fs.readFileSync('data/support_organizations.json'));
const grants = JSON.parse(fs.readFileSync('data/grants.json')).filter(item => item.status !== 'draft');
const hub = fs.readFileSync('grants/index.html', 'utf8');
const paths = new Set(orgs.map(org => `/grants/${org.slug}/`));
assert.equal(orgs.length, 3);
assert.equal(paths.size, orgs.length);
for (const org of orgs) {
  assert(org.sources.length >= 3, 'each profile has inspectable sources');
  org.sources.forEach(source => assert.equal(new URL(source.url).protocol, 'https:'));
  const html = fs.readFileSync(`grants/${org.slug}/index.html`, 'utf8');
  assert(html.includes(`href="https://tosborisoglebsk.ru/grants/${org.slug}/"`));
  assert(html.includes('Источники и границы проверки'));
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert(!html.includes('<form'), 'profiles do not collect application or identity data');
  assert(hub.includes(`/grants/${org.slug}/`), 'profiles are reachable from the support hub');
}
for (const item of grants) {
  assert(hub.includes(`id="grant-${item.id}"`), 'every opportunity is readable without JavaScript');
  if (item.organization_url) assert(paths.has(item.organization_url), 'no link to an unknown organization');
}
const local = orgs.find(org => org.id === 'budushchee-borisoglebska');
assert(local.sections.some(section => section.paragraphs.some(text => text.includes('Содержание вложений ВК'))), 'unchecked eligibility remains visible');
const mini = grants.find(item => item.id === 'obraz-tos-mini-2026-october');
assert(mini.best_for.includes('Благоустройство и инфраструктурные работы исключены'));
assert.equal(grantOrganizationLink({organization_url:'javascript:alert(1)'}), '');
assert.equal(grantOrganizationLink({organization_url:'//example.org'}), '');
assert(!grantCard({id:'test',title:'<script>1</script>',project_links:[],prepare:[]}).includes('<script>'));
console.log(`Support profiles OK: ${orgs.length}, ${grants.length} static opportunities, source boundaries and safe links`);
