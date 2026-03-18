/**
 * BlockchainQuery MCP — Radix Service
 *
 * Provides typed helpers for Radix Gateway API endpoints.
 * The Radix Gateway uses POST requests with JSON bodies (not JSON-RPC
 * and not GET-based REST), so this service calls dispatchPostRest directly
 * to bypass the inactive-chain gate in dispatch() — the upstream registry
 * may still list Radix as inactive while the gateway is operational.
 */

import type { ChainInfo, RpcResponse } from '../types/index.js';
import { registry } from './chain-registry.js';
import { dispatchPostRest } from './rpc-dispatcher.js';
import { RPC_TIMEOUT_MS } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveRadixChain(): ChainInfo {
  const chain = registry.getChain('radix');
  if (!chain) {
    throw new Error("Chain 'radix' not found in registry.");
  }
  if (chain.protocol !== 'radix') {
    throw new Error(`Chain 'radix' uses protocol '${chain.protocol}', expected 'radix'.`);
  }
  return chain;
}

function chainError(method: string, err: unknown): RpcResponse {
  const error = err instanceof Error ? err.message : String(err);
  return { success: false, error, chain: 'radix', method };
}

async function radixPost(path: string, body: unknown): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveRadixChain();
  } catch (err) {
    return chainError(path, err);
  }

  try {
    const data = await dispatchPostRest(chain.url, path, body, RPC_TIMEOUT_MS);
    return { success: true, data, chain: 'radix', method: path };
  } catch (err) {
    return chainError(path, err);
  }
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

async function getNetworkStatus(): Promise<RpcResponse> {
  return radixPost('/status/network-status', {});
}

async function getNetworkConfig(): Promise<RpcResponse> {
  return radixPost('/status/network-configuration', {});
}

async function getBalance(accountAddress: string): Promise<RpcResponse> {
  return radixPost('/lts/state/account-all-fungible-resource-balances', {
    account_address: accountAddress,
  });
}

async function getTransactionStatus(intentHash: string): Promise<RpcResponse> {
  return radixPost('/lts/transaction/status', {
    intent_hash: intentHash,
  });
}

async function getConsensusManager(): Promise<RpcResponse> {
  return radixPost('/state/consensus-manager', {});
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const radixService = {
  getNetworkStatus,
  getNetworkConfig,
  getBalance,
  getTransactionStatus,
  getConsensusManager,
};
