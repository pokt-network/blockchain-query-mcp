/**
 * BlockchainQuery MCP — Near Service
 *
 * Provides typed helpers for NEAR Protocol JSON-RPC endpoints.
 * Uses the chain registry to resolve the 'near' chain and the RPC dispatcher
 * to make outbound JSON-RPC calls.
 *
 * NEAR's RPC deviates slightly from standard JSON-RPC conventions:
 *  - `query` takes a single object param (wrapped in an array for the dispatcher)
 *  - `block` and `tx` use positional array params
 */

import type { ChainInfo, RpcResponse } from '../types/index.js';
import { registry } from './chain-registry.js';
import { dispatch } from './rpc-dispatcher.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical NEAR mainnet chain from the registry.
 * Throws if the 'near' slug is not found (configuration error).
 */
function resolveNearChain(): ChainInfo {
  const chain = registry.getChain('near');
  if (!chain) {
    throw new Error(`Chain 'near' not found in registry.`);
  }
  return chain;
}

/** Wrap a resolver error into a normalised RpcResponse. */
function chainError(method: string, err: unknown): RpcResponse {
  const error = err instanceof Error ? err.message : String(err);
  return { success: false, error, chain: 'near', method };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Generic NEAR state query.
 *
 * Supported `requestType` values:
 *  - `view_account`          — requires `account_id`
 *  - `call_function`         — requires `account_id`, `method_name`, `args_base64`
 *  - `view_access_key_list`  — requires `account_id`
 *  - `view_state`            — requires `account_id`, `prefix_base64`
 *  - `view_code`             — requires `account_id`
 *
 * `finality: 'final'` is appended automatically.
 */
async function query(
  requestType: string,
  params: Record<string, unknown>,
): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveNearChain();
  } catch (err) {
    return chainError('query', err);
  }

  return dispatch(chain, 'query', [
    { request_type: requestType, finality: 'final', ...params },
  ]);
}

/**
 * Get a NEAR block.
 *
 * - If `blockId` is a number, treated as a block height.
 * - If `blockId` is a string, treated as a block hash.
 * - If omitted, returns the latest finalized block.
 */
async function getBlock(blockId?: number | string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveNearChain();
  } catch (err) {
    return chainError('block', err);
  }

  if (blockId !== undefined) {
    return dispatch(chain, 'block', [{ block_id: blockId }]);
  }

  return dispatch(chain, 'block', [{ finality: 'final' }]);
}

/**
 * Get a NEAR transaction by hash and sender account ID.
 * NEAR's `tx` method requires both arguments as positional params.
 */
async function getTransaction(txHash: string, senderAccountId: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveNearChain();
  } catch (err) {
    return chainError('tx', err);
  }

  return dispatch(chain, 'tx', [txHash, senderAccountId]);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const nearService = {
  query,
  getBlock,
  getTransaction,
};
