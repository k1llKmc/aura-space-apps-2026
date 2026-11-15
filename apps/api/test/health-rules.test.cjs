const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zoneMetricCatalog } = require('@aura/shared-types');
const { zoneHealth } = require('../dist/modules/crew/crew.health');
const { baselineSchema, recordSchema } = require('../dist/modules/crew/health.schemas');
const now = new Date('2026-11-15T12:00:00Z');
function fixture(zone, patch = {}) {
  const [metric, unit] = Object.entries(zoneMetricCatalog[zone])[0];
  const rule = { metric, unit, baseline: 100, comparison: 'PERCENT', direction: 'BOTH', attentionDelta: 5, criticalDelta: 10, allowedSources: ['DIAGNOSTIC_DEVICE'], ...patch };
  const baseline = { id: 'baseline', baselineData: { schemaVersion: 1, rules: [rule] } };
  const record = { id: 'record', sourceType: 'DIAGNOSTIC_DEVICE', zone, metrics: { [metric]: 100 }, units: { [metric]: unit }, recordedAt: now };
  return { metric, unit, rule, baseline, record };
}
test('all five zones have explicit catalogue rules and exact deviation boundaries', () => {
  for (const zone of Object.keys(zoneMetricCatalog)) {
    const { metric, record, baseline } = fixture(zone);
    assert.equal(zoneHealth(zone, record, now, baseline).riskStatus, 'NOMINAL');
    record.metrics[metric] = 105;
    assert.equal(zoneHealth(zone, record, now, baseline).riskStatus, 'ATTENTION');
    record.metrics[metric] = 110;
    const critical = zoneHealth(zone, record, now, baseline);
    assert.equal(critical.riskStatus, 'CRITICAL'); assert.equal(critical.evidence[0].delta, 10);
    assert.ok(critical.evidence[0].reason.includes('critical >= 10'));
    record.recordedAt = new Date(now.getTime() - 8 * 86400000);
    const stale = zoneHealth(zone, record, now, baseline);
    assert.equal(stale.riskStatus, 'CRITICAL'); assert.equal(stale.dataState, 'STALE'); assert.equal(stale.status, 'CRITICAL');
  }
});
test('missing units, unsupported sources and legacy baseline never imply nominal health', () => {
  const { metric, unit, record, baseline } = fixture('HEAD_EYES');
  record.units[metric] = 'wrong';
  assert.equal(zoneHealth('HEAD_EYES', record, now, baseline).riskStatus, null);
  record.units[metric] = unit; record.sourceType = 'MANUAL_REPORT';
  assert.equal(zoneHealth('HEAD_EYES', record, now, baseline).riskStatus, null);
  assert.equal(zoneHealth('HEAD_EYES', record, now, { baselineData: { IOP: 15 } }).riskStatus, null);
  assert.equal(zoneHealth('HEAD_EYES', undefined, now, baseline).dataState, 'MISSING');
});
test('partial coverage keeps an observed critical risk but cannot produce nominal', () => {
  const { metric, record, baseline, rule } = fixture('HEAD_EYES');
  baseline.baselineData.rules.push({ ...rule, metric: 'visualAcuity', unit: 'ratio' });
  let result = zoneHealth('HEAD_EYES', record, now, baseline);
  assert.equal(result.riskStatus, null); assert.equal(result.assessmentComplete, false);
  record.metrics[metric] = 120;
  result = zoneHealth('HEAD_EYES', record, now, baseline);
  assert.equal(result.riskStatus, 'CRITICAL'); assert.equal(result.assessmentComplete, false);
});
test('direction, zero references, units and threshold ordering are validated', () => {
  const { metric, rule, record, baseline } = fixture('HEAD_EYES', { baseline: 0, comparison: 'ABSOLUTE', direction: 'INCREASE' });
  record.metrics[metric] = -100;
  assert.equal(zoneHealth('HEAD_EYES', record, now, baseline).riskStatus, 'NOMINAL');
  const valid = { zone: 'HEAD_EYES', reason: 'Synthetic test policy', rules: [rule] };
  assert.equal(baselineSchema.safeParse(valid).success, true);
  for (const invalid of [{ ...rule, comparison: 'PERCENT' }, { ...rule, criticalDelta: 4 }, { ...rule, allowedSources: [] }, { ...rule, unit: 'wrong' }]) {
    assert.equal(baselineSchema.safeParse({ ...valid, rules: [invalid] }).success, false);
  }
  assert.equal(recordSchema.safeParse({ zone: 'HEAD_EYES', sourceType: 'DIAGNOSTIC_DEVICE', metrics: { [metric]: 5 }, units: {}, symptoms: [] }).success, false);
});
