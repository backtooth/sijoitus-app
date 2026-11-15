let data, market='all', period='month';
const $=id=>document.getElementById(id);
const percent=n=>new Intl.NumberFormat('fi-FI',{maximumFractionDigits:2,minimumFractionDigits:2,signDisplay:'exceptZero'}).format(n)+' %';
const money=(n,c)=>new Intl.NumberFormat('fi-FI',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
const date=d=>new Intl.DateTimeFormat('fi-FI',{day:'numeric',month:'numeric',year:'numeric',timeZone:'Europe/Helsinki'}).format(new Date(d));
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function spark(points){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 160 45');svg.classList.add('spark');svg.setAttribute('aria-hidden','true');const values=points.map(p=>p.close);const min=Math.min(...values),range=Math.max(...values)-min||1;const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',values.map((v,i)=>(i?'L':'M')+(i*160/(values.length-1)).toFixed(1)+' '+(41-(v-min)/range*37).toFixed(1)).join(' '));svg.append(path);return svg;}
function render(){
 const available=data.stocks.filter(s=>market==='all'||s.market===market);
 const top=available.filter(s=>s.dips[period].dip<0).sort((a,b)=>a.dips[period].dip-b.dips[period].dip||a.symbol.localeCompare(b.symbol)).slice(0,5);
 $('count').textContent=available.length+' osaketta';$('biggest').textContent=top.length?percent(top[0].dips[period].dip):'—';$('biggest-name').textContent=top[0]?.name||'Ei laskeneita osakkeita';
 const updated=new Date(data.updatedAt);$('updated').textContent=date(updated)+' · '+new Intl.DateTimeFormat('fi-FI',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Helsinki'}).format(updated);
 const age=Date.now()-updated.getTime();$('freshness').textContent=age>36*3600000?'Päivitys viivästynyt · tarkista Actions':'Helsingin aikaa · kaksi ajoa päivässä';
 const warnings=[];
 if(age>36*3600000)warnings.push('Tiedot ovat yli 36 tuntia vanhoja. Automaattinen päivitys on viivästynyt.');
 const relevant=Object.entries(data.coverage).filter(([m])=>market==='all'||m===market);
 if(relevant.some(([,c])=>c.received<c.expected))warnings.push('Datan kattavuus: '+relevant.map(([m,c])=>`${m==='US'?'USA':'Suomi'} ${c.received}/${c.expected}`).join(', ')+'. Puuttuvat osakkeet eivät ole sijoituksessa mukana.');
 $('notice').textContent=warnings.join(' ');$('notice').hidden=!warnings.length;
 $('stocks').replaceChildren();
 if(!top.length)$('stocks').append(element('div','empty','Valitussa seurannassa ei ole laskeneita osakkeita.'));
 top.forEach((s,i)=>{
  const row=element('article','stock-row'),company=element('div','company');company.append(element('span','rank',String(i+1).padStart(2,'0')),element('span','company-icon',s.symbol.slice(0,2)));
  const info=element('div','company-info'),link=element('a','',s.name);link.href='https://finance.yahoo.com/quote/'+encodeURIComponent(s.symbol)+'/';link.target='_blank';link.rel='noopener';info.append(link,element('small','',s.symbol+' · '+(s.market==='US'?'USA':'Suomi')));company.append(info);
  const price=element('div','price',money(s.price,s.currency));price.append(element('small','',date(s.date)));
  const dip=element('div','dip');dip.append(element('strong','',percent(s.dips[period].dip)),element('small','',({week:'1 viikon',month:'1 kuukauden',quarter:'3 kuukauden'})[period]+' huipusta'));
  row.append(company,price,spark(s.history),dip);$('stocks').append(row);
 });
}
document.querySelectorAll('#markets button').forEach(b=>b.addEventListener('click',()=>{market=b.dataset.value;document.querySelectorAll('#markets button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(data)render();}));
$('period').addEventListener('change',e=>{period=e.target.value;if(data)render();});
try{const res=await fetch('data/stocks.json',{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);data=await res.json();if(!Array.isArray(data.stocks)||!data.updatedAt)throw new Error('Invalid data');render();}catch(e){$('stocks').replaceChildren(element('div','empty','Markkinatiedot eivät ole vielä saatavilla. Ensimmäinen onnistunut datapäivitys tuo osakkeet tähän.'));$('notice').hidden=false;$('notice').textContent='Tarkista automaattisen päivityksen tila sivun alareunan linkistä.';console.error(e);}
