import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {analyze} from './metrics.mjs';
import {enrichReasons} from './reasons.mjs';
const OUTPUT = 'public/data/stocks.json';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function get(url) {
  let error;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const res = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch(e) {error=e;await sleep(1000 * (attempt+1));}
  }
  throw error;
}
function csvRows(text) {
  return text.trim().split(/\r?\n/).map(line => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(m=>(m[1]??m[2]).replaceAll('""','"')));
}
const rows = csvRows(await get('https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'));
const header = rows.shift();
const us = rows.map(r=>({symbol:r[header.indexOf('Symbol')].replaceAll('.','-'),name:r[header.indexOf('Security')],sector:r[header.indexOf('GICS Sector')],market:'US'}));
const fiConfig = JSON.parse(await readFile('config/helsinki.json','utf8'));
const fi = [...new Set(fiConfig.symbols)].map(s=>({symbol:s+'.HE',market:'FI'}));
const universe = [...us,...fi];
const stocks=[], failures=[];
let cursor=0;
async function worker() {
  while (cursor<universe.length) {
    const item = universe[cursor++];
    try {
      const raw = JSON.parse(await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?range=6mo&interval=1d`));
      const chart=raw.chart.result?.[0];
      if (!chart) throw new Error(raw.chart.error?.description || 'No chart');
      const closes = chart.indicators.adjclose?.[0]?.adjclose;
      const quotes = chart.indicators.quote?.[0]?.close;
      if (!closes || !quotes) throw new Error('No adjusted closes');
      // Keep the current session only when a valid adjusted close exists. Never mix raw and adjusted data.
      const points = chart.timestamp.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),close:closes[i]}));
      const metrics=analyze(points);
      if (Date.now()-Date.parse(metrics.date)>7*86400000) throw new Error('Stale quote');
      const lastIndex=points.findLastIndex(p=>p.date===metrics.date && Number.isFinite(p.close) && p.close>0);
      const price=quotes[lastIndex];
      if (!Number.isFinite(price) || price<=0) throw new Error('Invalid raw price');
      stocks.push({...item,name:item.name || chart.meta.longName || chart.meta.shortName || item.symbol,currency:chart.meta.currency,...metrics,price,adjustedPrice:metrics.price});
    } catch(e) {failures.push({symbol:item.symbol,reason:e.message});console.warn(`${item.symbol}: ${e.message}`);}
    await sleep(250);
  }
}
await Promise.all(Array.from({length:4},()=>worker()));
const coverage = Object.fromEntries(['US','FI'].map(m=>[m,{expected:universe.filter(s=>s.market===m).length,received:stocks.filter(s=>s.market===m).length}]));
// Abort rather than publish misleading rankings when an entire feed is unavailable.
for(const m of ['US','FI']) if(coverage[m].received < coverage[m].expected*.65) throw new Error(`Insufficient ${m} coverage: ${JSON.stringify(coverage[m])}`);
await mkdir('public/data',{recursive:true});
const reviewed=JSON.parse(await readFile('config/reviewed-events.json','utf8'));
const reasonCoverage=await enrichReasons(stocks,reviewed);
const payload={updatedAt:new Date().toISOString(),source:'Yahoo Finance',coverage,failures,reasonCoverage,stocks:stocks.sort((a,b)=>a.symbol.localeCompare(b.symbol))};
await writeFile(OUTPUT+'.tmp',JSON.stringify(payload));
await rename(OUTPUT+'.tmp',OUTPUT);
console.log(`Updated ${stocks.length}/${universe.length} stocks`);
