import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectReason, mentionsStock, safeUrl, enrichReasons} from '../scripts/reasons.mjs';
const now=new Date('2026-11-15T13:00:00Z');
function stock(symbol='NVDA',name='Nvidia') {
 return {symbol,name,market:'US',date:'2026-11-13',history:Array.from({length:64},(_,i)=>({date:new Date(Date.UTC(2026,8,11+i)).toISOString().slice(0,10),close:200-i})),dips:{week:{dip:-5},month:{dip:-20},quarter:{dip:-31}}};
}
const event={symbol:'NVDA',eventDate:'2026-11-12',checkedAt:'2026-11-15T12:26:00Z',validUntil:'2026-12-14',summary:'Johdon vaihdos.',sources:[{url:'https://example.com/release',publishedAt:'2026-11-12',publisher:'Nvidia',title:'Leadership change'}]};
const story=(title,date='2026-11-12')=>({title,link:'https://example.com/story',publisher:'News',providerPublishTime:Date.parse(date)/1000});
test('reviewed source wins and is constrained to the selected drawdown',()=>{
 assert.equal(selectReason(stock(),'month',[],[event],now).status,'reviewed');
 assert.equal(selectReason(stock(),'month',[],[{...event,eventDate:'2026-09-01'}],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[],[{...event,eventDate:'2026-11-16'}],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[],[{...event,validUntil:'2026-11-14'}],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[],[{...event,checkedAt:'2027-01-01'}],now).status,'unknown');
});
test('old causes cannot explain a decline following a more recent peak',()=>{
 const s=stock();s.history.at(-2).close=300;
 assert.equal(selectReason(s,'week',[],[{...event,eventDate:'2026-11-10'}],now).status,'unknown');
});
test('unrelated, bullish, future and unsafe articles cannot supply a cause',()=>{
 for(const title of ['Intel CEO resigns amid investigation','Nvidia stock rallies after CEO resigns','Should you buy Nvidia after the CEO resigns?'])
  assert.equal(selectReason(stock(),'month',[story(title)],[],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[story('Nvidia CEO resigns','2026-11-20')],[],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[{...story('Nvidia CEO resigns'),link:'javascript:alert(1)'}],[],now).status,'unknown');
 assert.equal(selectReason(stock(),'month',[story('Nvidia CEO resigns')],[],now).status,'headline');
});
test('common ticker words and company substrings do not create a match',()=>{
 assert.equal(mentionsStock('Buy stocks Now',stock('NOW','ServiceNow')),false);
 assert.equal(mentionsStock('NOW cuts outlook',stock('NOW','ServiceNow')),true);
 assert.equal(mentionsStock('Solwers raises guidance',stock('SOLWERS.HE','Solwers Oyj')),true);
 assert.equal(mentionsStock('Redditor makes money',stock('RDDT','Reddit')),false);
 assert.equal(mentionsStock('SolarEdge falls as solar stocks drop',stock('FSLR','First Solar')),false);
 assert.equal(mentionsStock('First Solar cuts guidance',stock('FSLR','First Solar')),true);
 assert.equal(safeUrl('http://example.com'),null);
 assert.equal(safeUrl('https://name:secret@example.com'),null);
});
test('news outage does not break prices and marks unknown causes',async()=>{
 const s=stock();const count=await enrichReasons([s],[],{now,fetcher:async()=>{throw new Error('offline');}});
 assert.equal(count.feedFailures,1);assert.equal(s.reasons.week.status,'unknown');
 assert.match(s.reasons.week.summary,/epäonnistui/);
 assert.equal(s.dips.month.dip,-20);
});
