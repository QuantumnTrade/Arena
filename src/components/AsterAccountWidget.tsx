/**
 * ASTER Account Widget
 * 
 * Example component demonstrating Zustand store usage
 * Shows account balance, positions, and refresh functionality
 */

'use client';

import { useAccountSummary, useBNBBalance, useUSDTBalance, useActivePositions, useAsterAccountWithRefresh } from '@/hooks/use-aster-account';

export default function AsterAccountWidget() {
  // Auto-refresh every 30 seconds
  const { isLoading, error, refresh } = useAsterAccountWithRefresh(30000);
  
  // Selective subscriptions (optimized performance)
  const summary = useAccountSummary();
  const bnbBalance = useBNBBalance();
  const usdtBalance = useUSDTBalance();
  const activePositions = useActivePositions();

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800/50 p-6 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">ASTER Account</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 text-white text-sm transition-colors"
        >
          {isLoading ? '⟳ Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 rounded bg-black/60 border border-slate-800/50 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Balance Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Total Balance</div>
          <div className="text-2xl font-bold text-slate-100">
            ${ (summary?.totalBalance ?? 0).toFixed(2) }
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/50">
          <div className="text-xs text-slate-400 mb-1">Available</div>
          <div className="text-2xl font-bold text-slate-100">
            ${ (summary?.availableBalance ?? 0).toFixed(2) }
          </div>
        </div>
      </div>

      {/* Assets */}
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-300 mb-2">Assets</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded bg-slate-800/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 font-bold text-sm">
                BNB
              </div>
              <span className="text-slate-300">BNB</span>
            </div>
            <div className="text-right">
              <div className="text-slate-100 font-semibold">{bnbBalance.toFixed(6)}</div>
              <div className="text-xs text-slate-400">Available</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded bg-slate-800/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 font-bold text-sm">
                $
              </div>
              <span className="text-slate-300">USDT</span>
            </div>
            <div className="text-right">
              <div className="text-slate-100 font-semibold">{usdtBalance.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions */}
      <div>
        <div className="text-sm font-semibold text-slate-300 mb-2">
          Active Positions ({ summary?.totalPositions ?? 0 })
        </div>
        {activePositions.length === 0 ? (
          <div className="p-4 rounded bg-slate-800/30 text-center text-slate-400 text-sm">
            No active positions
          </div>
        ) : (
          <div className="space-y-2">
            {activePositions.map((position) => (
              <div
                key={position.symbol}
                className="p-3 rounded bg-slate-800/30 border border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-100">{position.symbol}</div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      position.positionAmt > 0
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {position.positionAmt > 0 ? 'LONG' : 'SHORT'} {position.leverage}x
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Entry</div>
                    <div className="text-slate-200">${position.entryPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Mark</div>
                    <div className="text-slate-200">${position.markPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">PnL</div>
                    <div
                      className={
                        position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      }
                    >
                      ${position.unrealizedProfit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${ summary?.canTrade ? 'bg-green-400' : 'bg-red-400' }`} />
          <span className="text-slate-400">
            { summary?.canTrade ? 'Ready to trade' : 'Cannot trade' }
          </span>
        </div>
        { summary?.multiAssetsMode && (
          <div className="text-slate-400">Multi-Assets Mode ✓</div>
        )}
      </div>
    </div>
  );
}
