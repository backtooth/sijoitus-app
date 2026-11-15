import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,rank} from '../scripts/metrics.mjs';
test('drawdown uses the selected peak, not period return',()=>{
 const points=Array.from({length:70},(_,i)=>({date:`day-${i}`,close:i===68?200:100}));
 const result=analyze(points);
 assert.equal(result.dips.month.dip,-50);
 assert.equal(result.dips.month.change,0);
});
test('old highs fall outside shorter windows and invalid closes are excluded',()=>{
 const p=Array.from({length:70},(_,i)=>({date:`day-${i}`,close:i===50?200:100}));
 p.push({close:null},{close:NaN},{close:0});
 assert.equal(analyze(p).dips.week.dip,0);
 assert.equal(analyze(p).dips.month.dip,-50);
 assert.throws(()=>analyze(p.slice(0,10)));
});
test('top five ranks negative dips and respects market',()=>{
 const stocks=Array.from({length:9},(_,i)=>({symbol:String(i),market:i%2?'FI':'US',dips:{month:{dip:-i}}}));
 assert.deepEqual(rank(stocks,'all','month').map(s=>s.symbol),['8','7','6','5','4']);
 assert.deepEqual(rank(stocks,'FI','month').map(s=>s.symbol),['7','5','3','1']);
});
