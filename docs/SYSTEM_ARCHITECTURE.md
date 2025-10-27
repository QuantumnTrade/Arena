# 🏗️ SYSTEM ARCHITECTURE - QUANTUM TRADE

## 📊 **HIGH-LEVEL OVERVIEW**

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                      (Next.js 16 + React)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT LAYER                       │
│                      (Zustand Store)                            │
│  • Account Balance    • Positions    • Assets    • Status      │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ASTER Sync   │  │ AI Trading   │  │  Supabase    │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ASTER DEX API  │  │   AI/ML APIs    │  │   Supabase DB   │
│   (V2 - HMAC)   │  │  (AIML, etc.)   │  │   (PostgreSQL)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🔄 **AUTO-SYNC FLOW (Every 5 Seconds)**

```
┌──────────────┐
│  Page Load   │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ useAsterAccountSync  │ ← Hook initialized
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Every 5 seconds:                        │
│  1. Call GET /api/aster-account          │
│  2. Fetch balance from ASTER             │
│  3. Fetch positions from ASTER           │
│  4. Update Zustand store                 │
│  5. UI re-renders automatically          │
└──────────────────────────────────────────┘
```

---

## 🤖 **AI TRADING FLOW (Manual Trigger)**

```
┌─────────────────────┐
│  User clicks        │
│  "Run AI Analysis"  │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  executeAITradingForAllAgents()                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  For each agent:                               │ │
│  │  1. Fetch market data (BTC, ETH, SOL, BNB)    │ │
│  │  2. Fetch active positions from Supabase      │ │
│  │  3. Call AI API with context                  │ │
│  │  4. Receive AI decisions                      │ │
│  │  5. Process each decision:                    │ │
│  │     ├─ LONG → executeLong()                   │ │
│  │     ├─ SHORT → executeShort()                 │ │
│  │     ├─ CLOSE → executeClose()                 │ │
│  │     ├─ HOLD → Keep position                   │ │
│  │     └─ WAIT → Do nothing                      │ │
│  │  6. Save to Supabase                          │ │
│  │  7. Update agent stats                        │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 📈 **LONG POSITION EXECUTION**

```
┌─────────────────┐
│  AI Decision:   │
│  LONG BTC       │
│  Leverage: 10x  │
│  Size: $100     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  executeLong(decision)                  │
│  ┌───────────────────────────────────┐ │
│  │  1. Convert coin → ASTER symbol   │ │
│  │     BTC → BTCUSDT                 │ │
│  │                                   │ │
│  │  2. Calculate quantity            │ │
│  │     quantity = size_usd / price   │ │
│  │                                   │ │
│  │  3. Set leverage on ASTER         │ │
│  │     changeInitialLeverage(10x)    │ │
│  │                                   │ │
│  │  4. Place MARKET BUY order        │ │
│  │     marketBuy(BTCUSDT, qty)       │ │
│  │     → Returns order ID            │ │
│  │                                   │ │
│  │  5. Place STOP LOSS order         │ │
│  │     placeStopLoss(stopPrice)      │ │
│  │     → Returns SL order ID         │ │
│  │                                   │ │
│  │  6. Place TAKE PROFIT order       │ │
│  │     placeTakeProfit(tpPrice)      │ │
│  │     → Returns TP order ID         │ │
│  └───────────────────────────────────┘ │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Save to Supabase                       │
│  ┌───────────────────────────────────┐ │
│  │  positions table:                 │ │
│  │  - agent_id                       │ │
│  │  - symbol: BTC                    │ │
│  │  - side: LONG                     │ │
│  │  - entry_price                    │ │
│  │  - stop_loss                      │ │
│  │  - take_profit                    │ │
│  │  - size_usd: 100                  │ │
│  │  - leverage: 10                   │ │
│  │  - entry_order_id: 12345 ✅       │ │
│  │  - stop_loss_order_id: 12346 ✅   │ │
│  │  - take_profit_order_id: 12347 ✅ │ │
│  │  - is_active: true                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🔻 **SHORT POSITION EXECUTION**

