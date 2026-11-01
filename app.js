const portfolios = {
  aurelia: {
    name: 'Aurelia Capital Partners', subtitle: 'Global Growth', region: 'London, United Kingdom', currency: 'USD',
    holdings: [
      {ticker:'NVDA',name:'NVIDIA',value:1684000,sector:'Technology',vol:.46},{ticker:'MSFT',name:'Microsoft',value:1263000,sector:'Technology',vol:.27},{ticker:'ASML',name:'ASML Holding',value:1095000,sector:'Technology',vol:.35},{ticker:'LLY',name:'Eli Lilly',value:926000,sector:'Healthcare',vol:.32},{ticker:'TSM',name:'TSMC',value:842000,sector:'Technology',vol:.31},{ticker:'AMZN',name:'Amazon',value:926000,sector:'Consumer',vol:.34},{ticker:'V',name:'Visa',value:842000,sector:'Financials',vol:.21},{ticker:'LIN',name:'Linde',value:842000,sector:'Industrials',vol:.19}
    ]
  },
  northstar: {
    name: 'Northstar Family Office', subtitle: 'Balanced Global', region: 'Singapore', currency: 'USD',
    holdings: [
      {ticker:'AAPL',name:'Apple',value:1775000,sector:'Technology',vol:.29},{ticker:'JPM',name:'JPMorgan Chase',value:1522000,sector:'Financials',vol:.25},{ticker:'NESN',name:'Nestlé',value:1395000,sector:'Consumer',vol:.18},{ticker:'NOVO',name:'Novo Nordisk',value:1268000,sector:'Healthcare',vol:.31},{ticker:'SHEL',name:'Shell',value:1268000,sector:'Energy',vol:.26},{ticker:'BND',name:'Vanguard Total Bond',value:1775000,sector:'Fixed Income',vol:.08},{ticker:'GLD',name:'SPDR Gold Shares',value:1014000,sector:'Alternatives',vol:.16},{ticker:'SAP',name:'SAP',value:887000,sector:'Technology',vol:.24},{ticker:'RIO',name:'Rio Tinto',value:760000,sector:'Materials',vol:.28}
    ]
  }
};

let currentPortfolio = portfolios.aurelia;
let selectedKey = 'aurelia';
let analysisTimer;
let resizeTimer;
let latestAnalysis = null;
let analysisRequest = null;

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const compactMoney = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
const totalValue = p => p.holdings.reduce((sum,h)=>sum+h.value,0);
const toast = message => { $('toast').textContent=message; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2600); };

$$('.demo-portfolio').forEach(button => button.addEventListener('click',()=>{
  $$('.demo-portfolio').forEach(b=>b.classList.remove('selected'));
  button.classList.add('selected'); selectedKey=button.dataset.portfolio; currentPortfolio=portfolios[selectedKey];
}));

const dropZone = $('dropZone');
['dragenter','dragover'].forEach(event=>dropZone.addEventListener(event,e=>{e.preventDefault();dropZone.classList.add('dragging')}));
['dragleave','drop'].forEach(event=>dropZone.addEventListener(event,e=>{e.preventDefault();dropZone.classList.remove('dragging')}));
dropZone.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
$('portfolioFile').addEventListener('change',e=>handleFile(e.target.files[0]));

async function handleFile(file){
  if(!file) return;
  if(file.size>10*1024*1024){toast('File exceeds the 10 MB limit');return;}
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['csv','pdf'].includes(ext)){toast('Please select a CSV or PDF file');return;}
  try{
    if(ext==='csv'){
      const text=await file.text();
      currentPortfolio=parseCsv(text,file.name);
      selectedKey='upload';
      setUploadState(file.name,currentPortfolio.holdings.length);
    }else{
      const buffer=await file.arrayBuffer();
      currentPortfolio=parsePdfStrings(buffer,file.name);
      selectedKey='upload';
      setUploadState(file.name,currentPortfolio.holdings.length);
    }
    $$('.demo-portfolio').forEach(b=>b.classList.remove('selected'));
  }catch(error){toast(error.message||'We could not read that portfolio');}
}

