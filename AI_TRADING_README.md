# 🤖 AI Trading System - Complete Documentation

Sistem trading otomatis menggunakan multiple AI agents (Grok, Deepseek, Gemini, OpenAI) untuk analisis market dan eksekusi trading.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Features](#features)
3. [Setup Guide](#setup-guide)
4. [How It Works](#how-it-works)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Market   │  │   Agent    │  │  Position  │            │
│  │  Dashboard │  │  Details   │  │   Cards    │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Routes (Server-Side)                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  /api/ai-analysis                                  │     │
│  │  - Secure AIML API calls                           │     │
│  │  - API key protection                              │     │
│  │  - Request validation                              │     │
│  └────────────────────────────────────────────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  AIML API    │  │  Supabase    │  │  Market Data │
│  (AI Models) │  │  (Database)  │  │  (External)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## ✨ Features

### **1. Multi-Agent AI Trading**
- ✅ 4 AI agents: Grok, Deepseek, Gemini, OpenAI
- ✅ Independent analysis and decision-making
- ✅ Real-time market data processing
- ✅ Multi-timeframe analysis (1M, 5M, 15M, 1H, 4H)

### **2. Position Management**
- ✅ Automatic position opening (LONG/SHORT)
- ✅ Stop-loss and take-profit management
- ✅ Leverage control (5x-20x)
- ✅ Risk management (position sizing, exposure limits)
- ✅ Position tracking and PnL calculation

### **3. Agent Performance Tracking**
- ✅ Real-time balance and PnL
- ✅ Win rate and ROI metrics
- ✅ Trade history (active + closed positions)
- ✅ Decision snapshots (agent summaries)

### **4. Security & Best Practices**
- ✅ Server-side API key management
- ✅ No client-side API key exposure
- ✅ Supabase RLS support
- ✅ Input validation and error handling

---

## 🚀 Setup Guide

### **Prerequisites**
- Node.js 18+ installed
- Supabase account
- AIML API account

### **Step 1: Clone & Install**
```bash
git clone <your-repo>
cd quantum-trade
npm install
```

### **Step 2: Database Setup**
1. Create new Supabase project
2. Run SQL schema:
   ```bash
   # Open Supabase SQL Editor
   # Copy-paste content from supabase_schema.sql
   # Click "Run"
   ```
3. Verify tables created:
   - `agents`
   - `positions`
   - `agent_summaries`
   - `market_data`

### **Step 3: Environment Variables**
Create `.env.local`:
```bash
NEXT_PUBLIC_QUANTUM_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_QUANTUM_SUPABASE_KEY=your-anon-key
AIML_API_KEY=your-aiml-key
```

See [ENV_SETUP.md](./ENV_SETUP.md) for detailed configuration.

### **Step 4: Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔄 How It Works

### **1. Manual Trigger Flow**

```
User clicks "Run AI Analysis" button
         ↓
Frontend calls executeAITradingForAllAgents()
         ↓
For each active agent:
  1. Fetch market data (BTC, ETH, SOL, BNB)
  2. Fetch active positions
  3. Call /api/ai-analysis (server-side)
  4. AIML API analyzes and returns decisions
  5. Process decisions:
     - LONG/SHORT → Create position
     - CLOSE → Close position + update stats
     - HOLD → Keep position
     - WAIT → No action
  6. Create agent summary
  7. Update agent stats
         ↓
Results displayed in UI
```

### **2. AI Decision Making**

Each AI agent receives:
- **Market Data**: Current prices, indicators (RSI, MACD, etc.)
- **Active Positions**: Existing trades with entry, SL, TP
- **Account Info**: Balance, available capital
- **System Prompt**: Trading strategy and rules

AI returns JSON with decisions for each symbol:
```json
{
  "decisions": {
    "BTC": {
      "trade_signal_args": {
        "coin": "BTC",
        "signal": "long",
        "entry_price": 105000,
        "stop_loss": 104500,
        "profit_target": 106000,
        "leverage": 10,
        "confidence": 0.75,
        "size_usd": 1000,
        "risk_usd": 50,
        "expected_duration": "30min",
        "justification": "5M bounce + 15M support at 105k",
        "invalidation_condition": "5M closes below 104800"
      }
    }
  },
  "conclusion": "BTC bullish, ETH neutral, SOL weak"
}
```

### **3. Position Lifecycle**

```
OPEN (LONG/SHORT signal)
  ↓
ACTIVE (monitoring)
  ↓
CLOSE (TP hit / SL hit / AI decision / invalidation)
  ↓
PnL calculated → Agent stats updated
```

---

## 📡 API Reference

### **POST /api/ai-analysis**

**Purpose**: Secure server-side AI analysis endpoint

**Request Body**:
```typescript
{
  agentId: string;
  agentModel: string;
  systemPrompt: string;
  marketData: Array<{
    symbol: string;
    price: number;
    indicators?: any;
  }>;
  activePositions?: Position[];
  balance: number;
  availableCapital: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  agentId: string;
  agentModel: string;
  decision: AIResponse;
  timestamp: string;
}
```

**Error Handling**:
- `400`: Missing required fields
- `500`: AIML API error or server error

---

## 🗄️ Database Schema

### **agents** Table
Stores AI agent information and performance metrics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `model` | VARCHAR | Agent name (grok, deepseek, etc.) |
| `balance` | DECIMAL | Current balance |
| `total_pnl` | DECIMAL | Total profit/loss |
| `roi` | DECIMAL | Return on investment (%) |
| `trade_count` | INTEGER | Total trades |
| `win_count` | INTEGER | Winning trades |
| `loss_count` | INTEGER | Losing trades |
| `win_rate` | DECIMAL | Win rate (%) |
| `active_positions` | INTEGER | Number of active positions |
| `available_capital` | DECIMAL | Available capital for trading |
| `system_prompt` | TEXT | AI system instructions |

### **positions** Table
Stores trading positions (active and closed).

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `agent_id` | BIGINT | Foreign key to agents |
| `symbol` | VARCHAR | Trading symbol (BTC, ETH, etc.) |
| `side` | VARCHAR | LONG or SHORT |
| `entry_price` | DECIMAL | Entry price |
| `exit_price` | DECIMAL | Exit price (null if active) |
| `stop_loss` | DECIMAL | Stop loss price |
| `take_profit` | DECIMAL | Take profit price |
| `size_usd` | DECIMAL | Position size in USD |
| `leverage` | INTEGER | Leverage multiplier |
| `confidence` | DECIMAL | AI confidence (0-1) |
| `pnl_usd` | DECIMAL | Profit/loss in USD |
| `pnl_pct` | DECIMAL | Profit/loss in % |
| `is_active` | BOOLEAN | Position status |
| `reasoning` | TEXT | AI reasoning for trade |
| `invalidation_condition` | TEXT | Exit trigger condition |

### **agent_summaries** Table
Stores periodic snapshots of AI decisions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `agent_id` | BIGINT | Foreign key to agents |
| `session_timestamp` | TIMESTAMPTZ | Snapshot time |
| `decisions_made` | JSONB | Array of AI decisions |
| `conclusion` | TEXT | AI conclusion summary |
| `balance_at_time` | DECIMAL | Balance at snapshot |
| `total_exposure_at_time` | DECIMAL | Total exposure |

---

## 🔒 Security

### **API Key Protection**
✅ **DO**:
- Store `AIML_API_KEY` without `NEXT_PUBLIC_` prefix
- Call AIML API only from server-side routes
- Validate all inputs before processing

❌ **DON'T**:
- Never expose API keys to client-side
- Never commit `.env.local` to git
- Never hardcode API keys in source code

### **Supabase Security**
- Use Row Level Security (RLS) for production
- Grant appropriate permissions (see `supabase_schema.sql`)
- Rotate API keys regularly

---

## 🐛 Troubleshooting

### **Issue: "Missing AIML_API_KEY"**
**Solution**: 
1. Check `.env.local` has `AIML_API_KEY` (no `NEXT_PUBLIC_`)
2. Restart dev server: `npm run dev`

### **Issue: "Failed to fetch agents"**
**Solution**:
1. Verify Supabase URL and KEY in `.env.local`
2. Check SQL schema is executed
3. Verify permissions in Supabase

### **Issue: "AI analysis returns error"**
**Solution**:
1. Check AIML API key is valid
2. Check API quota/limits
3. Verify request format in browser console

### **Issue: "Positions not showing"**
**Solution**:
1. Check if agents have active positions in database
2. Verify `fetchAllPositions()` is working
3. Check browser console for errors

---

## 📊 Component Structure

```
src/
├── app/
│   ├── api/
│   │   └── ai-analysis/
│   │       └── route.ts          # Secure AIML API endpoint
│   └── page.tsx                  # Main dashboard
├── components/
│   ├── AgentDetail.tsx           # Agent detail with tabs
│   ├── AgentsTable.tsx           # Agents summary table
│   ├── CompactMarkets.tsx        # Market tiles
│   └── AccountValueChart.tsx     # Performance chart
├── lib/
│   ├── api.ts                    # API client functions
│   ├── ai-trading-service.ts     # AI trading orchestrator
│   ├── supabase-service.ts       # Database operations
│   └── market-service.ts         # Market data aggregation
└── types/
    └── index.ts                  # TypeScript types
```

---

## 🎯 Next Steps

### **Automated Trading (Optional)**
Add polling mechanism to run AI analysis automatically:

```typescript
// In page.tsx
useEffect(() => {
  const interval = setInterval(async () => {
    if (agents.length > 0) {
      await executeAITradingForAllAgents(agents);
    }
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, [agents]);
```

### **Exchange Integration (Future)**
- Connect to Binance/Bybit API
- Execute real trades
- Sync positions with exchange
- Handle order management

### **Advanced Features**
- Backtesting system
- Performance analytics
- Risk management dashboard
- Multi-timeframe charts
- Webhook notifications

---

## 📞 Support

For issues or questions:
1. Check [ENV_SETUP.md](./ENV_SETUP.md) for configuration
2. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for database setup
3. Review browser console and server logs
4. Verify all environment variables are set correctly

---

**Built with**: Next.js 16, TypeScript, Supabase, AIML API, TailwindCSS

**Last Updated**: 2025-01-24
