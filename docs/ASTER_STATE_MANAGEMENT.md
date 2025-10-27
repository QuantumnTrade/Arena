# ASTER State Management Documentation

## Overview

Zustand-based state management untuk ASTER DEX account data dengan best practices:
- ✅ Type-safe state dan actions
- ✅ Selective subscriptions untuk performance optimization
- ✅ Immutable updates
- ✅ DevTools integration (development mode)
- ✅ Auto-refresh capabilities
- ✅ Separation of concerns (Store → Service → Hooks → Components)

---

## Architecture

```
┌─────────────────┐
│   Components    │  ← React Components
└────────┬────────┘
         │ uses
┌────────▼────────┐
│  Custom Hooks   │  ← useAsterAccount, useBNBBalance, etc.
└────────┬────────┘
         │ calls
┌────────▼────────┐
│    Services     │  ← fetchAccountData(), fetchBalances()
└────────┬────────┘
         │ updates
┌────────▼────────┐
│  Zustand Store  │  ← useAsterStore (single source of truth)
└─────────────────┘
```

---

## Quick Start

### 1. Basic Usage

```tsx
import { useAccountSummary, useBNBBalance } from '@/hooks/use-aster-account';

function MyComponent() {
  const summary = useAccountSummary();
  const bnbBalance = useBNBBalance();
  
  return (
    <div>
      <p>Total Balance: ${summary.totalBalance}</p>
      <p>BNB: {bnbBalance}</p>
    </div>
  );
}
```

### 2. With Auto-Refresh

```tsx
import { useAsterAccountWithRefresh, useAccountSummary } from '@/hooks/use-aster-account';

function Dashboard() {
  // Auto-refresh every 30 seconds
  const { isLoading, error, refresh } = useAsterAccountWithRefresh(30000);
  const summary = useAccountSummary();
  
  return (
    <div>
      <button onClick={refresh} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>
      {error && <p>Error: {error}</p>}
      <p>Balance: ${summary.totalBalance}</p>
    </div>
  );
}
```

### 3. Manual Refresh

```tsx
import { useAsterAccountRefresh, usePositions } from '@/hooks/use-aster-account';

function PositionsList() {
  const { refresh, refreshPositions } = useAsterAccountRefresh();
  const positions = usePositions();
  
  return (
    <div>
      <button onClick={refreshPositions}>Refresh Positions Only</button>
      <button onClick={refresh}>Refresh All</button>
      {positions.map(p => <div key={p.symbol}>{p.symbol}</div>)}
    </div>
  );
}
```

---

## Available Hooks

### Account Data

| Hook | Returns | Description |
|------|---------|-------------|
| `useAccountSummary()` | `{ totalBalance, availableBalance, ... }` | Account summary (optimized) |
| `useBNBBalance()` | `number` | BNB available balance |
| `useUSDTBalance()` | `number` | USDT available balance |
| `useAssetBalance(asset)` | `AsterAsset \| undefined` | Specific asset balance |
| `useCanTrade()` | `boolean` | Check if can trade |
| `useMultiAssetsMode()` | `boolean` | Multi-assets mode status |

### Positions

| Hook | Returns | Description |
|------|---------|-------------|
| `usePositions()` | `AsterPosition[]` | All positions |
| `useActivePositions()` | `AsterPosition[]` | Active positions only (positionAmt !== 0) |
| `usePosition(symbol)` | `AsterPosition \| undefined` | Specific position |

### Connection

| Hook | Returns | Description |
|------|---------|-------------|
| `useConnectionStatus()` | `{ isConnected, error, lastUpdate }` | Connection status |

### Refresh

| Hook | Returns | Description |
|------|---------|-------------|
| `useAsterAccountWithRefresh(interval, enabled)` | `{ isLoading, error, refresh }` | Auto-refresh with interval |
| `useAsterAccountRefresh()` | `{ refresh, refreshBalances, refreshPositions }` | Manual refresh functions |
| `useAsterAccountInit()` | `void` | Initialize on mount |

---

## Performance Optimization

### ✅ DO: Selective Subscriptions

```tsx
// ✅ GOOD - Only subscribes to totalBalance
const totalBalance = useAsterStore(state => state.totalBalance);

// ✅ GOOD - Using optimized selector
const summary = useAccountSummary();
```

### ❌ DON'T: Full State Subscription

```tsx
// ❌ BAD - Subscribes to entire store, re-renders on any change
const store = useAsterStore();
const totalBalance = store.totalBalance;
```

---

## Direct Store Access (Advanced)

```tsx
import { useAsterStore } from '@/store/aster-store';

// Get state outside React components
const state = useAsterStore.getState();
console.log(state.totalBalance);

// Subscribe to changes
const unsubscribe = useAsterStore.subscribe(
  (state) => console.log('Balance changed:', state.totalBalance)
);

// Update state directly
useAsterStore.getState().setAccountData({
  totalBalance: 1000,
  canTrade: true,
});
```

---

## Service Layer

### Fetch Account Data

