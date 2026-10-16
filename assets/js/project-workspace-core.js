(function (root, factory) {
  const budget = typeof module === 'object' && module.exports ? require('./project-budget-core') : root.ProjectBudgetCore;
  const api = factory(budget);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ProjectWorkspaceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (budgetCore) {
  'use strict';
  const KEY = 'tos-project-workspace-v1';
  const FORMS = ['problem', 'support', 'passport', 'budget', 'schedule', 'partner-letter', 'checklist', 'photo-report', 'final-report'];
  const LABELS = {project:'Название проекта',territory:'ТОС / территория',responsible:'Ответственный',contact:'Контакт для связи',address:'Место реализации',start:'Начало',end:'Завершение',summary:'Краткая суть проекта',problem:'Проблема',goal:'Цель и ожидаемый результат',beneficiaries:'Кому полезен проект',maintenance:'Содержание результата',publicity:'Публикации и отчётность'};
  function fresh() { return {kind:'tos-project-workspace',version:1,revision:'',updated_at:'',common:{},documents:{},budget:null}; }
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function text(value, max = 12000) {
    if (typeof value !== 'string' || value.length > max) throw new Error('В файле есть неподходящее или слишком длинное значение.');
    return value;
  }
  function normalize(raw) {
    if (!object(raw) || raw.kind !== 'tos-project-workspace' || raw.version !== 1 || !object(raw.common) || !object(raw.documents)) throw new Error('Выберите файл проекта, скачанный на этой странице.');
    const result = fresh();
    result.revision = text(raw.revision || '', 100);
    result.updated_at = text(raw.updated_at || '', 100);
    for (const [key, value] of Object.entries(raw.common)) {
      if (!Object.hasOwn(LABELS, key)) throw new Error('Неизвестное общее поле проекта.');
      result.common[key] = text(value, ['summary','problem','goal','beneficiaries','maintenance','publicity'].includes(key) ? 12000 : 300);
    }
    for (const [form, fields] of Object.entries(raw.documents)) {
      if (!FORMS.includes(form) || !object(fields) || Object.keys(fields).length > 200) throw new Error('Неподходящий набор документов проекта.');
      result.documents[form] = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!/^[fc]\d{1,3}$/.test(key)) throw new Error('Неизвестное поле документа.');
        result.documents[form][key] = text(value);
      }
    }
    result.budget = raw.budget == null ? null : budgetCore.normalize(raw.budget);
    return result;
  }
  function budgetValues(state) {
    if (!state.budget) return null;
    const sums = budgetCore.calculate(state.budget);
    const active = state.budget.expenses.some(r => r.item || r.quantity || r.price) || state.budget.contributions.some(r => r.value) || state.budget.own || state.budget.partners;
    if (!active || !sums.valid) return null;
    return {cash:budgetCore.money(sums.cash),total:budgetCore.money(sums.total),request:budgetCore.money(sums.request),inkind:budgetCore.money(sums.inkind),own:budgetCore.money(budgetCore.decimal(state.budget.own,2).value),partners:budgetCore.money(budgetCore.decimal(state.budget.partners,2).value),funding:budgetCore.money(budgetCore.decimal(state.budget.own,2).value+budgetCore.decimal(state.budget.partners,2).value)};
  }
  return {KEY,FORMS,LABELS,fresh,normalize,budgetValues};
});
