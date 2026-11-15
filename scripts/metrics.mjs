export const WINDOWS = {week: 5, month: 21, quarter: 63};
export function analyze(points) {
  const valid = points.filter(p => Number.isFinite(p.close) && p.close > 0);
  if (valid.length < 64) throw new Error('Insufficient price history');
  const last = valid.at(-1);
  const dips = Object.fromEntries(Object.entries(WINDOWS).map(([key, n]) => {
    const window = valid.slice(-(n + 1));
    const peak = Math.max(...window.map(p => p.close));
    return [key, {dip: (last.close / peak - 1) * 100, peak, change: (last.close / window[0].close - 1) * 100}];
  }));
  return {price: last.close, date: last.date, dayChange: (last.close / valid.at(-2).close - 1) * 100, dips, history: valid.slice(-64)};
}
export function rank(stocks, market, window) {
  return stocks.filter(s => (market === 'all' || s.market === market) && s.dips[window].dip < 0)
    .sort((a,b) => a.dips[window].dip - b.dips[window].dip || a.symbol.localeCompare(b.symbol)).slice(0,5);
}
