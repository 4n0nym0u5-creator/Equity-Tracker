# Equity Performance Tracker

A polished, real-time dashboard tracking major equities with 200-week moving average buy signals, performance metrics, and comparison tools.

![Dashboard Preview](https://via.placeholder.com/800x400/0a0e1a/4dc3ff?text=Equity+Performance+Tracker)

## Features

### Tracked Assets
- **ETFs**: NDQ.AX (NASDAQ 100), HNDQ.AX (Hedged)
- **Tech Giants**: TSLA, GOOGL, GOOG, AAPL, AMZN, META, MSFT, NFLX, NVDA
- **Space**: SPCX (SpaceX - post-IPO)
- **AustralianSuper**: International & Australian Shares options

### Key Metrics
- **200-Week Moving Average**: Primary trend indicator with buy signals when price falls below
- **Buy Zone Detection**: Historical analysis of accumulation opportunities
- **Trailing Returns**: 1, 3, 5, and 10-year annualized performance
- **Growth Charts**: Rebased $100 growth since 2015
- **Comparison Tools**: Side-by-side performance analysis

## Live Demo

The dashboard auto-refreshes data from:
- **Yahoo Finance**: Real-time prices for all equities
- **AustralianSuper API**: Official crediting rates and performance data
- **SpaceX IPO Data**: Post-IPO market data + historical private valuations

## Quick Start

### Prerequisites
- Python 3.11+
- pip

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/equity-performance-tracker.git
cd equity-performance-tracker

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running Locally

```bash
# Start the server with auto-refresh endpoint
python serve.py

# Dashboard available at: http://127.0.0.1:8420
```

The server includes a `/api/refresh` endpoint that re-runs the data scraper (Yahoo Finance + AustralianSuper) and hot-reloads the dashboard.

### Manual Data Refresh

```bash
# Refresh all data from sources
python fetch_data.py
```

## Architecture

```
equity-performance-tracker/
├── css/
│   └── styles.css          # Dark theme, glassmorphism UI
├── data/
│   └── dashboard.js        # Generated data file (auto-created)
├── js/
│   └── app.js              # Dashboard logic & charts
├── vendor/
│   └── echarts.min.js      # Charting library
├── fetch_data.py           # Data pipeline
├── serve.py                # Local server with refresh API
├── index.html              # Main dashboard
└── requirements.txt        # Python dependencies
```

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| Yahoo Finance | NDQ, HNDQ, TSLA, GOOGL, GOOG, AAPL, AMZN, META, MSFT, NFLX, NVDA, SPCX | Real-time via API |
| AustralianSuper API | Daily crediting rates | Daily |
| AustralianSuper Excel | Official 1/3/5/10yr returns | Monthly |
| Press Reports | SpaceX private valuations | Historical |

## 200-Week MA Strategy

The 200-week simple moving average is a long-term trend indicator:
- **Above MA**: Trend is bullish, no buy signal
- **Below MA**: Potential accumulation zone (rare historically)
- **Buy Zones**: Contiguous weeks below the MA with % below recorded

## Tech Stack

- **Frontend**: Vanilla JavaScript, ECharts, CSS3 (glassmorphism)
- **Backend**: Python 3.11, http.server (with custom handler)
- **Data**: Pandas, curl_cffi (for Yahoo Finance API)
- **Styling**: Inter & JetBrains Mono fonts, dark theme

## License

MIT License - Feel free to use and modify for your own portfolio tracking.

## Disclaimer

This dashboard is for informational purposes only. Not financial advice. Past performance does not guarantee future results.

---

**Built with ❤️ for tracking equity performance**