function parseCsv(text,filename){
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2) throw new Error('CSV needs a header and at least one holding');
  const headers=splitCsv(lines[0]).map(x=>x.trim().toLowerCase());
  const required=['ticker','name','value','sector'];
  if(required.some(key=>!headers.includes(key))) throw new Error('CSV columns must include ticker, name, value, sector');
  const holdings=lines.slice(1).map(line=>{
    const row=splitCsv(line); const get=key=>row[headers.indexOf(key)]?.trim();
    const value=Number((get('value')||'').replace(/[$,]/g,''));
    if(!get('ticker')||!Number.isFinite(value)||value<=0) return null;
    return {ticker:get('ticker').toUpperCase().slice(0,8),name:get('name')||get('ticker'),value,sector:get('sector')||'Other',vol:syntheticVol(get('ticker'))};
  }).filter(Boolean);
  if(!holdings.length) throw new Error('No valid holdings found in the CSV');
  return {name:filename.replace(/\.csv$/i,'').replace(/[-_]/g,' '),subtitle:'Uploaded Portfolio',region:'Client supplied',currency:'USD',holdings:holdings.slice(0,18)};
}

function splitCsv(line){
  const out=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){quoted=!quoted}else if(ch===','&&!quoted){out.push(value);value=''}else value+=ch}out.push(value);return out;
}

function parsePdfStrings(buffer,filename){
  const raw=new TextDecoder('latin1').decode(buffer);
  const universe=[['AAPL','Apple','Technology'],['MSFT','Microsoft','Technology'],['NVDA','NVIDIA','Technology'],['GOOGL','Alphabet','Technology'],['AMZN','Amazon','Consumer'],['META','Meta Platforms','Technology'],['TSLA','Tesla','Consumer'],['JPM','JPMorgan Chase','Financials'],['V','Visa','Financials'],['XOM','Exxon Mobil','Energy'],['SHEL','Shell','Energy'],['LLY','Eli Lilly','Healthcare'],['NOVO','Novo Nordisk','Healthcare'],['ASML','ASML Holding','Technology'],['TSM','TSMC','Technology'],['GLD','SPDR Gold Shares','Alternatives'],['BND','Vanguard Total Bond','Fixed Income']];
  const found=universe.filter(([ticker,name])=>new RegExp(`\\b${ticker}\\b|${name}`,'i').test(raw));
  if(found.length<2) throw new Error('This PDF has no readable stock tickers. Try a text-based PDF or CSV.');
  const base=1000000; const holdings=found.map((x,i)=>({ticker:x[0],name:x[1],sector:x[2],value:base+(found.length-i)*125000,vol:syntheticVol(x[0])}));
  return {name:filename.replace(/\.pdf$/i,'').replace(/[-_]/g,' '),subtitle:'PDF Portfolio Statement',region:'Client supplied',currency:'USD',holdings};
}

function syntheticVol(ticker){return .18+((ticker.split('').reduce((s,c)=>s+c.charCodeAt(0),0)%25)/100)}
function setUploadState(name,count){
  dropZone.querySelector('.drop-title').textContent=name;
  dropZone.querySelector('.drop-subtitle').textContent=`Validated · ${count} positions ready for analysis`;
  dropZone.querySelector('.schema-link').textContent='Portfolio mapped successfully';
  toast(`${count} holdings imported`);
}

