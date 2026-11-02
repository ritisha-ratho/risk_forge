'use strict';
const path=require('path');
const express=require('express');
const helmet=require('helmet');
const compression=require('compression');
const {analyzePortfolio}=require('./risk-engine');
const {generateReport}=require('./report');

const app=express();
const PORT=Number(process.env.PORT)||4173;
const ROOT=path.resolve(__dirname,'..');

app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false}));
app.use(compression());
app.use(express.json({limit:'1mb'}));

app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'riskforge-api'}));
app.post('/api/analyze',(req,res)=>{
  try{res.json(analyzePortfolio(req.body));}
  catch(error){res.status(400).json({error:error.message||'Analysis failed'});}
});
app.post('/api/report',(req,res)=>{
  try{const analysis=analyzePortfolio(req.body);generateReport(res,req.body,analysis);}
  catch(error){if(!res.headersSent)res.status(400).json({error:error.message||'Report generation failed'});}
});

app.use(express.static(ROOT,{extensions:['html'],index:'index.html'}));
app.get('*',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));

app.listen(PORT,()=>console.log(`RiskForge running at http://127.0.0.1:${PORT}`));