```
Same flow as LONG, but:
- Uses marketSell() instead of marketBuy()
- Stop loss placed ABOVE entry (resistance)
- Take profit placed BELOW entry (support)
```

---

## ❌ **CLOSE POSITION EXECUTION**

```
┌─────────────────┐
│  AI Decision:   │
│  CLOSE BTC      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  executeClose(coin)                     │
│  ┌───────────────────────────────────┐ │
│  │  1. Get position from ASTER       │ │
│  │     getPositionInfo(BTCUSDT)      │ │
│  │                                   │ │
│  │  2. Detect position side          │ │
│  │     positionAmt > 0 → LONG        │ │
│  │     positionAmt < 0 → SHORT       │ │
│  │                                   │ │
│  │  3. Close at market price         │ │
│  │     closePositionMarket(symbol)   │ │
│  │     → Returns exit price & PnL    │ │
│  └───────────────────────────────────┘ │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Update Supabase                        │
│  ┌───────────────────────────────────┐ │
│  │  positions table:                 │ │
│  │  - is_active: false               │ │
│  │  - exit_price                     │ │
│  │  - exit_time                      │ │
│  │  - exit_reason: "AI_DECISION"     │ │
│  │  - pnl_usd (calculated)           │ │
│  │  - pnl_pct (calculated)           │ │
│  │                                   │ │
│  │  agents table:                    │ │
│  │  - balance (updated)              │ │
│  │  - total_pnl (updated)            │ │
│  │  - trade_count (+1)               │ │
│  │  - win_count or loss_count (+1)   │ │
│  │  - win_rate (recalculated)        │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🗄️ **DATA FLOW**

```
┌──────────────────────────────────────────────────────────┐
│                    ASTER DEX (Live)                      │
│  • Account Balance                                       │
│  • Active Positions                                      │
│  • Order Execution                                       │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Sync every 5s
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Zustand Store (Client-Side)                 │
│  • totalBalance                                          │
│  • availableBalance                                      │
│  • assets: { BNB, USDT }                                 │
│  • positions: [...]                                      │
│  • canTrade                                              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Save on trade
                     ▼
┌──────────────────────────────────────────────────────────┐
│            Supabase Database (Persistent)                │
│  • agents (performance metrics)                          │
│  • positions (trade history)                             │
│  • agent_summaries (AI decisions)                        │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 **AUTHENTICATION FLOW**