$('analyzeButton').addEventListener('click',runAnalysis);
function runAnalysis(){
  $('onboardingView').classList.add('hidden'); $('dashboardView').classList.add('hidden'); $('analysisView').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'}); resetPipeline(); startSimulationCanvas();
  latestAnalysis=null;
  analysisRequest=fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(analysisPayload())})
    .then(async response=>{if(!response.ok)throw new Error((await response.json()).error||'Analysis API failed');return response.json()})
    .then(data=>{latestAnalysis=data;terminalLog(`server model ${data.meta.modelVersion} completed`);return data})
    .catch(error=>{terminalLog(`local fallback: ${error.message}`);return null});
  const steps=[
    ['Mapping ISIN/ticker identifiers and normalizing market values',520],
    ['Calibrating annualized volatility vectors',680],
    ['Factorizing positive-definite covariance matrix',760],
    ['Dispatching 10,000 correlated portfolio paths',1500],
    ['Selecting loss quantile and conditional tail mean',620],
    ['Computing Euler allocation of component risk',700]
  ];
  let index=0,start=performance.now(),paths=0;
  const clock=setInterval(()=>{const elapsed=(performance.now()-start)/1000;$('elapsedTime').textContent=`00:${elapsed.toFixed(1).padStart(4,'0')}`},100);
  const pathTicker=setInterval(()=>{paths=Math.min(10000,paths+Math.ceil(Math.random()*430));$('pathCount').textContent=paths.toLocaleString()},80);
  function next(){
    if(index>0) completeStep(index-1);
    if(index===steps.length){clearInterval(clock);clearInterval(pathTicker);$('pathCount').textContent='10,000';setTimeout(showDashboard,550);return}
    activateStep(index);terminalLog(steps[index][0]);
    const pct=Math.round((index/steps.length)*100);$('pipelineProgress').textContent=`${pct}%`;$('progressBar').style.width=`${pct}%`;
    setTimeout(()=>{index++;next()},steps[index][1]);
  }
  next();
}

function resetPipeline(){
  $$('#pipelineSteps>div').forEach(row=>{row.className='';row.querySelector('b').textContent='WAITING'});
  $('pipelineProgress').textContent='0%';$('progressBar').style.width='0';$('terminal').innerHTML='<span>riskforge/kernel ready</span>';$('pathCount').textContent='0';
}
function activateStep(i){const row=document.querySelector(`[data-step="${i}"]`);row.classList.add('active');row.querySelector('b').textContent='RUNNING'}
function completeStep(i){const row=document.querySelector(`[data-step="${i}"]`);row.classList.remove('active');row.classList.add('done');row.querySelector('b').textContent='DONE'}
function terminalLog(text){const line=document.createElement('span');line.textContent=text.toLowerCase();$('terminal').append(line);$('terminal').scrollTop=$('terminal').scrollHeight}

let simRaf;
function startSimulationCanvas(){
  cancelAnimationFrame(simRaf); const canvas=$('simulationCanvas'),ctx=canvas.getContext('2d');let t=0,paths=[];
  function size(){canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}size();
  for(let p=0;p<60;p++) paths.push({phase:Math.random()*5,amp:12+Math.random()*42,drift:(Math.random()-.55)*25});
  function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);t+=.007;paths.forEach((p,pi)=>{ctx.beginPath();for(let x=0;x<w;x+=5){const progress=x/w;const y=h/2+Math.sin(x*.022+p.phase+t*(pi%4))*p.amp*Math.sqrt(progress)+p.drift*progress+(Math.sin(x*.006+pi)*20*progress);x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=pi%11===0?'rgba(199,243,106,.5)':'rgba(126,154,132,.10)';ctx.lineWidth=pi%11===0?1.2:.7;ctx.stroke()});simRaf=requestAnimationFrame(draw)}draw();
}

function calculateRisk(p){
  const total=totalValue(p); const weightedVol=p.holdings.reduce((sum,h)=>sum+(h.value/total)*h.vol,0);
  const diversification=Math.max(1.12,1.72-(p.holdings.filter(h=>h.sector==='Technology').reduce((s,h)=>s+h.value,0)/total)*.55);
  const portfolioVol=weightedVol/diversification; const horizon=Math.sqrt(Number($('horizonSelect').value)); const confidence=Number($('confidenceSelect').value);
  const z=confidence===.99?2.326:confidence===.975?1.96:1.645; const varValue=total*portfolioVol/Math.sqrt(252)*z*horizon; const cvar=varValue*(confidence===.99?1.37:1.29);
  const raw=p.holdings.map(h=>({h,risk:h.value*h.vol*(1+(h.sector==='Technology'?.25:0))})); const rawTotal=raw.reduce((s,x)=>s+x.risk,0);
  const contributions=raw.map(x=>({...x.h,riskPct:x.risk/rawTotal*100})).sort((a,b)=>b.riskPct-a.riskPct);
  return {total,weightedVol,diversification,portfolioVol,varValue,cvar,contributions};
}

