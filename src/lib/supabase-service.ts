import type { Position, AgentSummary, AIDecision, Agent } from '@/types';

const QUANTUM_SUPABASE_URL = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_URL;
const QUANTUM_SUPABASE_KEY = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_KEY;

/**
 * Supabase Service for Trading Operations
 * 
 * Handles all database operations for:
 * - Positions (create, update, close)
 * - Agent summaries (create)
 * - Agent updates (balance, PnL, stats)
 */

function getHeaders(): HeadersInit {
  if (!QUANTUM_SUPABASE_KEY) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_KEY');
  return {
    apikey: QUANTUM_SUPABASE_KEY,
    Authorization: `Bearer ${QUANTUM_SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Fetch active positions for an agent
 */
export async function fetchActivePositions(agentId: string): Promise<Position[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?agent_id=eq.${agentId}&is_active=eq.true&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch positions: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all positions for an agent (active + closed)
 * Ordered by created_at (entry time) descending
 */
export async function fetchAllPositions(agentId: string, limit: number = 50): Promise<Position[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?agent_id=eq.${agentId}&select=*&order=created_at.desc&limit=${limit}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch positions: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch closed positions for an agent
 * Ordered by exit_time (close time) descending - newest first
 */
export async function fetchClosedPositionsByExitTime(agentId: string, limit: number = 10): Promise<Position[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?agent_id=eq.${agentId}&is_active=eq.false&select=*&order=exit_time.desc.nullslast&limit=${limit}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch closed positions: ${response.status}`);
  }

  return response.json();
}

/**
 * Create new position (LONG or SHORT signal)
 * Now supports storing ASTER exchange order IDs
 */
export async function createPosition(
  agentId: string,
  decision: AIDecision,
  asterOrderIds?: {
    entryOrderId?: number;
    stopLossOrderId?: number;
    takeProfitOrderId?: number;
  }
): Promise<Position> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions`;

  // Calculate position size percentage
  const agent = await fetchAgent(agentId);
  const sizePct = (decision.size_usd / agent.balance) * 100;

  // Calculate quantity (size_usd / entry_price)
  const quantity = decision.size_usd / decision.entry_price;

  // Calculate liquidation price (simplified)
  const liquidationPrice = calculateLiquidationPrice(
    decision.entry_price,
    decision.leverage,
    decision.signal as 'long' | 'short'
  );

  const positionData = {
    agent_id: agentId,
    symbol: decision.coin,
    side: decision.signal.toUpperCase() as 'LONG' | 'SHORT',
    entry_price: decision.entry_price,
    stop_loss: decision.stop_loss,
    take_profit: decision.profit_target,
    size_usd: decision.size_usd,
    size_pct: sizePct,
    confidence: decision.confidence,
    entry_time: new Date().toISOString(),
    reasoning: decision.justification,
    exit_strategy: `Duration: ${decision.expected_duration}, TP: ${decision.profit_target}, SL: ${decision.stop_loss}`,
    is_active: true,
    leverage: decision.leverage,
    quantity: quantity,
    risk_usd: decision.risk_usd,
    liquidation_price: liquidationPrice,
    invalidation_condition: decision.invalidation_condition,
    // Store ASTER order IDs if provided
    entry_order_id: asterOrderIds?.entryOrderId || null,
    stop_loss_order_id: asterOrderIds?.stopLossOrderId || null,
    take_profit_order_id: asterOrderIds?.takeProfitOrderId || null,
  };

  console.log('[Supabase] Creating position with ASTER order IDs:', {
    entryOrderId: asterOrderIds?.entryOrderId,
    stopLossOrderId: asterOrderIds?.stopLossOrderId,
    takeProfitOrderId: asterOrderIds?.takeProfitOrderId,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(positionData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create position: ${response.status} - ${errorText}`);
  }

  const positions = await response.json();
  return positions[0];
}

/**
 * Update position with ASTER order IDs (for positions created before order execution)
 */
export async function updatePositionWithOrderIds(
  positionId: string,
  orderIds: {
    entryOrderId?: number;
    stopLossOrderId?: number;
    takeProfitOrderId?: number;
  }
): Promise<void> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?id=eq.${positionId}`;

  const updateData: Record<string, any> = {};
  if (orderIds.entryOrderId) updateData.entry_order_id = orderIds.entryOrderId;
  if (orderIds.stopLossOrderId) updateData.stop_loss_order_id = orderIds.stopLossOrderId;
  if (orderIds.takeProfitOrderId) updateData.take_profit_order_id = orderIds.takeProfitOrderId;

  console.log('[Supabase] Updating position with order IDs:', { positionId, orderIds });

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update position order IDs: ${response.status} - ${errorText}`);
  }
}