```
┌─────────────────┐
│  API Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  ASTER V2 API (HMAC SHA256)             │
│  ┌───────────────────────────────────┐ │
│  │  1. Build query string            │ │
│  │     timestamp=xxx&symbol=BTC...   │ │
│  │                                   │ │
│  │  2. Generate HMAC signature       │ │
│  │     HMAC-SHA256(queryString,      │ │
│  │                 SECRET_KEY)       │ │
│  │                                   │ │
│  │  3. Append signature              │ │
│  │     ...&signature=abc123          │ │
│  │                                   │ │
│  │  4. Add API key to headers        │ │
│  │     X-MBX-APIKEY: your_key        │ │
│  │                                   │ │
│  │  5. Send request                  │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 📦 **FILE STRUCTURE**

```
quantum-trade/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── aster-account/      # Auto-sync endpoint
│   │   │   │   └── route.ts
│   │   │   ├── ai-analysis/        # AI decision endpoint
│   │   │   └── ticker/             # Market data
│   │   └── page.tsx                # Main UI
│   │
│   ├── components/
│   │   ├── AgentsTable.tsx
│   │   ├── CompactMarkets.tsx
│   │   ├── AccountValueChart.tsx
│   │   └── AsterAccountWidget.tsx  # Example widget
│   │
│   ├── hooks/
│   │   ├── use-aster-account.ts    # Account hooks
│   │   └── use-aster-sync.ts       # Auto-sync hook
│   │
│   ├── lib/
│   │   ├── aster-client.ts         # ASTER API client
│   │   ├── aster-execution-service.ts  # Trade execution
│   │   ├── ai-trading-service.ts   # AI trading orchestration
│   │   ├── supabase-service.ts     # Database operations
│   │   └── market-service.ts       # Market data
│   │
│   ├── services/
│   │   └── aster-account-service.ts  # Account sync service
│   │
│   ├── store/
│   │   └── aster-store.ts          # Zustand store
│   │
│   └── types/
│       └── index.ts                # TypeScript types
│
├── docs/
│   ├── REAL_TRADING_GUIDE.md       # Complete guide
│   ├── ASTER_STATE_MANAGEMENT.md   # State management docs
│   └── SYSTEM_ARCHITECTURE.md      # This file
│
├── supabase_schema.sql             # Database schema
├── QUICKSTART.md                   # Quick start guide
└── .env.local                      # Environment variables
```

---

## 🔄 **STATE MANAGEMENT ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────┐
│                   Zustand Store                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  State:                                           │ │
│  │  - isConnected: boolean                           │ │
│  │  - totalBalance: number                           │ │
│  │  - availableBalance: number                       │ │
│  │  - canTrade: boolean                              │ │
│  │  - multiAssetsMode: boolean                       │ │
│  │  - assets: Record<string, AsterAsset>            │ │
│  │  - positions: AsterPosition[]                     │ │
│  │  - totalPositions: number                         │ │
│  │  - totalExposure: number                          │ │
│  │  - totalUnrealizedPnl: number                     │ │
│  │  - lastUpdate: number                             │ │
│  │  - error: string | null                           │ │
│  │                                                   │ │
│  │  Actions:                                         │ │
│  │  - setAccountData()                               │ │
│  │  - setAssets()                                    │ │
│  │  - setPositions()                                 │ │
│  │  - setConnectionStatus()                          │ │
│  │  - reset()                                        │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │
         │ Selective subscriptions
         ▼
┌─────────────────────────────────────────────────────────┐
│                   React Components                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │  const balance = useBNBBalance();                 │ │
│  │  const positions = useActivePositions();          │ │
│  │  const canTrade = useCanTrade();                  │ │
│  │                                                   │ │
│  │  // Only re-renders when subscribed data changes │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 **PERFORMANCE OPTIMIZATIONS**

### **1. Selective Subscriptions**
```typescript
// ✅ GOOD - Only subscribes to totalBalance
const balance = useAsterStore(state => state.totalBalance);

// ❌ BAD - Subscribes to entire store
const store = useAsterStore();
```

### **2. Computed Selectors**
```typescript
export const selectAccountSummary = (state: AsterStore) => ({
  totalBalance: state.totalBalance,
  availableBalance: state.availableBalance,
  // ... computed values
});
```

### **3. Debounced Updates**
- Auto-sync: Every 5 seconds (not every render)
- Market data: Cached with SWR
- Database: Batch updates

---

## 🚀 **DEPLOYMENT CHECKLIST**

- [ ] Environment variables configured
- [ ] ASTER API keys valid
- [ ] Supabase database created
- [ ] Schema applied
- [ ] Agents seeded
- [ ] Balance funded
- [ ] Multi-assets mode enabled
- [ ] Test trade executed successfully

---

## 📊 **MONITORING POINTS**

1. **Client-Side (Browser)**
   - Zustand DevTools
   - Console logs
   - Network tab

2. **Server-Side (API)**
   - API response times
   - Error rates
   - Order execution success rate

3. **Database (Supabase)**
   - Position count
   - Agent performance
   - Trade history

4. **Exchange (ASTER)**
   - Account balance
   - Active orders
   - Position status

---

**System is production-ready for real futures trading! 🚀**