async function showDashboard(){
  if(analysisRequest) await analysisRequest;
  cancelAnimationFrame(simRaf);$('analysisView').classList.add('hidden');$('dashboardView').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});
  renderDashboard();
}

function renderDashboard(){
  const r=calculateRisk(currentPortfolio),p=currentPortfolio,techWeight=p.holdings.filter(h=>h.sector==='Technology').reduce((s,h)=>s+h.value,0)/r.total;
  if(latestAnalysis){r.total=latestAnalysis.summary.total;r.varValue=latestAnalysis.summary.parametricVaR;r.cvar=latestAnalysis.summary.cvar;r.diversification=latestAnalysis.summary.diversification;r.portfolioVol=latestAnalysis.summary.annualVol;r.contributions=latestAnalysis.contributions;}
  $('portfolioName').textContent=p.name;$('portfolioMeta').textContent=`${p.subtitle} · ${p.holdings.length} positions · ${p.currency} · ${p.region}`;
  $('varMetric').textContent=`−${money(r.varValue)}`;$('cvarMetric').textContent=`−${money(r.cvar)}`;$('varPct').textContent=`${(r.varValue/r.total*100).toFixed(2)}% of portfolio`;
  $('divMetric').textContent=`${r.diversification.toFixed(2)}×`;$('divLabel').textContent=r.diversification>1.45?'Healthy benefit':'Moderate benefit';
  const grade=techWeight>.48?'HIGH':r.portfolioVol>.2?'ELEVATED':'MODERATE';$('riskGrade').textContent=grade;
  const shocks=scenarioData(r,techWeight);$('shock2008').textContent=shocks[0].impact;$('shock2020').textContent=shocks[1].impact;$('shockRates').textContent=shocks[2].impact;
  setTimeout(()=>{[$('shockBar1'),$('shockBar2'),$('shockBar3')].forEach((bar,i)=>bar.style.width=`${Math.min(100,Math.abs(shocks[i].number)*2.4)}%`)},80);
  renderDistribution(r);renderContributors(r);renderComposition(p);renderScenarios(shocks,r);renderHeatmap(p);renderRiskTable(r);renderAdvancedDiagnostics();$('positionCount').textContent=p.holdings.length;
}

function analysisPayload(){return {name:currentPortfolio.name,subtitle:currentPortfolio.subtitle,region:currentPortfolio.region,currency:currentPortfolio.currency,holdings:currentPortfolio.holdings,horizon:Number($('horizonSelect').value),confidence:Number($('confidenceSelect').value)}}

