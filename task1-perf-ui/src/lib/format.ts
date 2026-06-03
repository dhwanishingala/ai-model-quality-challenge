export function fmt(value: number, decimals = 1): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(decimals) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(decimals) + 'K';
  return value.toFixed(decimals);
}

export function fmtMs(ms: number): string {
  if (ms < 1) return ms.toFixed(2) + ' ms';
  if (ms < 100) return ms.toFixed(1) + ' ms';
  if (ms < 1000) return Math.round(ms) + ' ms';
  return (ms / 1000).toFixed(2) + ' s';
}

export function pct(value: number): string {
  return (value * 100).toFixed(0) + '%';
}
