# RiskForge

RiskForge is a local-first quantitative portfolio stress-testing application. It accepts equity portfolios, estimates tail risk and covariance structure, runs scenario diagnostics, attributes component risk, and produces a multi-page PDF risk report.

The repository contains a dependency-light browser frontend and a Node.js analytics/reporting API. Portfolio files and model requests are processed locally by the running application.

## Features

- CSV and text-based PDF portfolio ingestion
- Parametric, Monte Carlo proxy, and historical proxy VaR
- Conditional VaR / Expected Shortfall
- Euler component-VaR attribution
- Correlation and sector-concentration analysis
- Six macro and historical stress scenarios
- Portfolio beta, annualized volatility, Sharpe and Sortino ratios
- Expected maximum drawdown and one-day loss probability
- HHI concentration and effective-position breadth
- Systematic versus idiosyncratic risk decomposition
- Style-factor exposure diagnostics
- Liquidity-capacity estimates
- Covariance stability, shrinkage, rank, and condition diagnostics
- Downloadable CSV analysis data
- Server-generated, multi-page PDF reports
- Responsive desktop and mobile layouts

## Project structure

```text
riskforge/
├── backend/
│   ├── server.js          # Express API and static file server
│   ├── risk-engine.js     # Portfolio analytics and risk decomposition
│   └── report.js          # PDFKit report generator
├── app.js                 # Frontend state, uploads, visualizations and API client
├── index.html             # Application markup
├── styles.css             # Responsive design system
├── sample-portfolio.csv   # Example import file
├── package.json
├── Dockerfile
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm 9 or newer

## Local setup

```bash
git clone <your-repository-url>
cd riskforge
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173).

For backend development with automatic restart:

```bash
npm run dev
```

Run syntax checks:

```bash
npm run check
```

## Portfolio CSV format

The required columns are `ticker`, `name`, `value`, and `sector`.

```csv
ticker,name,value,sector
MSFT,Microsoft,1250000,Technology
JPM,JPMorgan Chase,950000,Financials
NOVO,Novo Nordisk,875000,Healthcare
```

Market values must be positive numbers. The browser validates the file before analysis and limits the interactive table to 18 positions.

PDF ingestion supports text-based statements containing recognizable stock tickers. Scanned-image PDFs require OCR before import. For production ingestion, replace the browser heuristic with a validated statement parser.

## API

### `GET /api/health`

Returns the API status.

### `POST /api/analyze`

Accepts portfolio metadata, holdings, horizon, and confidence level. Returns summary risk, concentration, liquidity, factor, covariance, and component-VaR diagnostics.

### `POST /api/report`

Accepts the same payload and returns a generated `application/pdf` document.

## Deployment

The application can be deployed to any Node.js host. Set `PORT` if the platform does not use port 4173.

```bash
PORT=8080 npm start
```

Docker:

```bash
docker build -t riskforge .
docker run --rm -p 4173:4173 riskforge
```

For services such as Render, Railway, Fly.io, or a VPS, use `npm start` as the start command. The backend serves the frontend and API from the same origin, so no separate CORS configuration is required.

## Model notes

The demo portfolios use synthetic volatility, correlation, factor, and liquidity calibrations. The current engine is appropriate for product demonstration and architecture review—not for live capital allocation.

Production deployment should add validated historical prices, currency normalization, security-level liquidity data, formal backtesting, authentication, durable storage, rate limits, request auditing, and monitoring.

RiskForge output is not investment advice and should not be the sole basis for an investment decision.