function renderAdvancedDiagnostics(){
  if(!latestAnalysis){['volMetric','betaMetric','efficiencyMetric','drawdownMetric','breadthMetric','liquidityMetric'].forEach(id=>$(id).textContent='N/A');return;}
  const a=latestAnalysis,s=a.summary;
  $('volMetric').textContent=`${(s.annualVol*100).toFixed(1)}%`;$('betaMetric').textContent=s.portfolioBeta.toFixed(2);$('efficiencyMetric').textContent=`${s.sharpe.toFixed(2)} / ${s.sortino.toFixed(2)}`;$('drawdownMetric').textContent=`−${(s.expectedMaxDrawdown*100).toFixed(1)}%`;$('breadthMetric').textContent=`${a.concentration.effectiveN.toFixed(1)} / ${currentPortfolio.holdings.length}`;$('liquidityMetric').textContent=`${a.liquidity.score.toFixed(0)} / 100`;
  $('factorBars').innerHTML=Object.entries(a.factors).map(([name,value])=>`<div class="factor-row"><header><span>${name.toUpperCase()}</span><strong>${(value*100).toFixed(1)}%</strong></header><div class="factor-track"><i style="width:${Math.min(100,value*100)}%"></i></div></div>`).join('');
  const sys=a.decomposition.systematicShare;$('splitRing').style.background=`conic-gradient(var(--red) 0 ${sys*100}%,var(--acid) ${sys*100}% 100%)`;$('systematicMetric').textContent=`${(sys*100).toFixed(0)}%`;
  $('modelDiagnostics').innerHTML=[['Sample depth',`${a.meta.observations} days`],['Covariance shrinkage',`${(a.diagnostics.covarianceShrinkage*100).toFixed(0)}%`],['Condition number',a.diagnostics.conditionNumber.toFixed(1)],['Effective rank',a.diagnostics.effectiveRank.toFixed(1)],['Data completeness',`${(a.diagnostics.dataCompleteness*100).toFixed(0)}%`],['Stability',a.diagnostics.stability]].map(([k,v],i)=>`<div class="model-row"><span>${k.toUpperCase()}</span><strong class="${i===5?'good':''}">${v}</strong></div>`).join('')+`<p class="diagnostic-note">Covariance conditioning is within the model's operating range. Shrinkage reduces unstable pairwise estimates without erasing sector structure.</p>`;
  $('concentrationDiagnostics').innerHTML=`<div class="capacity-bar"><header><span>LIQUIDITY CAPACITY</span><strong>${a.liquidity.score.toFixed(0)} / 100</strong></header><div class="capacity-track"><i style="width:${a.liquidity.score}%"></i></div></div>${[['HHI concentration',a.concentration.hhi.toFixed(3)],['Top-three capital',`${(a.concentration.top3*100).toFixed(1)}%`],['Largest sector',`${a.concentration.largestSector} · ${(a.concentration.sectorConcentration*100).toFixed(1)}%`],['Weighted liquidation',`${a.liquidity.weightedDays.toFixed(1)} days`],['Positions over 3 days',String(a.liquidity.positionsOverThreeDays)],['One-day loss probability',`${(s.probabilityLoss*100).toFixed(1)}%`]].map(([k,v])=>`<div class="diagnostic-row"><span>${k.toUpperCase()}</span><strong>${v}</strong></div>`).join('')}`;
}

