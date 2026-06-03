import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useDataStore } from '../stores/dataStore';
import type { ConfigRow } from '../lib/types';
import { PROFILE_DESCRIPTIONS } from '../lib/types';
import { fmt, fmtMs, pct } from '../lib/format';

interface ModelSummary {
  name: string;
  genSpeed: number;
  ttftMs: number;
  throughput: number;
  rpm: number;
  costEfficiency: number;
  inputLength: number;
  outputLength: number;
  cachePercent: number;
  signal: 'go' | 'nogo';
}

function getSignal(row: ConfigRow): 'go' | 'nogo' {
  if (row.genSpeed >= 500 && row.ttftMs <= 100) return 'go';
  return 'nogo';
}

const SIGNAL_STYLES = {
  go: { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Go' },
  nogo: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700', label: 'No-Go' },
};

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9',
];

export default function CustomerView() {
  const models = useDataStore((s) => s.models);
  const selectedProfile = useDataStore((s) => s.selectedProfile);

  const summaries = useMemo(() => {
    const result: ModelSummary[] = [];
    for (const [name, model] of models) {
      const profile = model.profiles.get(selectedProfile);
      if (!profile || profile.configs.length === 0) continue;
      const row = profile.configs[0];
      result.push({
        name,
        genSpeed: row.genSpeed,
        ttftMs: row.ttftMs,
        throughput: row.throughput,
        rpm: row.rpm,
        costEfficiency: row.throughputPerBox,
        inputLength: row.inputLength,
        outputLength: row.outputLength,
        cachePercent: row.cachePercent,
        signal: getSignal(row),
      });
    }
    return result.sort((a, b) => b.genSpeed - a.genSpeed);
  }, [models, selectedProfile]);

  const chartData = useMemo(
    () => summaries.map((s) => ({ name: s.name, 'Gen Speed': s.genSpeed, TTFT: s.ttftMs, RPM: s.rpm })),
    [summaries]
  );

  const profileDesc = PROFILE_DESCRIPTIONS[selectedProfile] || `Profile ${selectedProfile}`;
  const profileDetail = summaries[0]
    ? `${fmt(summaries[0].inputLength, 0)} input tokens, ${fmt(summaries[0].outputLength, 0)} output, ${pct(summaries[0].cachePercent)} cache`
    : '';

  if (summaries.length === 0) {
    return <p className="text-gray-500 text-center py-12">No data for this profile. Upload perf sweeps or select a different profile.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800">{profileDesc}</h3>
        <p className="text-sm text-gray-500">{profileDetail}</p>
        <p className="text-xs text-gray-400 mt-1">Showing best config (lowest batch size) per model</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {summaries.map((s) => {
          const style = SIGNAL_STYLES[s.signal];
          return (
            <div key={s.name} className={`rounded-lg border p-4 ${style.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-lg text-gray-800">Model {s.name}</h4>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Gen Speed</dt>
                  <dd className="font-semibold text-gray-800">{fmt(s.genSpeed)} t/s/user</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">TTFT</dt>
                  <dd className="font-semibold text-gray-800">{fmtMs(s.ttftMs)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Throughput</dt>
                  <dd className="font-semibold text-gray-800">{fmt(s.throughput)} t/s</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">RPM</dt>
                  <dd className="font-semibold text-gray-800">{fmt(s.rpm)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Cost Efficiency</dt>
                  <dd className="font-semibold text-gray-800">{fmt(s.costEfficiency)} t/s/hw</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Generation Speed Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Gen Speed" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Time to First Token (ms)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="TTFT" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Requests Per Minute</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="RPM" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Cross-Profile Summary (all profiles, batch=10)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Model</th>
                {Array.from(new Set([...models.values()].flatMap(m => [...m.profiles.keys()]))).sort((a, b) => a - b).map(p => (
                  <th key={p} className="py-2 px-2 text-center">P{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const model = models.get(s.name)!;
                return (
                  <tr key={s.name} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">Model {s.name}</td>
                    {Array.from(new Set([...models.values()].flatMap(m => [...m.profiles.keys()]))).sort((a, b) => a - b).map(p => {
                      const profile = model.profiles.get(p);
                      const speed = profile?.configs[0]?.genSpeed;
                      return (
                        <td key={p} className="py-2 px-2 text-center tabular-nums">
                          {speed != null ? fmt(speed) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">Values: Gen Speed (t/s/user) at lowest batch size</p>
      </div>
    </div>
  );
}
