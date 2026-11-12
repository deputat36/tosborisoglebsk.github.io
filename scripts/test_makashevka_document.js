#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const toses = JSON.parse(fs.readFileSync('data/toses.json', 'utf8'));
const done = JSON.parse(fs.readFileSync('data/done.json', 'utf8'));
const profiles = JSON.parse(fs.readFileSync('data/tos_profiles.json', 'utf8'));
const tos = toses.find(row => row.slug === 'makashevka');
assert(tos, 'Makashevka must exist in the published catalog');
assert.equal(tos.founded, '2011');
assert.equal(tos.founded_month, 'сентябрь');
assert.equal(tos.population, '607');
assert.equal(tos.chairperson, 'Гробова Елена Николаевна');
assert.deepEqual(tos.phones, ['+7 (950) 754-30-53']);
assert.match(tos.contact_address, /с\. Макашевка, ул\. Коммуны, 5/);
assert.match(tos.boundaries, /село Макашевка/);
assert.equal(tos.social_links.length, 0, 'Do not invent VK and OK URLs from names alone');
const items = done.filter(row => row.tos_slug === 'makashevka' && row.status === 'published');
assert.equal(items.length, 7);
assert.deepEqual(items.map(row => Number(row.year)).sort(), [2016, 2017, 2019, 2021, 2022, 2022, 2023]);
assert.equal(new Set(items.map(row => row.id)).size, 7);
assert(items.every(row => row.content_origin === 'editorial' && /справк/i.test(row.source_label)));
assert(items.some(row => row.title.includes('Коханочка. Перезагрузка')));
assert(items.some(row => row.title.includes('Чистая вода')));
assert(items.some(row => row.title.includes('Любви и согласия')));
const profile = profiles.profiles.find(row => row.tos_slug === 'makashevka');
assert(profile, 'Makashevka profile missing');
assert(profile.clarifications.some(line => /Одноклассники/.test(line)));
const html = fs.readFileSync('tos/makashevka/index.html', 'utf8');
assert(html.includes('Гробова Елена Николаевна'));
assert(html.includes('+7 (950) 754-30-53'));
assert(html.includes('ул. Коммуны, 5'));
for(const item of items) {
  assert(html.includes(item.title), 'Missing in generated TOS page: ' + item.title);
}
console.log('Makashevka fact-sheet: 2011, 607 residents, chairman, address, contact and all 7 projects are included.');
