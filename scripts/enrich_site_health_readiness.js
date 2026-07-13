const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const READINESS_PATH = path.join(ROOT, 'data', 'priority_tos_update_readiness.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listNames(items) {
  const names = items.map((item) => item.name).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

function actionForStage(stage, items) {
  const count = items.length;
  const names = listNames(items);
  const labels = {
    find_channel: `Найти рабочий канал связи для ${count} карточек: ${names}.`,
    ready_to_send: `После разрешения пользователя вручную отправить ${count} подготовленных запроса: ${names}.`,
    awaiting_response: `Проверить ожидание ответа и при необходимости подготовить корректное напоминание для ${count} карточек: ${names}.`,
    review_response: `Разобрать полученные ответы и зафиксировать доказательства для ${count} карточек: ${names}.`,
    ready_partial: `Обновить только подтверждённые поля и сохранить статус partial для ${count} карточек: ${names}.`,
    ready_verified: `Обновить карточки и проверить все условия статуса verified для ${count} карточек: ${names}.`,
    blocked: `Устранить противоречия или получить дополнительный источник для ${count} карточек: ${names}.`
  };
  return labels[stage] || '';
}

function readinessActions(readiness) {
  const items = Array.isArray(readiness.items) ? readiness.items : [];
  return Object.keys(readiness.stages || {})
    .map((stage) => actionForStage(stage, items.filter((item) => item.stage === stage)))
    .filter(Boolean);
}

function safeReadinessItem(item) {
  return {
    stage: item.stage,
    stage_label: item.stage_label,
    stage_class: item.stage_class,
    tracking_status: item.tracking_status,
    review_status: item.review_status,
    sent_at: item.sent_at,
    response_received_at: item.response_received_at,
    contact_channel_available: Boolean(item.contact_channel_available),
    response_received: Boolean(item.response_received),
    source_recorded: Boolean(item.source_recorded),
    publication_consent_recorded: Boolean(item.publication_consent_recorded),
    verification_decision: item.verification_decision,
    blockers: Array.isArray(item.blockers) ? item.blockers : [],
    next_action: item.next_action
  };
}

function main() {
  if (!fs.existsSync(SITE_HEALTH_PATH)) throw new Error(`Missing file: ${SITE_HEALTH_PATH}`);
  if (!fs.existsSync(READINESS_PATH)) throw new Error(`Missing file: ${READINESS_PATH}`);

  const report = readJson(SITE_HEALTH_PATH);
  const readiness = readJson(READINESS_PATH);
  const readinessBySlug = new Map((readiness.items || []).map((item) => [item.slug, item]));

  report.priority_readiness = {
    generated_at: readiness.generated_at,
    privacy_note: readiness.privacy_note,
    stages: readiness.stages,
    summary: readiness.summary
  };

  report.priority_tos = (report.priority_tos || []).map((item) => {
    const readinessItem = readinessBySlug.get(item.slug);
    return readinessItem ? { ...item, readiness: safeReadinessItem(readinessItem) } : item;
  });

  const genericPatterns = [
    /^Закрыть \d+ карточки? ТОС с высоким приоритетом/,
    /^Повысить доверие к каталогу/,
    /^Уточнить телефоны или публичные контакты/,
    /^Добавить открытые страницы или сообщества/
  ];
  const retainedActions = (report.recommended_actions || []).filter(
    (action) => !genericPatterns.some((pattern) => pattern.test(action))
  );
  report.recommended_actions = [...readinessActions(readiness), ...retainedActions];

  report.findings = (report.findings || []).filter((item) => item.area !== 'Операционная готовность');
  const readinessSummary = readiness.summary || {};
  report.findings.push({
    level: readinessSummary.ready_for_card_update > 0 ? 'next' : 'risk',
    area: 'Операционная готовность',
    finding: `Готовы к обновлению: ${readinessSummary.ready_for_card_update || 0} из ${readinessSummary.total || 0}. Внешнего действия ожидают: ${readinessSummary.waiting_external_action || 0}.`
  });

  const trustStage = (report.self_work_plan || []).find((item) => item.stage === 'Доверие к каталогу');
  if (trustStage) {
    trustStage.status = readinessSummary.ready_for_card_update > 0 ? 'active' : 'blocked_by_confirmation';
    trustStage.actions = readinessActions(readiness).map((action) => action.replace(/\.$/, '').toLowerCase());
  }

  fs.writeFileSync(SITE_HEALTH_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Site health readiness enriched: ${readinessSummary.total || 0} priority cards, ${readinessSummary.ready_for_card_update || 0} ready for update`);
}

main();
