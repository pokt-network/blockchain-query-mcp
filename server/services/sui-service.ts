/**
 * BlockchainQuery MCP — Sui Service
 *
 * Provides typed helpers for Sui JSON-RPC endpoints.
 * Uses the chain registry to resolve the 'sui' chain and the RPC dispatcher
 * to make outbound JSON-RPC calls.
 */

import type { ChainInfo, RpcResponse } from '../types/index.js';
import { registry } from './chain-registry.js';
import { dispatch } from './rpc-dispatcher.js';
import { SUI_DEFAULT_COIN_TYPE } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical Sui mainnet chain from the registry.
 * Throws if the 'sui' slug is not found (configuration error).
 */
function resolveSuiChain(): ChainInfo {
  const chain = registry.getChain('sui');
  if (!chain) {
    throw new Error(`Chain 'sui' not found in registry.`);
  }
  return chain;
}

/** Wrap a resolver error into a normalised RpcResponse. */
function chainError(method: string, err: unknown): RpcResponse {
  const error = err instanceof Error ? err.message : String(err);
  return { success: false, error, chain: 'sui', method };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Get the coin balance for an address.
 * Augments the raw response with a human-readable balance field (totalBalance / 1e9).
 */
async function getBalance(address: string, coinType?: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveSuiChain();
  } catch (err) {
    return chainError('getBalance', err);
  }

  const resolvedCoinType = coinType ?? SUI_DEFAULT_COIN_TYPE;
  const result = await dispatch(chain, 'suix_getBalance', [address, resolvedCoinType]);

  if (result.success && result.data != null) {
    const raw = result.data as Record<string, unknown>;
    const totalBalance = typeof raw['totalBalance'] === 'string' ? raw['totalBalance'] : '0';
    const humanReadable = (Number(BigInt(totalBalance)) / 1e9).toString();
    return {
      ...result,
      data: {
        ...raw,
        totalBalanceFormatted: humanReadable,
      },
    };
  }

  return result;
}

/**
 * Get a Sui object by its object ID, including type, owner, and content.
 */
async function getObject(objectId: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveSuiChain();
  } catch (err) {
    return chainError('getObject', err);
  }

  return dispatch(chain, 'sui_getObject', [
    objectId,
    { showType: true, showOwner: true, showContent: true },
  ]);
}

/**
 * Get a transaction block by its digest, including inputs, effects, and events.
 */
async function getTransaction(digest: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveSuiChain();
  } catch (err) {
    return chainError('getTransaction', err);
  }

  return dispatch(chain, 'sui_getTransactionBlock', [
    digest,
    { showInput: true, showEffects: true, showEvents: true },
  ]);
}

/**
 * Get paginated coins owned by an address.
 * Optional parameters are omitted from the RPC call when not provided.
 */
async function getCoins(
  address: string,
  coinType?: string,
  cursor?: string,
  limit?: number,
): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveSuiChain();
  } catch (err) {
    return chainError('getCoins', err);
  }

  const params = [address, coinType, cursor, limit].filter((x) => x !== undefined);
  return dispatch(chain, 'suix_getCoins', params);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const suiService = {
  getBalance,
  getObject,
  getTransaction,
  getCoins,
};