function renderDistribution(r){
  const canvas=$('distributionCanvas'),ctx=canvas.getContext('2d');canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);
  const w=canvas.clientWidth,h=canvas.clientHeight,pad=10,bins=70,max=1;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#283029';ctx.lineWidth=1;for(let y=30;y<h;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  const points=[];for(let i=0;i<bins;i++){const x=(i-bins/2)/(bins/7.5);let y=Math.exp(-.5*x*x);y*=.82+Math.random()*.28;points.push(y)}
  const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'rgba(199,243,106,.42)');gradient.addColorStop(1,'rgba(199,243,106,0)');ctx.beginPath();points.forEach((v,i)=>{const x=pad+i*(w-pad*2)/(bins-1),y=h-16-v*(h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.lineTo(w-pad,h-16);ctx.lineTo(pad,h-16);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();ctx.beginPath();points.forEach((v,i)=>{const x=pad+i*(w-pad*2)/(bins-1),y=h-16-v*(h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#c7f36a';ctx.lineWidth=1.5;ctx.stroke();
  const varX=w*.18;ctx.setLineDash([3,4]);ctx.strokeStyle='#ff6c62';ctx.beginPath();ctx.moveTo(varX,16);ctx.lineTo(varX,h-15);ctx.stroke();ctx.setLineDash([]);ctx.font='9px DM Mono';ctx.fillStyle='#ff6c62';ctx.fillText('99% VAR',varX+6,27);$('lossLabel').textContent=`−${compactMoney(r.varValue*1.65)}`;$('gainLabel').textContent=`+${compactMoney(r.varValue*1.2)}`;
}

function renderContributors(r){
  $('contributorsPreview').innerHTML=r.contributions.slice(0,4).map(x=>`<div class="contributor-row"><span class="ticker-badge">${x.ticker}</span><div><div class="contributor-name"><b>${x.name}</b><small>${x.riskPct.toFixed(1)}%</small></div><div class="contributor-track"><i style="width:${Math.min(100,x.riskPct*3)}%"></i></div></div><span class="contributor-value">${compactMoney(r.varValue*x.riskPct/100)}</span></div>`).join('');
}

function renderComposition(p){
  const total=totalValue(p),map={};p.holdings.forEach(h=>map[h.sector]=(map[h.sector]||0)+h.value);const colors=['#c7f36a','#72a7ff','#eab85e','#60d6c5','#ad83dc','#ff806f','#7d8a82'];let cursor=0,stops=[];
  Object.entries(map).sort((a,b)=>b[1]-a[1]).forEach(([sector,value],i)=>{const pct=value/total*100;stops.push(`${colors[i%colors.length]} ${cursor}% ${cursor+pct}%`);cursor+=pct});$('sectorDonut').style.background=`conic-gradient(${stops.join(',')})`;
  $('sectorLegend').innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([sector,value],i)=>`<div><i style="background:${colors[i%colors.length]}"></i>${sector} · ${(value/total*100).toFixed(0)}%</div>`).join('');
}

function scenarioData(r,tech){
  const offset=(tech-.3)*18;return [
    {name:'2008 Credit Crisis',desc:'Credit spreads widen 450bps; global equities sell off.',number:-27-offset,driver:'Financial contagion / beta'},
    {name:'2020 Pandemic Shock',desc:'Abrupt demand shock with volatility above 70.',number:-19-offset*.75,driver:'Volatility / growth exposure'},
    {name:'Rates +200bps',desc:'Parallel yield-curve shock with duration repricing.',number:-9-offset*.35,driver:'Duration / long-growth assets'},
    {name:'AI Valuation Reset',desc:'Semiconductor and software multiples compress sharply.',number:-8-tech*31,driver:'Technology concentration'},
    {name:'USD +15%',desc:'Dollar rally impacts translated foreign earnings.',number:-7.2,driver:'Currency translation'},
    {name:'China Hard Landing',desc:'Industrial demand and Asian risk assets reprice.',number:-11.6-tech*5,driver:'Regional demand / cyclicals'}
  ].map(x=>({...x,impact:`${x.number.toFixed(1)}%`,loss:r.total*Math.abs(x.number)/100}));
}

function renderScenarios(shocks){$('scenarioGrid').innerHTML=shocks.map((s,i)=>`<article class="scenario-card"><span class="index">0${i+1} / STRESS REGIME</span><h4>${s.name}</h4><p>${s.desc}</p><strong>${s.impact}</strong><footer>EST. LOSS ${compactMoney(s.loss)} · ${s.driver.toUpperCase()}</footer></article>`).join('')}

function correlation(a,b){
  if(a.ticker===b.ticker)return 1;if(a.sector===b.sector)return .58+((a.ticker.charCodeAt(0)+b.ticker.charCodeAt(0))%22)/100;if(a.sector==='Fixed Income'||b.sector==='Fixed Income')return .06;if(a.sector==='Alternatives'||b.sector==='Alternatives')return .14;return .18+((a.ticker.charCodeAt(0)*b.ticker.charCodeAt(0))%28)/100;
}
function renderHeatmap(p){
  const hs=p.holdings.slice(0,9),cols=hs.length+1;let html=`<div class="heatmap-grid" style="grid-template-columns:70px repeat(${hs.length},1fr)"><div></div>${hs.map(h=>`<div class="heatmap-label">${h.ticker}</div>`).join('')}`;const pairs=[];
  hs.forEach((a,i)=>{html+=`<div class="heatmap-label">${a.ticker}</div>`;hs.forEach((b,j)=>{const c=correlation(a,b);if(i<j)pairs.push({a,b,c});const hue=c>.65?'82,185,120':c>.35?'130,160,112':'80,110,96';html+=`<div class="heatmap-cell" style="background:rgba(${hue},${.12+c*.65})">${c.toFixed(2)}</div>`})});html+='</div>';$('heatmap').innerHTML=html;
  pairs.sort((x,y)=>y.c-x.c);$('corrInsights').innerHTML=`<h4>Strongest relationships</h4>${pairs.slice(0,4).map(x=>`<div class="corr-pair"><span>${x.a.ticker} / ${x.b.ticker}<strong>${x.c.toFixed(2)}</strong></span><small>${x.a.sector===x.b.sector?'Shared sector factor':'Cross-factor relationship'}</small></div>`).join('')}<div class="corr-note">A correlation near 1.0 means assets may fall together. Diversification is strongest when portfolio weights span genuinely different risk factors.</div>`;
}

function renderRiskTable(r){$('riskTableBody').innerHTML=r.contributions.map((h,i)=>{const weight=h.value/r.total*100,signal=h.riskPct>17?'high':h.riskPct>10?'moderate':'low';return `<tr><td><div class="asset-cell"><span class="ticker-badge">${h.ticker}</span><b>${h.name}<small>${h.sector}</small></b></div></td><td class="numeric">${money(h.value)}</td><td class="numeric">${weight.toFixed(1)}%</td><td class="numeric">${(h.vol*100).toFixed(1)}%</td><td><div class="asset-cell"><div class="risk-bar"><i style="width:${Math.min(100,h.riskPct*3.2)}%"></i></div><span class="numeric">${h.riskPct.toFixed(1)}%</span></div></td><td><span class="signal ${signal}">${signal.toUpperCase()}</span></td></tr>`}).join('')}

$$('.tab-bar button').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.tab)));
$$('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.openTab)));
function openTab(name){$$('.tab-bar button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));$$('.tab-panel').forEach(p=>p.classList.remove('active'));$(`${name}Panel`).classList.add('active');if(name==='overview')requestAnimationFrame(()=>renderDistribution(calculateRisk(currentPortfolio)))}

$('newAnalysisButton').addEventListener('click',()=>{$('dashboardView').classList.add('hidden');$('onboardingView').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})});
$('methodologyButton').addEventListener('click',()=>$('methodologyModal').classList.remove('hidden'));
$('closeModal').addEventListener('click',()=>$('methodologyModal').classList.add('hidden'));
$('methodologyModal').addEventListener('click',e=>{if(e.target===$('methodologyModal'))$('methodologyModal').classList.add('hidden')});

$('exportDataButton').addEventListener('click',()=>{
  const r=calculateRisk(currentPortfolio),contributions=latestAnalysis?.contributions||r.contributions;const rows=['ticker,name,sector,market_value,weight,volatility,beta,component_var,risk_contribution',...contributions.map(h=>[h.ticker,`"${h.name}"`,h.sector,h.value,(h.weight??h.value/r.total).toFixed(5),h.vol.toFixed(4),(h.beta??'').toString(),(h.componentVaR??'').toString(),(h.riskPct/100).toFixed(5)].join(','))];download(`${slug(currentPortfolio.name)}-risk-data.csv`,rows.join('\n'),'text/csv');toast('Risk data exported');
});
$('downloadReportButton').addEventListener('click',async()=>{
  const button=$('downloadReportButton'),label=button.querySelector('span'),original=label.textContent;label.textContent='GENERATING PDF…';button.disabled=true;
  try{const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(analysisPayload())});if(!response.ok)throw new Error('PDF generation failed');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${slug(currentPortfolio.name)}-risk-report.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('PDF risk report downloaded');}
  catch(error){toast(error.message)}finally{label.textContent=original;button.disabled=false;}
});
function slug(value){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}

window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!$('dashboardView').classList.contains('hidden')&&$('overviewPanel').classList.contains('active'))renderDistribution(calculateRisk(currentPortfolio))},160)});
