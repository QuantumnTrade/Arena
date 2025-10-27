# 🚀 REAL TRADING IMPLEMENTATION GUIDE

## ✅ **PRODUCTION READY - REAL FUTURES TRADING**

Sistem sudah **FULLY INTEGRATED** dengan ASTER DEX V2 API untuk real futures trading!

---

## 📋 **SYSTEM OVERVIEW**

### **1. Auto-Sync Account Data (Every 5 Seconds)**

**API Endpoint:** `GET /api/aster-account`

**Features:**
- ✅ Fetches real account balance (USDT + BNB)
- ✅ Fetches active positions from ASTER
- ✅ Updates Zustand store automatically
- ✅ Multi-assets mode detection
- ✅ Can trade status check

**Hook:** `useAsterAccountSync()`
- Auto-runs on page load
- Syncs every 5 seconds
- Updates store in background

**Location:** `src/hooks/use-aster-sync.ts`

---

### **2. Real Futures Trading Execution**

**Service:** `aster-execution-service.ts`

**Supported Operations:**

#### **LONG (BUY)**
```typescript
executeLong(decision: AIDecision)
```
- Sets leverage
- Places MARKET BUY order
- Places STOP LOSS order
- Places TAKE PROFIT order
- Returns order ID

#### **SHORT (SELL)**
```typescript
executeShort(decision: AIDecision)
```
- Sets leverage
- Places MARKET SELL order
- Places STOP LOSS order
- Places TAKE PROFIT order
- Returns order ID

#### **CLOSE**
```typescript
executeClose(coin: string)
```
- Detects position side (LONG/SHORT)
- Closes position at market price
- Returns final PnL

---

### **3. AI Trading Flow**

**Trigger:** Button "Run AI Analysis" di `page.tsx`

**Flow:**
```
1. User clicks "Run AI Analysis"
   ↓
2. Fetch market data (BTC, ETH, SOL, BNB)
   ↓
3. Fetch active positions from Supabase
   ↓
4. Call AI API (/api/ai-analysis)
   ↓
5. AI analyzes and returns decisions
   ↓
6. For each decision:
   - LONG/SHORT → Execute real order on ASTER
   - CLOSE → Close position on ASTER
   - HOLD → Keep position
   - WAIT → Do nothing
   ↓
7. Save all data to Supabase:
   - Position entry (with ASTER order IDs)
   - Position exit (with PnL)
   - Agent stats update
   - Agent summary
```

---

## 🗄️ **DATABASE STORAGE**

### **Positions Table**

**Stored Fields:**
```sql
- id (auto-increment)
- agent_id (FK to agents)
- symbol (BTC, ETH, SOL, BNB)
- side (LONG, SHORT)
- entry_price
- exit_price
- stop_loss
- take_profit
- size_usd
- size_pct
- confidence
- entry_time
- exit_time
- exit_reason
- reasoning (AI justification)
- exit_strategy
- pnl_usd
- pnl_pct
- leverage
- quantity
- risk_usd
- liquidation_price
- invalidation_condition
- entry_order_id (ASTER order ID) ✅
- stop_loss_order_id (ASTER order ID) ✅
- take_profit_order_id (ASTER order ID) ✅
- is_active
```

### **Agents Table**

**Updated Fields:**
```sql
- balance (updated after each trade)
- total_pnl (cumulative PnL)
- roi (return on investment)
- trade_count (total trades)
- win_count (winning trades)
- loss_count (losing trades)
- win_rate (win percentage)
- active_positions (current open positions)
- available_capital (balance - exposure)
```

### **Agent Summaries Table**

**Stored Fields:**
```sql
- agent_id
- session_timestamp
- invocation_count
- total_decisions
- decisions_made (JSONB array)
- balance_at_time
- total_exposure_at_time
- active_positions_at_time
- conclusion (AI summary)
```

---

## 🔧 **CONFIGURATION**

### **Environment Variables**

```bash
# ASTER DEX API (V2)
NEXT_PUBLIC_ASTER_BASE_URL=https://fapi.asterdex.com
NEXT_PUBLIC_ASTER_API_KEY=your_api_key
NEXT_PUBLIC_ASTER_SECRET_KEY=your_secret_key

# Supabase
NEXT_PUBLIC_QUANTUM_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_QUANTUM_SUPABASE_KEY=your_supabase_anon_key

# AI APIs
NEXT_PUBLIC_AIML_API_KEY=your_aiml_key
```

---

## 📊 **TRADING PARAMETERS**

### **Leverage Options**
- 5x, 8x, 10x, 12x, 15x, 20x
- AI decides based on confidence and setup

