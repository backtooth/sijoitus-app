import {rank, WINDOWS} from './metrics.mjs';

const DAY = 86400000;
const RULES = [
  [/\b(?:ai mode|ai overviews|search traffic)\b/i, /\b(?:traffic|referrals|users)\b.*\b(?:fall|drop|shrink|lost|declin|does not|not drive)|\b(?:sink|plung|fell|down)\w*\b/i, 'Googlen tekoälyhaun vaikutus käyttäjäliikenteeseen ja kasvunäkymiin.'],
  [/\b(?:ceo|chief executive|leadership)\b/i, /\b(?:resign|oust|scandal|probe|investigation|turmoil)\w*\b/i, 'Yhtiön johtoon liittyvä epävarmuus tai johdon vaihdos.'],
  [/\b(?:guidance|outlook|forecast)\b/i, /\b(?:cut|cuts|lower|weak|miss|disappoint)\w*\b/i, 'Heikentynyt ohjeistus tai odotuksia heikommat tulosnäkymät.'],
  [/\b(?:downgrad|price target cut|cuts.{0,30}price target)\w*\b/i, /./, 'Analyytikon suosituksen tai tavoitehinnan lasku.'],
  [/\b(?:earnings|revenue|results|profit)\b/i, /\b(?:miss|weak|disappoint|loss|shortfall)\w*\b/i, 'Odotuksia heikompi tulos tai liikevaihto.'],
  [/\b(?:merger|acquisition|takeover|deal)\b/i, /\b(?:risk|concern|fall|drop|down|widen)\w*\b/i, 'Yrityskauppaan liittyvät toteutus-, arvostus- tai rahoitushuolet.'],
  [/\b(?:tariff|export|regulat)\w*\b/i, /\b(?:ban|curb|restrict|risk|worr|concern)\w*\b/i, 'Vientirajoituksiin, tulleihin tai sääntelyyn liittyvä epävarmuus.'],
  [/\b(?:semiconductor|chip|tech|sector|treasury|yield)\w*\b/i, /\b(?:selloff|sell-off|revers|fall|drop|down|sink|pressure)\w*\b/i, 'Toimialan myyntipaine ja markkinan riskinoton heikkeneminen.'],
];

export function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}

export function mentionsStock(title, stock) {
  const ticker = stock.symbol.replace(/\.HE$/, '');
  const coreName=(stock.name || '').replace(/\b(?:corporation|group|technology|technologies|holdings|enterprise|incorporated|inc|plc|oyj|corp)\b\.?/gi,'').replace(/[^\p{L}\p{N} ]/gu,' ').trim().replace(/\s+/g,' ');
  // Generic words such as "Solar" cannot identify "First Solar" in another company's story.
  const words=coreName.split(' ').filter(w=>w.length>=4 && !/^(first|solar|united|general|american|international|advanced|energy|micro|financial|global)$/i.test(w)).slice(0,1);
  const lower=title.toLocaleLowerCase();
  const escaped=ticker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const names=[coreName,...words].filter(w=>w.length>=4);
  return new RegExp(`\\b${escaped}\\b`).test(title) || names.some(w=>new RegExp(`(?<![\\p{L}\\p{N}])${w.toLocaleLowerCase()}(?![\\p{L}\\p{N}])`,'u').test(lower));
}

function peakDate(stock, window) {
  const points=stock.history.slice(-(WINDOWS[window]+1));
  return points.reduce((a,p)=>p.close>=a.close?p:a).date;
}

export function selectReason(stock, window, news, reviewed, now = new Date()) {
  const since=peakDate(stock,window);
  const until=stock.date;
  // A reviewed event must occur after the selected peak and before the quote.
  // Its story may have been published later, but never in the future.
  const candidates=reviewed.filter(e=>e.symbol===stock.symbol && e.eventDate>=since && e.eventDate<=until &&
    Date.parse(e.validUntil+'T23:59:59Z')>=now.getTime() && Date.parse(e.checkedAt)<=now.getTime() &&
    e.sources?.length && e.sources.every(s=>safeUrl(s.url) && Number.isFinite(Date.parse(s.publishedAt)) && Date.parse(s.publishedAt)<=now.getTime()));
  candidates.sort((a,b)=>b.eventDate.localeCompare(a.eventDate));
  if(candidates.length) {
    const e=candidates[0];
    return {status:'reviewed',summary:e.summary,eventDate:e.eventDate,checkedAt:e.checkedAt,sources:e.sources};
  }
  const inferred=news.filter(n=>mentionsStock(n.title||'',stock) && safeUrl(n.link) &&
    Number.isFinite(n.providerPublishTime) && n.providerPublishTime*1000>=Date.parse(since) &&
    n.providerPublishTime*1000<=Math.min(now.getTime(),Date.parse(until)+2*DAY))
    .flatMap(n=>{
      // Questions, recommendations and bullish headlines are not evidence of a cause.
      if(/\?|\b(?:buy|bargain|rebound|rallies|surges|soars|jumps)\b/i.test(n.title)) return [];
      const rule=RULES.find(([topic,negative])=>topic.test(n.title)&&negative.test(n.title));
      if(!rule)return [];
      return [{status:'headline',summary:rule[2],eventDate:new Date(n.providerPublishTime*1000).toISOString().slice(0,10),checkedAt:now.toISOString(),sources:[{title:n.title,publisher:n.publisher||'Yahoo Finance',url:safeUrl(n.link),publishedAt:new Date(n.providerPublishTime*1000).toISOString()}]}];
    });
  inferred.sort((a,b)=>b.eventDate.localeCompare(a.eventDate));
  return inferred[0] || {status:'unknown',summary:'Ajantasaista, lähteellä perusteltua syytä ei löytynyt. Pelkkä hinnanlasku ei kerro sen syytä.',checkedAt:now.toISOString(),sources:[]};
}

export async function enrichReasons(stocks, reviewed, {fetcher=fetch, now=new Date()}={}) {
  const targets=new Map();
  for(const market of ['all','US','FI']) for(const window of Object.keys(WINDOWS))
    for(const stock of rank(stocks,market,window))targets.set(stock.symbol,stock);
  let failures=0;
  const queue=[...targets.values()];
  let cursor=0;
  async function worker() {
    while(cursor<queue.length) {
      const stock=queue[cursor++];
      let news=[], unavailable=false;
      try {
        const res=await fetcher(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(stock.symbol)}&quotesCount=0&newsCount=100`,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const body=await res.json();
        if(!Array.isArray(body.news))throw new Error('Invalid news response');
        news=body.news;
      } catch(e) {unavailable=true;failures++;console.warn(`News ${stock.symbol}: ${e.message}`);}
      stock.reasons=Object.fromEntries(Object.keys(WINDOWS).map(window=>{
        const reason=selectReason(stock,window,news,reviewed,now);
        if(unavailable && reason.status==='unknown')reason.summary='Uutislähteen haku epäonnistui. Dipin syytä ei voitu arvioida tällä päivityksellä.';
        return [window,reason];
      }));
    }
  }
  await Promise.all([worker(),worker()]);
  return {checkedAt:now.toISOString(),stocks:targets.size,feedFailures:failures};
}
