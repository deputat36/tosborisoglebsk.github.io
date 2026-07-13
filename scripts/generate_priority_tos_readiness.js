const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const ROOT = process.cwd();
const TRACKING_PATH = path.join(ROOT, 'data', 'priority_tos_tracking_template.csv');
const REVIEW_PATH = path.join(ROOT, 'data', 'priority_tos_response_review.csv');
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const POLICY_PATH = path.join(ROOT, 'data', 'priority_tos_evidence_policy.json');
const OUT_PATH = path.join(ROOT, 'data', 'priority_tos_update_readiness.json');

const STAGES = {
  find_channel: { label: 'Найти канал связи', class_name: 'warn' },
  ready_to_send: { label: 'Готово к отправке', class_name: 'info' },
  awaiting_response: { label: 'Ожидаем ответ', class_name: 'info' },
  review_response: { label: 'Разобрать ответ', class_name: 'warn' },
  ready_partial: { label: 'Готово к частичному обновлению', class_name: 'ok' },
  ready_verified: { label: 'Готово к подтверждению', class_name: 'ok' },
  blocked: { label: 'Заблокировано', class_name: 'warn' }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function csvRecords(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const headers = (rows[0] || []).map((value) => String(value || '').replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] || '').trim();
    });
    return record;
  });
}

function hasSource(review) {
  return Boolean(review.public_source_url) || review.private_source_recorded === 'да';
}

function hasResponse(tracking, review) {
  return Boolean(tracking.reply_at || review.response_received_at) || tracking.current_status === 'Получено' || review.review_status !== 'Нет ответа';
}

function determineStage(tracking, review) {
  const decision = review.verification_decision;
  const reviewStatus = review.review_status;

  if (tracking.current_status === 'Заблокировано' || reviewStatus === 'Заблокировано' || decision === 'needs_review') return 'blocked';
  if (reviewStatus === 'Подтверждено' || decision === 'verified') return 'ready_verified';
  if (reviewStatus === 'Частично подтверждено' || (reviewStatus === 'Готово к обновлению' && decision === 'partial')) return 'ready_partial';
  if (reviewStatus === 'Готово к обновлению' && decision === 'verified') return 'ready_verified';
  if (reviewStatus === 'Требует разбора' || hasResponse(tracking, review)) return 'review_response';
  if (tracking.sent_at || ['Отправлено', 'Ожидаем ответ'].includes(tracking.current_status)) return 'awaiting_response';
  if (tracking.current_status === 'Готово к отправке' || tracking.contact_found === 'да') return 'ready_to_send';
  return 'find_channel';
}

function buildBlockers(stage, tracking, review) {
  const blockers = [];

  if (stage === 'find_channel') {
    if (tracking.contact_found !== 'да') blockers.push('Не найден рабочий канал связи');
    if (!tracking.sent_at) blockers.push('Запрос ещё не отправлен');
  }

  if (stage === 'ready_to_send' && !tracking.sent_at) blockers.push('Запрос ещё не отправлен');
  if (stage === 'awaiting_response') blockers.push('Ответ ещё не получен');

  if (stage === 'review_response') {
    if (!review.response_received_at && !tracking.reply_at) blockers.push('Не зафиксирована дата ответа');
    if (!review.response_source_type) blockers.push('Не указан тип источника');
    if (!hasSource(review)) blockers.push('Не зафиксирован публичный или закрытый источник');
    if (!review.verification_decision) blockers.push('Не принято решение редактора');
  }

  if (stage === 'blocked') blockers.push('Есть противоречие, недостаточный источник или запрет на публикацию');

  return blockers;
}

function nextAction(stage, tracking, review) {
  if (['review_response', 'ready_partial', 'ready_verified', 'blocked'].includes(stage) && review.next_step) return review.next_step;
  if (tracking.next_step) return tracking.next_step;

  const defaults = {
    find_channel: 'Найти рабочий канал связи',
    ready_to_send: 'Отправить подготовленный запрос и записать дату',
    awaiting_response: 'Дождаться ответа или отправить корректное напоминание',
    review_response: 'Разобрать ответ по реестру доказательств',
    ready_partial: 'Обновить только подтверждённые поля и сохранить статус partial',
    ready_verified: 'Обновить карточку и проверить условия статуса verified',
    blocked: 'Уточнить противоречия и получить дополнительный источник'
  };

  return defaults[stage] || 'Проверить рабочий статус';
}

function buildReport(generatedAt = new Date().toISOString()) {
  const trackingRows = csvRecords(TRACKING_PATH);
  const reviewRows = csvRecords(REVIEW_PATH);
  const toses = readJson(TOSES_PATH);
  const policy = readJson(POLICY_PATH);

  const trackingBySlug = new Map(trackingRows.map((row) => [row.slug, row]));
  const reviewBySlug = new Map(reviewRows.map((row) => [row.slug, row]));
  const tosBySlug = new Map(toses.map((item) => [item.slug, item]));

  const items = policy.slugs.map((slug) => {
    const tracking = trackingBySlug.get(slug) || {};
    const review = reviewBySlug.get(slug) || {};
    const tos = tosBySlug.get(slug) || {};
    const stage = determineStage(tracking, review);
    const stageMeta = STAGES[stage];

    return {
      slug,
      name: tos.title || tos.name || tracking.tos || slug,
      card_url: `/tos/${slug}/`,
      stage,
      stage_label: stageMeta.label,
      stage_class: stageMeta.class_name,
      tracking_status: tracking.current_status || '',
      review_status: review.review_status || '',
      sent_at: tracking.sent_at || '',
      response_received_at: review.response_received_at || tracking.reply_at || '',
      contact_channel_available: tracking.contact_found === 'да',
      response_received: hasResponse(tracking, review),
      source_recorded: hasSource(review),
      publication_consent_recorded: review.publication_consent_confirmed === 'да',
      verification_decision: review.verification_decision || '',
      blockers: buildBlockers(stage, tracking, review),
      next_action: nextAction(stage, tracking, review)
    };
  });

  const byStage = Object.keys(STAGES).reduce((result, stage) => {
    result[stage] = items.filter((item) => item.stage === stage).length;
    return result;
  }, {});

  return {
    generated_at: generatedAt,
    privacy_note: 'Отчёт содержит только рабочие статусы и признаки доказательств. Контакты, закрытая переписка, содержимое ответов и приватные источники в него не включаются.',
    stages: STAGES,
    summary: {
      total: items.length,
      by_stage: byStage,
      ready_for_card_update: byStage.ready_partial + byStage.ready_verified,
      waiting_external_action: byStage.find_channel + byStage.ready_to_send + byStage.awaiting_response
    },
    items
  };
}

function main() {
  const report = buildReport();
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Priority TOS readiness generated: ${report.summary.total} cards, ${report.summary.ready_for_card_update} ready for update`);
}

if (require.main === module) main();

module.exports = { STAGES, buildReport, determineStage, buildBlockers };