/**
 * Close position (CLOSE signal or TP/SL hit)
 */
export async function closePosition(
  positionId: string,
  exitPrice: number,
  exitReason: string
): Promise<Position> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  // First, fetch the position to calculate PnL
  const position = await fetchPositionById(positionId);
  
  // Calculate PnL
  const { pnlUsd, pnlPct } = calculatePnL(
    position.side,
    position.entry_price,
    exitPrice,
    position.size_usd,
    position.leverage
  );

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?id=eq.${positionId}`;

  const updateData = {
    is_active: false,
    exit_price: exitPrice,
    exit_time: new Date().toISOString(),
    exit_reason: exitReason,
    pnl_usd: pnlUsd,
    pnl_pct: pnlPct,
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to close position: ${response.status} - ${errorText}`);
  }

  const positions = await response.json();
  return positions[0];
}

/**
 * Fetch single position by ID
 */
async function fetchPositionById(positionId: string): Promise<Position> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?id=eq.${positionId}&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch position: ${response.status}`);
  }

  const positions = await response.json();
  return positions[0];
}

/**
 * Fetch single agent by ID
 */
async function fetchAgent(agentId: string): Promise<Agent> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.status}`);
  }

  const agents = await response.json();
  return agents[0];
}

/**
 * Create agent summary (snapshot of decisions)
 */
export async function createAgentSummary(
  agentId: string,
  decisions: AIDecision[],
  conclusion: string,
  invocationCount: number,
  runtimeMinutes: number
): Promise<AgentSummary> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const agent = await fetchAgent(agentId);
  const activePositions = await fetchActivePositions(agentId);
  
  // Calculate total exposure
  const totalExposure = activePositions.reduce((sum, pos) => sum + pos.size_usd, 0);

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_summaries`;

  const summaryData = {
    agent_id: agentId,
    session_timestamp: new Date().toISOString(),
    invocation_count: Math.round(Number(invocationCount)),
    runtime_minutes: Number(runtimeMinutes), // Must be INTEGER per schema
    // runtime_minutes: Math.round(Number(runtimeMinutes)), // Must be INTEGER per schema
    total_decisions: decisions.length,
    decisions_made: decisions,
    balance_at_time: Number(agent.balance),
    total_exposure_at_time: Number(totalExposure),
    active_positions_at_time: activePositions.length,
    conclusion: conclusion,
  };

  console.log('[Supabase] Creating summary with data:', JSON.stringify(summaryData, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(summaryData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create summary: ${response.status} - ${errorText}`);
  }

  const summaries = await response.json();
  return summaries[0];
}

/**
 * Fetch latest agent summary (most recent analysis)
 */
export async function fetchLatestAgentSummary(agentId: string): Promise<AgentSummary | null> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_summaries?agent_id=eq.${agentId}&select=*&order=session_timestamp.desc&limit=1`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest summary: ${response.status}`);
  }

  const summaries = await response.json();
  return summaries.length > 0 ? summaries[0] : null;
}

/**
 * Fetch agent summaries (history)
 */