### **Position Sizing**
```
risk_usd = balance × risk_percentage (5-15%)
size_usd = risk_usd × leverage
Max exposure: 65% of balance
```

### **Stop Loss**
- Min: 0.3% from entry
- Adaptive based on volatility
- Placed below support (LONG) or above resistance (SHORT)

### **Take Profit**
- Min: 0.5% from entry
- Target: 1-10% depending on duration
- Placed at nearest resistance (LONG) or support (SHORT)

### **Risk:Reward Ratio**
- Target: ≥ 1.5:1
- Flexible based on market structure

---

## 🎯 **USAGE EXAMPLE**

### **1. Start Application**

```bash
npm run dev
```

### **2. Auto-Sync Starts**
- Account data syncs every 5 seconds
- Balance visible in Zustand store
- Check DevTools Redux extension

### **3. Trigger AI Analysis**
- Click "Run AI Analysis" button
- AI analyzes market data
- Decisions executed automatically

### **4. Monitor Trades**
- Check Supabase `positions` table
- View real-time PnL
- Track order IDs from ASTER

---

## 🔍 **VERIFICATION CHECKLIST**

### **Before Trading:**
- [ ] ASTER API keys configured
- [ ] Supabase connected
- [ ] Balance > 0 (USDT or BNB)
- [ ] Multi-assets mode enabled
- [ ] Can trade = true

### **After Trade Execution:**
- [ ] Position created in Supabase
- [ ] ASTER order ID stored
- [ ] Stop loss order placed
- [ ] Take profit order placed
- [ ] Agent balance updated

### **After Trade Close:**
- [ ] Position marked inactive
- [ ] Exit price recorded
- [ ] PnL calculated correctly
- [ ] Agent stats updated (win/loss count)
- [ ] Agent summary created

---

## 🚨 **ERROR HANDLING**

### **Common Errors:**

**1. Insufficient Balance**
```
Error: Insufficient balance for trade
Solution: Add USDT or BNB to futures wallet
```

**2. Position Already Exists**
```
Error: Position already exists for symbol
Solution: Close existing position first
```

**3. API Rate Limit**
```
Error: Too many requests
Solution: Wait 1 minute, reduce analysis frequency
```

**4. Invalid Leverage**
```
Error: Leverage not allowed
Solution: Check ASTER leverage limits for symbol
```

---

## 📈 **MONITORING**

### **Real-Time Data:**
- Zustand store (DevTools)
- ASTER account balance
- Active positions
- Unrealized PnL

### **Historical Data:**
- Supabase positions table
- Agent performance metrics
- Trade history with order IDs

### **Logs:**
```
[ASTER Sync] ✅ Account synced
[AI Trading] 🚀 EXECUTING REAL LONG on ASTER for BTC
[ASTER Execution] LONG order placed successfully
[AI Trading] ✅ ASTER order executed successfully! Order ID: 12345
[AI Trading] 💾 Position saved to database with order IDs
```

---

## 🎉 **FEATURES COMPLETED**

✅ **V2 API Integration** - HMAC SHA256 authentication
✅ **Auto-Sync** - Every 5 seconds via `/api/aster-account`
✅ **Zustand Store** - Centralized state management
✅ **Real Trading** - LONG/SHORT/CLOSE execution
✅ **Database Storage** - All trade data saved
✅ **Order ID Tracking** - ASTER order IDs stored
✅ **PnL Calculation** - Real-time and historical
✅ **Agent Stats** - Win rate, ROI, trade count
✅ **Multi-Assets Mode** - BNB + USDT support
✅ **Error Handling** - Comprehensive error messages

---

## 🔐 **SECURITY NOTES**

1. **API Keys:** Never commit to Git
2. **Environment Variables:** Use `.env.local`
3. **Database:** RLS disabled for demo (enable for production)
4. **Rate Limiting:** Respect ASTER API limits
5. **Position Limits:** Max 65% exposure per agent

---

## 📞 **SUPPORT**

**Issues?**
1. Check console logs
2. Verify API keys
3. Check Supabase connection
4. Review ASTER account status

**Documentation:**
- ASTER API: `docs/ASTER_STATE_MANAGEMENT.md`
- Database: `supabase_schema.sql`
- Trading Service: `src/lib/ai-trading-service.ts`

---

## 🚀 **READY TO TRADE!**

System is **PRODUCTION READY** for real futures trading on ASTER DEX!

**Next Steps:**
1. Fund your ASTER account (USDT or BNB)
2. Enable multi-assets mode
3. Click "Run AI Analysis"
4. Watch AI trade automatically! 🤖💰
