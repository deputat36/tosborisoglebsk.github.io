const assert = require('assert');
const { buildInventory, isCommunityLink, isPersonalProfileLink, recordFor } = require('./generate_publication_basis_inventory');

function trust(overrides = {}) {
  return {
    source_type: '',
    source_ref: '',
    checked_at: '',
    checked_by: '',
    recheck_after: '',
    verification_scope: [],
    publication_consent_ref: '',
    ...overrides
  };
}

function main() {
  assert.strictEqual(isPersonalProfileLink('https://vk.com/id12345'), true);
  assert.strictEqual(isPersonalProfileLink('https://ok.ru/profile/12345'), true);
  assert.strictEqual(isPersonalProfileLink('https://vk.com/club12345'), false);
  assert.strictEqual(isCommunityLink('https://vk.ru/public12345'), true);
  assert.strictEqual(isCommunityLink('https://m.ok.ru/group/12345'), true);
  assert.strictEqual(isCommunityLink('https://vk.com/id12345'), false);

  const legacy = recordFor({
    slug: 'legacy',
    title: 'ТОС «Legacy»',
    chairperson: 'Имя не выводится в отчёт',
    phones: ['+7 900 000-00-00'],
    emails: ['hidden@example.test'],
    chairperson_links: ['https://vk.com/id12345'],
    social_links: ['https://vk.com/club12345'],
    logo: '',
    trust: trust()
  });
  assert.strictEqual(legacy.basis_status, 'basis_review_required');
  assert.deepStrictEqual(legacy.personal_fields, ['chairperson', 'phones', 'emails', 'chairperson_links']);
  assert.strictEqual(legacy.personal_profile_count, 1);
  assert.strictEqual(legacy.community_count, 1);
  assert.strictEqual(Object.values(legacy).some((value) => String(value).includes('hidden@example.test')), false);

  const documented = recordFor({
    slug: 'documented',
    chairperson: 'Имя не выводится в отчёт',
    phones: ['+7 900 000-00-00'],
    emails: [],
    chairperson_links: [],
    social_links: [],
    logo: '',
    verification_status: 'partial',
    trust: trust({
      source_ref: 'source:documented:2026-07-14:01',
      publication_consent_ref: 'consent:documented:2026-07-14:01',
      verification_scope: ['chairperson', 'phones']
    })
  });
  assert.strictEqual(documented.basis_status, 'basis_documented');
  assert.deepStrictEqual(documented.missing_verification_scope, []);

  const publicOnly = recordFor({
    slug: 'public-only',
    chairperson: '',
    phones: [],
    emails: [],
    chairperson_links: [],
    social_links: ['https://vk.com/club12345'],
    logo: '',
    trust: trust()
  });
  assert.strictEqual(publicOnly.basis_status, 'no_personal_publication');
  assert.strictEqual(publicOnly.community_count, 1);

  const report = buildInventory([
    { slug: 'legacy', chairperson: 'Скрыто', phones: ['+7 900 000-00-00'], trust: trust() },
    { slug: 'public-only', social_links: ['https://vk.com/club12345'], trust: trust() }
  ]);
  assert.strictEqual(report.values_redacted, true);
  assert.strictEqual(report.metrics.cards_total, 2);
  assert.strictEqual(report.metrics.basis_review_required, 1);
  assert.strictEqual(report.metrics.no_personal_publication, 1);
  assert.strictEqual(JSON.stringify(report).includes('+7 900 000-00-00'), false);
  assert.strictEqual(JSON.stringify(report).includes('https://vk.com/club12345'), false);

  console.log('Publication basis inventory self-test OK');
}

main();