export async function fetchAgentSummaries(agentId: string, limit: number = 10): Promise<AgentSummary[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_summaries?agent_id=eq.${agentId}&select=*&order=session_timestamp.desc&limit=${limit}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch summaries: ${response.status}`);
  }

  return response.json();
}

/**
 * Update agent stats after position close
 * Calculates and updates: total_pnl, roi, trade_count, win_count, loss_count, win_rate
 * 
 * @param agentId - Agent ID
 * @param closedPosition - The position that was just closed (with calculated PnL)
 */
export async function updateAgentStats(
  agentId: string,
  closedPosition: Position
): Promise<void> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const agent = await fetchAgent(agentId);
  
  // Get PnL from closed position
  const pnlUsd = closedPosition.pnl_usd || 0;
  const isWin = pnlUsd > 0;

  console.log('[Supabase] Updating agent stats:', {
    agentId,
    currentBalance: agent.balance,
    pnlUsd,
    isWin,
    currentStats: {
      total_pnl: agent.total_pnl,
      trade_count: agent.trade_count,
      win_count: agent.win_count,
      loss_count: agent.loss_count,
    }
  });

  // Calculate new stats
  const newTotalPnl = (agent.total_pnl || 0) + pnlUsd;
  const newTradeCount = (agent.trade_count || 0) + 1;
  const newWinCount = (agent.win_count || 0) + (isWin ? 1 : 0);
  const newLossCount = (agent.loss_count || 0) + (isWin ? 0 : 1);
  const newWinRate = newTradeCount > 0 ? (newWinCount / newTradeCount) * 100 : 0;
  
  // Calculate ROI based on initial balance
  // ROI = (Current Total PnL / Initial Balance) * 100
  const initialBalance = agent.balance - (agent.total_pnl || 0); // Reverse calculate initial balance
  const newRoi = initialBalance > 0 ? (newTotalPnl / initialBalance) * 100 : 0;

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`;

  const updateData = {
    total_pnl: newTotalPnl,
    roi: newRoi,
    trade_count: newTradeCount,
    win_count: newWinCount,
    loss_count: newLossCount,
    win_rate: newWinRate,
  };

  console.log('[Supabase] New agent stats:', updateData);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update agent stats: ${response.status} - ${errorText}`);
  }

  console.log('[Supabase] ✅ Agent stats updated successfully');
}

/**
 * Update agent active positions count
 */
export async function updateAgentActivePositions(agentId: string): Promise<void> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const activePositions = await fetchActivePositions(agentId);
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`;

  const updateData = {
    active_positions: activePositions.length,
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update active positions: ${response.status} - ${errorText}`);
  }
}

/**
 * Fetch all agents
 */
export async function fetchAllAgents(): Promise<Agent[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch closed positions for an agent
 */
export async function fetchClosedPositions(agentId: string): Promise<Position[]> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
  
  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/positions?agent_id=eq.${agentId}&is_active=eq.false&select=*`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch closed positions: ${response.status}`);
  }

  return response.json();
}

/**
 * Recalculate agent stats from ALL closed positions
 * This ensures accuracy by recalculating from scratch instead of incremental updates
 * 
 * @param agentId - Agent ID to recalculate stats for
 */
export async function recalculateAgentStats(agentId: string): Promise<void> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  console.log(`[Stats Recalc] Starting recalculation for agent ${agentId}`);

  // Fetch agent and all closed positions
  const agent = await fetchAgent(agentId);
  const closedPositions = await fetchClosedPositions(agentId);

  console.log(`[Stats Recalc] Found ${closedPositions.length} closed positions for agent ${agentId}`);

  // Calculate stats from ALL closed positions
  let totalPnl = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const position of closedPositions) {
    const pnl = position.pnl_usd || 0;
    totalPnl += pnl;
    
    if (pnl > 0) {
      winCount++;
    } else if (pnl < 0) {
      lossCount++;
    }
    // pnl === 0 is neither win nor loss (breakeven)
  }

  const tradeCount = closedPositions.length;
  const winRate = tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

  // Calculate ROI based on initial balance
  // Initial Balance = Current Balance - Total PnL
  const initialBalance = agent.balance - totalPnl;
  const roi = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`;

  const updateData = {
    total_pnl: totalPnl,
    roi: roi,
    trade_count: tradeCount,
    win_count: winCount,
    loss_count: lossCount,
    win_rate: winRate,
  };

  console.log(`[Stats Recalc] Updating agent ${agentId} with:`, updateData);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update agent stats: ${response.status} - ${errorText}`);
  }

  console.log(`[Stats Recalc] ✅ Agent ${agentId} stats updated successfully`);
}

/**
 * Recalculate stats for ALL agents
 * This is the main function called by the background job
 */
export async function recalculateAllAgentsStats(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ agentId: string; error: string }>;
}> {
  console.log('[Stats Recalc] Starting recalculation for ALL agents');

  const agents = await fetchAllAgents();
  console.log(`[Stats Recalc] Found ${agents.length} agents to process`);

  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ agentId: string; error: string }> = [];

  for (const agent of agents) {
    try {
      await recalculateAgentStats(agent.id);
      successCount++;
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ agentId: agent.id, error: errorMsg });
      console.error(`[Stats Recalc] Failed to recalculate stats for agent ${agent.id}:`, errorMsg);
    }
  }

  console.log(`[Stats Recalc] ✅ Completed: ${successCount} success, ${failedCount} failed`);

  return { success: successCount, failed: failedCount, errors };
}

/**
 * Calculate PnL for a position
 * 
 * IMPORTANT: sizeUsd already includes leverage (sizeUsd = margin * leverage)
 * So we should NOT multiply by leverage again!
 * 
 * Example:
 * - Margin: $1.33
 * - Leverage: 15x
 * - Size: $20 (already = $1.33 * 15)
 * - Entry: $1127.75
 * - Exit: $1000
 * - Price change: -11.33%
 * - PnL: $20 * -11.33% = -$2.27 (NOT -$34!)
 */
function calculatePnL(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  exitPrice: number,
  sizeUsd: number,
  leverage: number
): { pnlUsd: number; pnlPct: number } {
  const priceChange = side === 'LONG' 
    ? (exitPrice - entryPrice) / entryPrice
    : (entryPrice - exitPrice) / entryPrice;

  // PnL percentage (relative to margin, so multiply by leverage)
  const pnlPct = priceChange * leverage * 100;
  
  // PnL in USD (sizeUsd already includes leverage, so DON'T multiply again!)
  const pnlUsd = sizeUsd * priceChange;

  return { pnlUsd, pnlPct };
}

/**
 * Calculate liquidation price (simplified)
 */
function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'long' | 'short'
): number {
  // Simplified: liquidation at ~90% loss of margin
  const liquidationPct = 0.9 / leverage;
  
  if (side === 'long') {
    return entryPrice * (1 - liquidationPct);
  } else {
    return entryPrice * (1 + liquidationPct);
  }
}

/**
 * Save balance snapshot for all active agents
 * Called periodically to build historical data for charts
 */
export async function snapshotAllAgentsBalance(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ agentId: string; error: string }>
}> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  console.log('[Balance Snapshot] Starting snapshot for all agents');

  const agents = await fetchAllAgents();
  const activeAgents = agents.filter(a => a.is_active);
  
  console.log(`[Balance Snapshot] Found ${activeAgents.length} active agents to snapshot`);

  if (activeAgents.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  const snapshots = activeAgents.map(agent => ({
    agent_id: agent.id,
    balance: agent.balance,
    available_balance: agent.available_balance,
    usdt_balance: agent.usdt_balance,
    bnb_balance: agent.bnb_balance,
    total_pnl: agent.total_pnl,
    roi: agent.roi,
    active_positions: agent.active_positions,
    total_exposure: agent.total_exposure,
    unrealized_pnl: agent.unrealized_pnl,
    timestamp: new Date().toISOString(),
  }));

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_balance_history`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(snapshots),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save balance snapshots: ${response.status} - ${errorText}`);
  }

  console.log(`[Balance Snapshot] ✅ Saved ${snapshots.length} snapshots successfully`);

  return { success: snapshots.length, failed: 0, errors: [] };
}

/**
 * Fetch historical balance data for an agent
 * Used for charting
 * 
 * @param agentId - Agent ID
 * @param hours - Number of hours to fetch (default: 96 hours / 4 days)
 */
export async function fetchAgentBalanceHistory(
  agentId: string,
  hours: number = 96
): Promise<Array<{ timestamp: string; balance: number }>> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_balance_history?agent_id=eq.${agentId}&timestamp=gte.${startTime}&select=timestamp,balance&order=timestamp.asc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch balance history: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch historical balance data for ALL agents
 * Returns data grouped by agent
 * 
 * @param hours - Number of hours to fetch (default: 96 hours / 4 days)
 */
export async function fetchAllAgentsBalanceHistory(
  hours: number = 96
): Promise<Record<string, Array<{ timestamp: string; balance: number }>>> {
  if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');

  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_balance_history?timestamp=gte.${startTime}&select=agent_id,timestamp,balance&order=timestamp.asc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch balance history: ${response.status}`);
  }

  const data: Array<{ agent_id: string; timestamp: string; balance: number }> = await response.json();

  // Group by agent_id
  const grouped: Record<string, Array<{ timestamp: string; balance: number }>> = {};
  
  for (const item of data) {
    if (!grouped[item.agent_id]) {
      grouped[item.agent_id] = [];
    }
    grouped[item.agent_id].push({
      timestamp: item.timestamp,
      balance: item.balance,
    });
  }

  return grouped;
}