```tsx
import { fetchAccountData, fetchBalances, fetchPositions } from '@/services/aster-account-service';

// Fetch full account data
await fetchAccountData();

// Fetch only balances (lighter)
await fetchBalances();

// Fetch only positions (lighter)
await fetchPositions();
```

---

## Type Definitions

### AsterAsset

```typescript
interface AsterAsset {
  asset: string;
  balance: number;
  availableBalance: number;
  crossWalletBalance: number;
  unrealizedPnl: number;
}
```

### AsterPosition

```typescript
interface AsterPosition {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  liquidationPrice: number;
  leverage: number;
  positionSide: string;
}
```

### AsterAccountState

```typescript
interface AsterAccountState {
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
  totalBalance: number;
  availableBalance: number;
  canTrade: boolean;
  multiAssetsMode: boolean;
  assets: Record<string, AsterAsset>;
  positions: AsterPosition[];
  totalPositions: number;
  totalExposure: number;
  totalUnrealizedPnl: number;
  serverTime: string | null;
  timeDiff: number;
}
```

---

## Example: Complete Dashboard

```tsx
'use client';

import {
  useAsterAccountWithRefresh,
  useAccountSummary,
  useBNBBalance,
  useUSDTBalance,
  useActivePositions,
} from '@/hooks/use-aster-account';

export default function TradingDashboard() {
  // Auto-refresh every 30 seconds
  const { isLoading, error, refresh } = useAsterAccountWithRefresh(30000);
  
  // Selective subscriptions
  const summary = useAccountSummary();
  const bnbBalance = useBNBBalance();
  const usdtBalance = useUSDTBalance();
  const activePositions = useActivePositions();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trading Dashboard</h1>
        <button onClick={refresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Balance */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3>Total Balance</h3>
          <p className="text-3xl">${summary.totalBalance.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>BNB</h3>
          <p className="text-3xl">{bnbBalance.toFixed(6)}</p>
        </div>
        <div className="card">
          <h3>USDT</h3>
          <p className="text-3xl">{usdtBalance.toFixed(2)}</p>
        </div>
      </div>

      {/* Positions */}
      <div>
        <h2 className="text-xl mb-4">
          Active Positions ({summary.totalPositions})
        </h2>
        {activePositions.map((position) => (
          <div key={position.symbol} className="card mb-2">
            <div className="flex justify-between">
              <span>{position.symbol}</span>
              <span className={position.unrealizedProfit >= 0 ? 'text-green' : 'text-red'}>
                ${position.unrealizedProfit.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="mt-6">
        <p>Can Trade: {summary.canTrade ? '✅' : '❌'}</p>
        <p>Multi-Assets Mode: {summary.multiAssetsMode ? '✅' : '❌'}</p>
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Use Selective Subscriptions

```tsx
// ✅ GOOD
const totalBalance = useAsterStore(state => state.totalBalance);

// ❌ BAD
const { totalBalance } = useAsterStore();
```

### 2. Use Custom Hooks

```tsx
// ✅ GOOD
const bnbBalance = useBNBBalance();

// ❌ BAD
const bnbBalance = useAsterStore(state => state.assets['BNB']?.availableBalance || 0);
```

### 3. Fetch Data in Services, Not Components

```tsx
// ✅ GOOD
import { fetchAccountData } from '@/services/aster-account-service';
await fetchAccountData();

// ❌ BAD
const balances = await AsterClient.getAccountBalance();
useAsterStore.getState().setAssets(balances);
```

### 4. Use Auto-Refresh for Real-Time Data

```tsx
// ✅ GOOD - Auto-refresh every 30s
const { refresh } = useAsterAccountWithRefresh(30000);

// ❌ BAD - Manual polling
useEffect(() => {
  const interval = setInterval(() => {
    fetchAccountData();
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

---

## Debugging

### Enable DevTools (Development Only)

Zustand DevTools automatically enabled in development mode.

Open Redux DevTools extension in browser to inspect:
- Current state
- State changes
- Action history
- Time-travel debugging

---

## Migration Guide

### From Direct API Calls

**Before:**
```tsx
const [balance, setBalance] = useState(0);

useEffect(() => {
  async function fetch() {
    const data = await AsterClient.getAccountBalance();
    setBalance(data[0].balance);
  }
  fetch();
}, []);
```

**After:**
```tsx
useAsterAccountInit(); // In root component
const balance = useBNBBalance(); // In any component
```

---

## FAQ

**Q: How do I refresh data manually?**
```tsx
const { refresh } = useAsterAccountRefresh();
await refresh();
```

**Q: How do I get data outside React components?**
```tsx
import { useAsterStore } from '@/store/aster-store';
const balance = useAsterStore.getState().totalBalance;
```

**Q: How do I reset the store?**
```tsx
import { resetAccountData } from '@/services/aster-account-service';
resetAccountData();
```

**Q: Why is my component re-rendering too much?**
Use selective subscriptions instead of full store subscription.

---

## Files Structure

```
src/
├── store/
│   └── aster-store.ts          # Zustand store definition
├── services/
│   └── aster-account-service.ts # Service layer for API calls
├── hooks/
│   └── use-aster-account.ts    # Custom hooks
└── components/
    └── AsterAccountWidget.tsx  # Example component
```
