'use strict';
const PDFDocument=require('pdfkit');

const C={ink:'#121713',muted:'#68716a',line:'#d8ddd7',lime:'#98bf45',red:'#b7433a',paper:'#f7f8f4',panel:'#eef1eb'};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const pct=n=>`${(n*100).toFixed(1)}%`;

function generateReport(res,payload,analysis){
  const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:`RiskForge Risk Report - ${payload.name}`,Author:'RiskForge',Subject:'Quantitative portfolio stress test'}});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="${slug(payload.name)}-risk-report.pdf"`);
  doc.pipe(res);
  cover(doc,payload,analysis); summary(doc,analysis); attribution(doc,analysis); diagnostics(doc,analysis); methodology(doc,analysis);
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fontSize(7).fillColor(C.muted).text(`RISKFORGE  /  CONFIDENTIAL  /  ${i+1} OF ${pages.count}`,42,785,{width:511,align:'right',lineBreak:false});}
  doc.end();
}

function brand(doc){doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(12).text('///  RISKFORGE',42,38,{characterSpacing:1.5});doc.moveTo(42,61).lineTo(553,61).strokeColor(C.line).stroke();}
function cover(doc,p,a){
  brand(doc);doc.fillColor(C.lime).font('Courier').fontSize(9).text('QUANTITATIVE PORTFOLIO RISK REVIEW',42,110,{characterSpacing:1});
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(35).text(p.name||'Portfolio',42,144,{width:480,lineGap:4});
  doc.fillColor(C.muted).font('Helvetica').fontSize(12).text(`${p.subtitle||'Client Portfolio'}  /  ${p.region||'Client supplied'}  /  ${p.currency||'USD'}`,42,238);
  const y=330;metric(doc,42,y,118,'PORTFOLIO VALUE',money(a.summary.total));metric(doc,170,y,118,'99% VALUE AT RISK',`-${money(a.summary.parametricVaR)}`,C.red);metric(doc,298,y,118,'CONDITIONAL VAR',`-${money(a.summary.cvar)}`,C.red);metric(doc,426,y,127,'ANNUAL VOLATILITY',pct(a.summary.annualVol));
  doc.roundedRect(42,500,511,115,3).fill(C.ink);doc.fillColor(C.lime).font('Courier-Bold').fontSize(10).text('EXECUTIVE RISK OPINION',62,522);doc.fillColor('#ffffff').font('Helvetica').fontSize(14).text(riskOpinion(a),62,550,{width:470,lineGap:5});
  doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(`Generated ${new Date(a.meta.generatedAt).toLocaleString('en-GB')} / Model ${a.meta.modelVersion} / ${a.meta.observations} observations / ${a.meta.simulationPaths.toLocaleString()} paths`,42,738,{width:500});
  doc.fillColor(C.muted).font('Helvetica').fontSize(7).text('MODEL OUTPUT - NOT INVESTMENT ADVICE. DEMO CALIBRATIONS ARE SYNTHETIC.',42,764);
  doc.addPage();
}
function summary(doc,a){
  sectionHead(doc,'01','RISK SUMMARY','Loss, concentration and efficiency diagnostics');
  const metrics=[['Parametric VaR',money(a.summary.parametricVaR)],['Monte Carlo VaR',money(a.summary.monteCarloVaR)],['Historical proxy VaR',money(a.summary.historicalVaR)],['Expected shortfall',money(a.summary.cvar)],['Expected max drawdown',pct(a.summary.expectedMaxDrawdown)],['Tail ratio',`${a.summary.tailRatio.toFixed(2)}x`],['Sharpe ratio',a.summary.sharpe.toFixed(2)],['Sortino ratio',a.summary.sortino.toFixed(2)],['Portfolio beta',a.summary.portfolioBeta.toFixed(2)],['Diversification ratio',`${a.summary.diversification.toFixed(2)}x`],['Effective positions',a.concentration.effectiveN.toFixed(1)],['Liquidity score',`${a.liquidity.score.toFixed(0)} / 100`]];
  metrics.forEach((m,i)=>{const col=i%3,row=Math.floor(i/3);metric(doc,42+col*171,150+row*75,161,m[0].toUpperCase(),m[1],i<4?C.red:C.ink)});
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(15).text('Risk decomposition',42,485);bar(doc,42,520,511,a.decomposition.systematicShare,C.red,'SYSTEMATIC RISK');bar(doc,42,572,511,a.decomposition.idiosyncraticShare,C.lime,'IDIOSYNCRATIC RISK');
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(15).text('Concentration flags',42,650);doc.fillColor(C.muted).font('Helvetica').fontSize(10).text(`Top three positions represent ${pct(a.concentration.top3)} of capital. ${a.concentration.largestSector} is the largest sector at ${pct(a.concentration.sectorConcentration)}. Effective breadth is ${a.concentration.effectiveN.toFixed(1)} positions versus ${a.contributions.length} nominal holdings.`,42,680,{width:511,lineGap:4});
  doc.addPage();
}
function attribution(doc,a){
  sectionHead(doc,'02','RISK ATTRIBUTION','Euler component VaR by security');let y=145;
  headerRow(doc,y,['ASSET','VALUE','WEIGHT','BETA','COMPONENT VAR','RISK SHARE'],[42,225,310,365,415,500]);y+=26;
  a.contributions.forEach((h,i)=>{if(y>740){doc.addPage();brand(doc);y=100;headerRow(doc,y,['ASSET','VALUE','WEIGHT','BETA','COMPONENT VAR','RISK SHARE'],[42,225,310,365,415,500]);y+=26;}doc.fillColor(i%2?C.paper:'#ffffff').rect(42,y-7,511,31).fill();doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(9).text(h.ticker,42,y);doc.fillColor(C.muted).font('Helvetica').fontSize(7).text(h.name,77,y+1,{width:135});doc.fillColor(C.ink).font('Courier').fontSize(8).text(money(h.value),225,y);doc.text(pct(h.weight),310,y);doc.text(h.beta.toFixed(2),365,y);doc.fillColor(C.red).text(money(h.componentVaR),415,y);doc.text(`${h.riskPct.toFixed(1)}%`,500,y);y+=33;});
  doc.addPage();
}
function diagnostics(doc,a){
  sectionHead(doc,'03','FACTOR & MODEL DIAGNOSTICS','Portfolio behaviour beneath the headline VaR');doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(15).text('Style factor exposures',42,145);let y=182;Object.entries(a.factors).forEach(([name,value])=>{bar(doc,42,y,511,value,name==='Growth'?C.red:C.lime,name.toUpperCase());y+=52;});
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(15).text('Model controls',42,425);const rows=[['Sample depth',`${a.meta.observations} daily observations`],['Covariance estimator',`Ledoit-style shrinkage / ${(a.diagnostics.covarianceShrinkage*100).toFixed(0)}% intensity`],['Condition number',a.diagnostics.conditionNumber.toFixed(1)],['Effective covariance rank',a.diagnostics.effectiveRank.toFixed(1)],['Stability flag',a.diagnostics.stability],['Data completeness',pct(a.diagnostics.dataCompleteness)],['Weighted liquidation period',`${a.liquidity.weightedDays.toFixed(1)} days`],['Positions > 3 days',String(a.liquidity.positionsOverThreeDays)]];y=460;rows.forEach((r,i)=>{doc.fillColor(i%2?C.paper:'#fff').rect(42,y-7,511,28).fill();doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(r[0].toUpperCase(),52,y);doc.fillColor(C.ink).font('Courier-Bold').text(r[1],285,y);y+=29;});doc.addPage();
}
function methodology(doc,a){
  sectionHead(doc,'04','METHODOLOGY & LIMITATIONS','How to interpret this document');
  const sections=[['Value at Risk','Parametric VaR is estimated from the full covariance matrix under a multivariate-normal approximation. Monte Carlo VaR applies a deterministic finite-path adjustment; the historical figure is a concentration-sensitive proxy.'],['Expected Shortfall','Conditional VaR reports the expected loss beyond the selected VaR threshold. It should be read with the tail ratio and stress scenarios rather than in isolation.'],['Risk attribution','Component VaR uses Euler allocation. Contributions reconcile to total portfolio VaR and incorporate security weight, volatility and covariance with the full portfolio.'],['Liquidity','Days-to-liquidate is a capacity proxy based on position size and sector liquidity multipliers. It is not a substitute for security-level ADV, spread, borrow or market-depth data.'],['Limitations','Demo volatility, correlation and factor calibrations are synthetic. Production use requires validated price histories, corporate-action treatment, benchmark definitions, currency curves and independent model governance.']];
  let y=150;sections.forEach(([title,text])=>{doc.fillColor(C.lime).font('Courier-Bold').fontSize(9).text(title.toUpperCase(),42,y);doc.fillColor(C.ink).font('Helvetica').fontSize(10).text(text,42,y+21,{width:511,lineGap:4});y+=112;});
  doc.roundedRect(42,712,511,55,3).fill(C.panel);doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(9).text('GOVERNANCE NOTE',55,728);doc.fillColor(C.muted).font('Helvetica').fontSize(8).text('This report is analytical model output and does not constitute investment advice, a valuation, or a forecast.',155,727,{width:380});
}
function sectionHead(doc,n,title,sub){brand(doc);doc.fillColor(C.lime).font('Courier').fontSize(9).text(n,42,93);doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(25).text(title,72,86);doc.fillColor(C.muted).font('Helvetica').fontSize(9).text(sub,72,119);}
function metric(doc,x,y,w,label,value,color=C.ink){doc.fillColor(C.panel).roundedRect(x,y,w,58,2).fill();doc.fillColor(C.muted).font('Courier').fontSize(6.5).text(label,x+10,y+10,{width:w-20});doc.fillColor(color).font('Helvetica-Bold').fontSize(13).text(value,x+10,y+30,{width:w-20});}
function bar(doc,x,y,w,value,color,label){doc.fillColor(C.muted).font('Courier').fontSize(7).text(label,x,y-12);doc.text(`${(value*100).toFixed(1)}%`,x+w-50,y-12,{width:50,align:'right'});doc.fillColor(C.panel).rect(x,y,w,8).fill();doc.fillColor(color).rect(x,y,w*clamp(value,0,1),8).fill();}
function headerRow(doc,y,heads,xs){doc.fillColor(C.ink).rect(42,y-9,511,25).fill();doc.fillColor('#fff').font('Courier-Bold').fontSize(6.5);heads.forEach((h,i)=>doc.text(h,xs[i],y));}
function riskOpinion(a){const issues=[];if(a.concentration.sectorConcentration>.45)issues.push(`sector concentration in ${a.concentration.largestSector}`);if(a.summary.expectedMaxDrawdown>.3)issues.push('material drawdown sensitivity');if(a.liquidity.score<70)issues.push('liquidity capacity constraints');return issues.length?`The portfolio carries ${issues.join(' and ')}. Tail losses are meaningfully larger than headline VaR; risk reduction should prioritize the largest component-VaR positions.`:'The portfolio shows broadly balanced risk with usable diversification. Tail risk remains material and should be monitored against liquidity and concentration limits.';}
function slug(v){return String(v||'portfolio').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
module.exports={generateReport};
