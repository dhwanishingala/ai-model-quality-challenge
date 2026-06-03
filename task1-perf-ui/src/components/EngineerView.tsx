import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { useDataStore } from '../stores/dataStore';
import type { ConfigRow } from '../lib/types';
import { COLUMN_LABELS, PROFILE_DESCRIPTIONS } from '../lib/types';
import { fmt, fmtMs } from '../lib/format';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9',
];

type SortField = keyof ConfigRow | 'modelName';
type SortDir = 'asc' | 'desc';

interface FlatRow extends ConfigRow {
  modelName: string;
  profileNumber: number;
}

export default function EngineerView() {
  const models = useDataStore((s) => s.models);
  const selectedProfile = useDataStore((s) => s.selectedProfile);
  const [sortField, setSortField] = useState<SortField>('modelName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [metricY, setMetricY] = useState<keyof ConfigRow>('genSpeed');

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const [name, model] of models) {
      const profile = model.profiles.get(selectedProfile);
      if (!profile) continue;
      for (const config of profile.configs) {
        rows.push({ ...config, modelName: name, profileNumber: selectedProfile });
      }
    }
    return rows;
  }, [models, selectedProfile]);

  const sorted = useMemo(() => {
    return [...flatRows].sort((a, b) => {
      const av = a[sortField as keyof FlatRow];
      const bv = b[sortField as keyof FlatRow];
      if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return 0;
    });
  }, [flatRows, sortField, sortDir]);

  const batchScalingData = useMemo(() => {
    const names = [...new Set(flatRows.map((r) => r.modelName))].sort();
    const batchSizes = [...new Set(flatRows.map((r) => r.batchSize))].sort((a, b) => a - b);
    return names.map((name) => {
      const point: Record<string, number | string> = { model: `Model ${name}` };
      for (const bs of batchSizes) {
        const row = flatRows.find((r) => r.modelName === name && r.batchSize === bs);
        if (row) point[`BS ${bs}`] = row[metricY];
      }
      return point;
    });
  }, [flatRows, metricY]);

  const batchSizes = useMemo(
    () => [...new Set(flatRows.map((r) => r.batchSize))].sort((a, b) => a - b),
    [flatRows]
  );

  const scatterData = useMemo(() => {
    return flatRows
      .filter((r) => r.batchSize === flatRows[0]?.batchSize)
      .map((r) => ({ name: r.modelName, throughput: r.throughput, genSpeed: r.genSpeed, ttft: r.ttftMs }));
  }, [flatRows]);

  const heatmapData = useMemo(() => {
    const modelNames = [...models.keys()].sort();
    const profiles = new Set<number>();
    for (const m of models.values()) for (const p of m.profiles.keys()) profiles.add(p);
    const profileNums = [...profiles].sort((a, b) => a - b);

    return { modelNames, profileNums, cells: modelNames.map(name => {
      const model = models.get(name)!;
      return profileNums.map(p => {
        const prof = model.profiles.get(p);
        return prof?.configs[0]?.[metricY] ?? null;
      });
    })};
  }, [models, metricY]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const tableColumns: (keyof ConfigRow)[] = [
    'batchSize',
    'genSpeed', 'ttftMs', 'throughput', 'throughputPerBox', 'rpm',
    'promptOnlyThroughput', 'genOnlyThroughput',
    'uncachedThroughput', 'cachedThroughput',
    'realPromptSpeed', 'promptSpeedWithQueueing',
    'maxMs', 'targetMaxMs',
    'uncachedThroughputPerBox', 'cachedThroughputPerBox',
  ];

  const groupedByModel = useMemo(() => {
    const groups: { modelName: string; rows: FlatRow[] }[] = [];
    const modelOrder = [...new Set(sorted.map((r) => r.modelName))];
    for (const name of modelOrder) {
      groups.push({ modelName: name, rows: sorted.filter((r) => r.modelName === name) });
    }
    return groups;
  }, [sorted]);

  const metricOptions: (keyof ConfigRow)[] = [
    'genSpeed', 'ttftMs', 'throughput', 'throughputPerBox', 'rpm',
    'promptOnlyThroughput', 'genOnlyThroughput', 'realPromptSpeed',
  ];

  if (flatRows.length === 0) {
    return <p className="text-gray-500 text-center py-12">No data for this profile.</p>;
  }

  const allValues = heatmapData.cells.flat().filter((v): v is number => v !== null);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const heatColor = (v: number | null) => {
    if (v === null) return '#f3f4f6';
    const ratio = maxVal === minVal ? 0.5 : (v - minVal) / (maxVal - minVal);
    const isInverse = metricY === 'ttftMs';
    const t = isInverse ? 1 - ratio : ratio;
    const r = Math.round(239 - t * 180);
    const g = Math.round(68 + t * 150);
    const b = Math.round(68);
    return `rgb(${r},${g},${b})`;
  };

  const profileInfo = flatRows[0];

  return (
    <div className="space-y-6">
      {profileInfo && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {PROFILE_DESCRIPTIONS[selectedProfile] || `Profile ${selectedProfile}`}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {fmt(profileInfo.inputLength, 0)} input tokens, {fmt(profileInfo.outputLength, 0)} output, {(profileInfo.cachePercent * 100).toFixed(0)}% cache
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Metric:</label>
        <select
          value={metricY}
          onChange={(e) => setMetricY(e.target.value as keyof ConfigRow)}
          className="text-sm border rounded px-2 py-1"
        >
          {metricOptions.map((m) => (
            <option key={m} value={m}>{COLUMN_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {/* Full data table — grouped by model */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-700 p-4 pb-2">Configuration Details</h3>
        <p className="text-xs text-gray-400 px-4 pb-2">
          Per-batch-size configurations. Profile constants (Input/Output/Cache) are shown in the banner above.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th
                  className="py-2 px-3 text-left cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50 z-10"
                  onClick={() => toggleSort('modelName')}
                >
                  Model {sortField === 'modelName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                {tableColumns.map((col) => (
                  <th
                    key={col}
                    className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => toggleSort(col)}
                  >
                    {COLUMN_LABELS[col]} {sortField === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedByModel.map((group) =>
                group.rows.map((row, ri) => (
                  <tr
                    key={`${group.modelName}-${ri}`}
                    className={`hover:bg-gray-50 ${ri === 0 ? 'border-t-2 border-gray-200' : 'border-t border-gray-100'}`}
                  >
                    <td className="py-1.5 px-3 font-medium sticky left-0 bg-white z-10">
                      {ri === 0 ? `Model ${group.modelName}` : ''}
                    </td>
                    {tableColumns.map((col) => (
                      <td key={col} className="py-1.5 px-3 text-right tabular-nums">
                        {col === 'cachePercent'
                          ? (row[col] * 100).toFixed(0) + '%'
                          : col === 'ttftMs'
                          ? fmtMs(row[col])
                          : typeof row[col] === 'number'
                          ? fmt(row[col])
                          : row[col]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch scaling chart */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Batch Size Scaling — {COLUMN_LABELS[metricY]}
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={batchScalingData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="model" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {batchSizes.map((bs, i) => (
              <Bar key={bs} dataKey={`BS ${bs}`} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Throughput vs Gen Speed scatter */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Throughput vs Gen Speed (lowest batch)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="throughput" name="Throughput" tick={{ fontSize: 12 }} type="number" />
            <YAxis dataKey="genSpeed" name="Gen Speed" tick={{ fontSize: 12 }} type="number" />
            <ZAxis dataKey="ttft" range={[40, 200]} name="TTFT" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border rounded p-2 text-xs shadow">
                  <p className="font-bold">Model {d.name}</p>
                  <p>Throughput: {fmt(d.throughput)} t/s</p>
                  <p>Gen Speed: {fmt(d.genSpeed)} t/s/user</p>
                  <p>TTFT: {fmtMs(d.ttft)}</p>
                </div>
              );
            }} />
            <Scatter data={scatterData} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {scatterData.map((d, i) => (
            <span key={d.name} className="text-xs flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {d.name}
            </span>
          ))}
        </div>
      </div>

      {/* Profile heatmap */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Models x Profiles Heatmap — {COLUMN_LABELS[metricY]}
        </h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="py-1 px-2" />
                {heatmapData.profileNums.map((p) => (
                  <th key={p} className="py-1 px-2 text-center font-medium">
                    P{p}
                    <div className="text-[10px] font-normal text-gray-400">{PROFILE_DESCRIPTIONS[p]?.split(' ')[0] || ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.modelNames.map((name, mi) => (
                <tr key={name}>
                  <td className="py-1 px-2 font-medium whitespace-nowrap">Model {name}</td>
                  {heatmapData.cells[mi].map((val, pi) => (
                    <td
                      key={pi}
                      className="py-1 px-2 text-center tabular-nums text-white font-medium"
                      style={{ backgroundColor: heatColor(val), minWidth: 60 }}
                    >
                      {val !== null ? fmt(val) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: heatColor(minVal) }} />
          Low
          <span className="w-3 h-3 rounded" style={{ backgroundColor: heatColor(maxVal) }} />
          High
          {metricY === 'ttftMs' && <span>(inverted: lower is better)</span>}
        </div>
      </div>
    </div>
  );
}
