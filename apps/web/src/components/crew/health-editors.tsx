'use client';
import { useState, type FormEvent } from 'react';
import {
  BodyZone,
  DataSourceType,
  zoneMetricCatalog,
  type BaselineRule,
  type AsyncTaskResponse,
  type BaselineResponse,
  type HealthRecordResponse,
} from '@aura/shared-types';
import { apiClient } from '@/services/api/client';
const inputClass =
  'mt-1 block w-full rounded border border-slate-600 bg-slate-800 p-2 text-white';
type RuleDraft = {
  metric: string;
  baseline: string;
  attention: string;
  critical: string;
  direction: BaselineRule['direction'];
  comparison: BaselineRule['comparison'];
  sources: DataSourceType[];
};
function draft(zone: BodyZone): RuleDraft {
  return {
    metric: Object.keys(zoneMetricCatalog[zone])[0],
    baseline: '',
    attention: '',
    critical: '',
    direction: 'BOTH',
    comparison: 'ABSOLUTE',
    sources: [],
  };
}
async function assessmentState(id?: string): Promise<string> {
  if (!id) return 'PENDING';
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await apiClient.get<AsyncTaskResponse>(`/jobs/${id}`);
    if (data.state === 'COMPLETED' || data.state === 'FAILED')
      return data.state;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return 'PENDING';
}
function assessmentMessage(state: string) {
  return state === 'COMPLETED'
    ? 'Assessment updated.'
    : state === 'FAILED'
      ? 'Assessment failed; your data is saved.'
      : 'Assessment is queued and will update automatically.';
}
export function HealthEditors({
  id,
  refresh,
}: {
  id: string;
  refresh: () => void;
}) {
  const [zone, setZone] = useState<BodyZone>('HEAD_EYES');
  const [recordZone, setRecordZone] = useState<BodyZone>('HEAD_EYES');
  const [rules, setRules] = useState<RuleDraft[]>([draft('HEAD_EYES')]);
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  function changeRule(index: number, patch: Partial<RuleDraft>) {
    setRules((values) =>
      values.map((value, at) =>
        at === index ? { ...value, ...patch } : value,
      ),
    );
  }
  async function baseline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const fields = new FormData(event.currentTarget);
    try {
      const { data } = await apiClient.post<BaselineResponse>(
        `/crew/${id}/baselines`,
        {
          zone,
          reason: fields.get('reason'),
          rules: rules.map((item) => ({
            metric: item.metric,
            unit: zoneMetricCatalog[zone][item.metric],
            baseline: Number(item.baseline),
            attentionDelta: Number(item.attention),
            criticalDelta: Number(item.critical),
            direction: item.direction,
            comparison: item.comparison,
            allowedSources: item.sources,
          })),
        },
      );
      const state = await assessmentState(data.assessmentJobId).catch(
        () => 'PENDING',
      );
      setSuccess(`Reference version saved. ${assessmentMessage(state)}`);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save reference.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const form = event.currentTarget,
      fields = new FormData(form);
    const metrics: Record<string, number> = {},
      units: Record<string, string> = {};
    for (const [key, unit] of Object.entries(zoneMetricCatalog[recordZone])) {
      const value = fields.get(key);
      if (typeof value === 'string' && value !== '') {
        metrics[key] = Number(value);
        units[key] = unit;
      }
    }
    try {
      const time = fields.get('recordedAt');
      const { data } = await apiClient.post<HealthRecordResponse>(
        `/crew/${id}/records`,
        {
          zone: recordZone,
          sourceType: fields.get('sourceType'),
          metrics,
          units,
          symptoms: String(fields.get('symptoms') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          ...(time ? { recordedAt: new Date(String(time)).toISOString() } : {}),
        },
      );
      const state = await assessmentState(data.assessmentJobId).catch(
        () => 'PENDING',
      );
      form.reset();
      setSuccess(`Measurement saved. ${assessmentMessage(state)}`);
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to save measurement.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border border-cyan-900 bg-slate-900 p-5 text-sm text-slate-300">
      <h3 className="text-xl text-white">Medical operator tools</h3>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-emerald-300">
          {success}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-cyan-300">
          Configure reference rules
        </summary>
        <p className="mt-3">
          Define reviewed limits for this crew member. Saving creates a new
          version for the selected zone and replaces the active rule set. These
          limits indicate deviations for review.
        </p>
        <form onSubmit={baseline} className="mt-4 space-y-4">
          <label className="block">
            Reference zone
            <select
              value={zone}
              className={inputClass}
              onChange={(event) => {
                const next = event.target.value as BodyZone;
                setZone(next);
                setRules([draft(next)]);
              }}
            >
              {Object.values(BodyZone).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {rules.map((item, index) => (
            <fieldset
              key={index}
              className="grid gap-3 rounded border border-slate-700 p-3 sm:grid-cols-2"
            >
              <legend className="px-2">Comparison {index + 1}</legend>
              <label>
                Metric
                <select
                  value={item.metric}
                  className={inputClass}
                  onChange={(event) =>
                    changeRule(index, { metric: event.target.value })
                  }
                >
                  {Object.entries(zoneMetricCatalog[zone]).map(
                    ([key, unit]) => (
                      <option key={key} value={key}>
                        {key} ({unit})
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Baseline value
                <input
                  required
                  type="number"
                  step="any"
                  className={inputClass}
                  value={item.baseline}
                  onChange={(event) =>
                    changeRule(index, { baseline: event.target.value })
                  }
                />
              </label>
              <label>
                Comparison
                <select
                  aria-label={`Comparison ${index + 1}`}
                  className={inputClass}
                  value={item.comparison}
                  onChange={(event) =>
                    changeRule(index, {
                      comparison: event.target.value as RuleDraft['comparison'],
                    })
                  }
                >
                  <option value="ABSOLUTE">
                    Absolute change ({zoneMetricCatalog[zone][item.metric]})
                  </option>
                  <option value="PERCENT">Percentage change (%)</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  className={inputClass}
                  value={item.direction}
                  onChange={(event) =>
                    changeRule(index, {
                      direction: event.target.value as RuleDraft['direction'],
                    })
                  }
                >
                  <option value="BOTH">Increase or decrease</option>
                  <option value="INCREASE">Increase only</option>
                  <option value="DECREASE">Decrease only</option>
                </select>
              </label>
              <label>
                Attention deviation
                <input
                  required
                  type="number"
                  step="any"
                  min="0"
                  className={inputClass}
                  value={item.attention}
                  onChange={(event) =>
                    changeRule(index, { attention: event.target.value })
                  }
                />
              </label>
              <label>
                Critical deviation
                <input
                  required
                  type="number"
                  step="any"
                  min="0"
                  className={inputClass}
                  value={item.critical}
                  onChange={(event) =>
                    changeRule(index, { critical: event.target.value })
                  }
                />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <p>Approved measurement sources</p>
                {Object.values(DataSourceType).map((source) => (
                  <label
                    key={source}
                    className="mr-3 inline-flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={item.sources.includes(source)}
                      onChange={(event) =>
                        changeRule(index, {
                          sources: event.target.checked
                            ? [...item.sources, source]
                            : item.sources.filter((value) => value !== source),
                        })
                      }
                    />
                    {source.replaceAll('_', ' ')}
                  </label>
                ))}
              </div>
              {rules.length > 1 && (
                <button
                  type="button"
                  className="text-left text-red-300"
                  onClick={() =>
                    setRules((values) => values.filter((_, at) => at !== index))
                  }
                >
                  Remove comparison
                </button>
              )}
            </fieldset>
          ))}
          <button
            type="button"
            disabled={
              rules.length >= Object.keys(zoneMetricCatalog[zone]).length
            }
            className="text-cyan-300 disabled:opacity-40"
            onClick={() =>
              setRules((values) => [
                ...values,
                {
                  ...draft(zone),
                  metric:
                    Object.keys(zoneMetricCatalog[zone]).find(
                      (metric) =>
                        !values.some((rule) => rule.metric === metric),
                    ) || draft(zone).metric,
                },
              ])
            }
          >
            Add metric comparison
          </button>
          <label className="block">
            Reason for this reference version
            <textarea
              name="reason"
              required
              maxLength={2000}
              className={inputClass}
            />
          </label>
          <button
            disabled={busy}
            className="rounded bg-cyan-300 px-4 py-2 text-slate-950 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save reference version'}
          </button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer text-cyan-300">
          Add measurement
        </summary>
        <form onSubmit={record} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            Measurement zone
            <select
              value={recordZone}
              className={inputClass}
              onChange={(event) =>
                setRecordZone(event.target.value as BodyZone)
              }
            >
              {Object.values(BodyZone).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Measurement source"
              name="sourceType"
              className={inputClass}
            >
              {Object.values(DataSourceType).map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          {Object.entries(zoneMetricCatalog[recordZone]).map(([key, unit]) => (
            <label key={key}>
              {key} ({unit})
              <input
                type="number"
                step="any"
                name={key}
                className={inputClass}
              />
            </label>
          ))}
          <label>
            Observed at (optional, local time)
            <input
              type="datetime-local"
              name="recordedAt"
              className={inputClass}
            />
          </label>
          <label>
            Symptoms (comma-separated)
            <input name="symptoms" maxLength={2000} className={inputClass} />
          </label>
          <p className="sm:col-span-2">
            Enter at least one value. Fill every configured metric to obtain a
            complete comparison. Select the actual source of the measurement.
          </p>
          <button
            disabled={busy}
            className="rounded bg-cyan-300 px-4 py-2 text-slate-950 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save measurement'}
          </button>
        </form>
      </details>
    </section>
  );
}
